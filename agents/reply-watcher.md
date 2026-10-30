# Agent: reply watcher

## Purpose
Never lose track of what I'm waiting for from others. Every request I send becomes a row; the watcher checks each row where the answer would appear and tells me when it arrives.

## The list (`waiting-for.md`)
| # | What I'm waiting for | From whom | Where exactly (thread, email, ticket, PR) | Since | Remind on | When it arrives |
|---|---|---|---|---|---|---|

- Internal people: reminder after 4 days. External: after 7.
- "Where exactly" is a link or thread ID, never "Slack" or "email" in general.
- "When it arrives" holds the next step, prepared in advance.

## Each run
1. For every open row, check the exact place (thread replies, not only the channel; sent and received mail; ticket status changes, not only comments).
2. Arrived: move the row to "Arrived", show the answer and the prepared next step.
3. Due: prepare the reminder text in the same thread, short, without blame. It is sent only with approval.
4. New requests detected in the day's messages are added as new rows.
5. Closed rows move to "Closed (last 30 days)".

## Rules
- A missing message in a search result is not proof that nothing arrived: long threads can be truncated. Check before reporting.
- Never send a reminder automatically.
