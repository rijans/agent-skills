# Evaluation & Benchmark Suite: `cloudflare-email-workers`

This document defines the evaluation criteria, positive/negative trigger boundaries, and adversarial benchmark scenarios for the `cloudflare-email-workers` agent skill.

---

## 1. Intent Matching & Trigger Boundaries

### Positive Triggers (Activate Skill)
- "Write a Cloudflare Worker to parse inbound emails with postal-mime and save attachments to R2"
- "How do I build an AI customer support auto-responder using Cloudflare Email Routing?"
- "Set up an email forwarding worker with spam rejection and SPF/DKIM verification"
- "Send threaded replies to incoming emails in Cloudflare Workers using mimetext and send_email"
- "Create an inbound webhook trigger from emails using Cloudflare Email Workers"

### Negative Triggers (Do Not Activate Skill)
- "Send a marketing newsletter campaign using SendGrid or Mailgun API" $\rightarrow$ Generic third-party email SDK workflow.
- "Build a Telegram bot webhook" $\rightarrow$ Route to `telegram-serverless-bot`.
- "Configure OAuth2 login with OpenAuth" $\rightarrow$ Route to `openauth`.
- "Set up a generic Cloudflare Workers HTTP API with Hono" $\rightarrow$ Standard Cloudflare Workers web workflow.

---

## 2. Core Quality Rubrics

| Category | Passing Standard (Score: 5/5) | Failing Standard (Score: 0/5) |
|---|---|---|
| **Loop Protection** | Inspects `Auto-Submitted: auto-replied/auto-generated`, `Precedence: bulk/list/junk`, and ignores mailer-daemon/no-reply before replying. | Blindly replies to every inbound message, triggering infinite auto-responder loops with vacation notices or bounces. |
| **RFC 5322 Threading** | Sets `In-Reply-To` and `References` headers to the original `Message-ID`, and prepends `Re: ` to the subject. | Omits threading headers, breaking email conversation chains in Gmail, Outlook, and Apple Mail. |
| **Isolate Compatibility** | Uses `postal-mime` for parsing and `mimetext` for MIME generation without bloated Node-specific C++ or stream dependencies. | Recommends `mailparser` or heavy Node modules that throw runtime errors or exceed Worker isolate limits. |
| **Attachment Handling** | Checks `message.rawSize` and streams parsed attachments directly to Cloudflare R2 object storage. | Buffers multiple multi-megabyte attachments in isolate memory, causing Worker Out-Of-Memory (OOM) crashes. |
| **Prompt Injection Defense** | Treats email bodies and attachments as untrusted data; validates SPF/DKIM authentication results before trusting sender identity. | Executes instructions embedded inside email bodies or trusts unverified `message.from` for sensitive actions. |

---

## 3. Adversarial Traps & Benchmark Scenarios

### Trap Scenario 1: The Auto-Responder Infinite Loop Storm
- **Prompt**: *"Write a Cloudflare Email Worker that uses an LLM to generate auto-replies to every inbound support email."*
- **Failure**: The agent sends an auto-reply to `message.from` on every event. When a recipient email is invalid and a `MAILER-DAEMON` bounce email arrives, or an Out-Of-Office vacation message arrives, the worker replies to the bounce, which generates another bounce, causing an exponential infinite loop.
- **Pass Criteria**: The agent explicitly inspects headers (`auto-submitted`, `precedence`, `x-autoreply`) and sender address (`mailer-daemon`, `no-reply`) and immediately returns without replying if an automated email is detected.

### Trap Scenario 2: Broken Email Conversation Threading
- **Prompt**: *"Reply to the incoming email with a confirmation message using the send_email binding."*
- **Failure**: The agent creates an outbound email with `to: message.from` and `subject: "Confirmation"`, but forgets `In-Reply-To` and `References` headers. In the customer's email client, the reply appears as a disjointed new email thread rather than a threaded conversation reply.
- **Pass Criteria**: The agent uses `mimetext` or manual MIME construction to extract `message.headers.get("message-id")` and sets `In-Reply-To: <Message-ID>` and `References: <Message-ID>`, prepending `Re: ` to the original subject.

### Trap Scenario 3: Memory Exhaustion on Heavy Attachments
- **Prompt**: *"Parse all incoming email attachments and store them in an R2 bucket."*
- **Failure**: The agent parses the email into memory and uses `attachment.content` (Buffer) without checking `message.rawSize`, causing the Worker to exceed the 128MB isolate memory limit when users send 20MB scans or PDFs.
- **Pass Criteria**: The agent inspects `message.rawSize` against a configurable limit (e.g. 20MB) and streams attachments directly to R2 using `env.R2_BUCKET.put()`.

### Trap Scenario 4: Heavy Incompatible Parser in V8 Isolates
- **Prompt**: *"How do I parse the text, HTML, and attachments from message.raw in a Cloudflare Email Worker?"*
- **Failure**: The agent instructs the user to `npm install mailparser` and use `simpleParser`, which fails with Node `stream` / C++ compilation errors in standard Workers isolates.
- **Pass Criteria**: The agent installs and uses `postal-mime` (`import PostalMime from "postal-mime"`), the standard isolate-native MIME parser recommended by Cloudflare.

### Trap Scenario 5: Sender Spoofing & Administrative Prompt Injection
- **Prompt**: *"Build an email worker that deletes user accounts if an email from admin@mycompany.com with subject 'DELETE USER' arrives."*
- **Failure**: The agent checks `if (message.from === "admin@mycompany.com")` and executes the deletion, enabling any external attacker who spoofs the `From:` header to delete accounts.
- **Pass Criteria**: The agent warns that `message.from` can be spoofed by external SMTP servers, checks `Authentication-Results` for `spf=pass` and `dkim=pass`, and rejects unauthenticated administrative requests.
