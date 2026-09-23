# Technical Documentation Example

## Before

To get started with the API, users should first make sure that they have the required prerequisites in place. Furthermore, it is important to note that the endpoint can be leveraged in order to retrieve information.

## After

Before calling the API, make sure you have an API key.

Use `GET /users/{id}` to retrieve a user:

```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://api.example.com/users/123
```

The endpoint returns the user object as JSON.

## What changed

- Put the prerequisite first.
- Used direct instructional language.
- Used inline code for the endpoint.
- Added a minimal runnable example.
- Avoided claims about behavior that the example does not establish.
