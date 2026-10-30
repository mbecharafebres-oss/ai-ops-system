# slack-thread-watcher (MCP server)

A dependency-free Node.js MCP stdio server that fills two gaps in common Slack MCP servers:

- **`threads_updated_since`**: returns threads whose replies are newer than a given time, even when the thread started weeks ago. `conversations.history` only returns root messages with their original date, so late replies in old threads are easy to miss. Optionally flags replies that mention a given user.
- **`canvas_list` / `canvas_read`**: read Slack canvases, including the automatic huddle notes.

## Setup
1. Create a Slack app with a user token (`xoxp-`) and the scopes `canvases:read`, `files:read`, and `channels:history`, `groups:history`, `im:history`, `mpim:history` plus the matching `:read` scopes.
2. Add it to your MCP client config:

```json
{
  "mcpServers": {
    "slack-thread-watcher": {
      "command": "node",
      "args": ["/path/to/index.js"],
      "env": { "SLACK_MCP_XOXP_TOKEN": "xoxp-..." }
    }
  }
}
```

## Example call
`threads_updated_since` with `since: "2026-10-29T13:46:00+01:00"`, `lookback_days: 30`, `mention_user_id: "U0123456789"` returns, for every conversation the token can read, the threads with new replies and only those replies.

## Security notes
- The token is read from the environment only; never commit it. The server refuses to send it to any host that is not `slack.com` over HTTPS, including on redirects.
- Read-only: the server only calls read methods. Use a user token with the minimum scopes above.
- Messages and canvases are untrusted content written by other people. If an LLM reads them, treat any instructions inside as data, not commands.
