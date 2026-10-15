# Tools & Function Calling over the Data Channel

This guide explains how to declare client and server tools, handle tool execution events over the `oai-events` data channel, return tool outputs, and prompt the model to speak the result.

---

## 1. Declaring Tools

Tools can be configured when minting the ephemeral session token on the backend or injected dynamically via `session.update` over the data channel:

```javascript
const tools = [
  {
    type: 'function',
    name: 'change_theme',
    description: 'Change the application UI theme color mode.',
    parameters: {
      type: 'object',
      properties: {
        theme: {
          type: 'string',
          enum: ['light', 'dark', 'cyberpunk'],
          description: 'The target UI theme.',
        },
      },
      required: ['theme'],
    },
  },
  {
    type: 'function',
    name: 'fetch_order_status',
    description: 'Look up the real-time shipping status of an order.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The alphanumeric order identifier (e.g. ORD-1092).',
        },
      },
      required: ['order_id'],
    },
  },
]
```

---

## 2. Handling Function Call Execution

When the model decides to invoke a tool, it emits `response.function_call_arguments.done` on the `oai-events` data channel:

```javascript
dataChannel.onmessage = async (event) => {
  const msg = JSON.parse(event.data)

  if (msg.type === 'response.function_call_arguments.done') {
    const { call_id, name, arguments: rawArgs } = msg
    console.log(`[Tool Call] Model invoked ${name} (call_id: ${call_id})`)

    let parsedArgs = {}
    try {
      parsedArgs = JSON.parse(rawArgs)
    } catch (err) {
      console.error('[Tool Call] Failed to parse arguments:', err)
      return submitToolOutput(dataChannel, call_id, { error: 'Invalid JSON arguments' })
    }

    let result
    try {
      // Route tool execution
      if (name === 'change_theme') {
        result = handleClientThemeChange(parsedArgs)
      } else if (name === 'fetch_order_status') {
        result = await handleBackendOrderLookup(parsedArgs)
      } else {
        result = { error: `Unknown tool: ${name}` }
      }
    } catch (execErr) {
      result = { error: execErr.message || 'Execution failed' }
    }

    // Return output back to OpenAI
    submitToolOutput(dataChannel, call_id, result)
  }
}
```

---

## 3. Submitting Output & The `response.create` Rule

> [!IMPORTANT]
> When you send `conversation.item.create` with type `function_call_output`, OpenAI appends the tool result to the conversation context, but **it will NOT speak the response automatically**. You MUST immediately send `{ type: "response.create" }` to instruct the model to generate audio for the user.

```javascript
function submitToolOutput(dataChannel, callId, outputObject) {
  // 1. Submit tool execution output
  dataChannel.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(outputObject),
      },
    })
  )

  // 2. Trigger voice response to speak the result
  dataChannel.send(
    JSON.stringify({
      type: 'response.create',
    })
  )

  console.log(`[Tool Call] Output submitted for ${callId} and response.create dispatched`)
}
```

---

## 4. Client-Side vs Backend-Delegated Tools

### Client-Side Tool (In-Browser DOM/UI)
Directly manipulates the browser document:
```javascript
function handleClientThemeChange({ theme }) {
  document.body.className = `theme-${theme}`
  return { success: true, activeTheme: theme }
}
```

### Backend-Delegated Tool (Secure Database / APIs)
Calls your application backend API without exposing database credentials to the client:
```javascript
async function handleBackendOrderLookup({ order_id }) {
  const res = await fetch(`/api/orders/${encodeURIComponent(order_id)}`, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    return { error: 'Order not found in database' }
  }
  return await res.json()
}
```
