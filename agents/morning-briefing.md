# Agent: morning briefing

## Purpose
Start the day with one short briefing across every desk, instead of opening ten tools. The agent reads, cross-checks and prepares; the human decides and sends.

## When it runs
Every working morning, on demand or on a schedule.

## Steps
0. **Starting state.** Read the current-context file and this week's log for each desk, plus the last line of the evening close log, to know what was open yesterday.
1. **Team chat.** Read every channel and DM since the last run, including replies in old threads (see `mcp/slack-thread-watcher`). Detect mentions, questions addressed to me and commitments.
2. **Reply watcher.** Run `reply-watcher.md` over the "waiting for" list. What arrived goes to INBOX; reminders that are due go to OVERDUE with the text ready.
3. **Email.** Unread and last 16 hours for each mailbox. Cross with open commitments; anything already handled is marked as read.
4. **Meetings.** New transcripts go through `meeting-capture.md`.
5. **Deadlines.** Anything due in the next 3 days, and anything blocked by an external party.
6. **Briefing.** Following `summary-format.md`: at most 3 "decide today" items, one line with the size of the queue, and real alerts only. Ready-to-send messages are numbered so the human can answer "send 4".
7. **Log.** Update the week log and project files, write one line to the run log, commit.

## Rules
- Nothing is sent, posted or submitted without explicit approval in the chat.
- Every item says which desk it belongs to.
- If a source fails (expired session, tool down), say it in ALERTS and continue with the rest.
- Never report something as "pending" without checking the real source (sent folder, thread, ticket); files can lag behind reality.
