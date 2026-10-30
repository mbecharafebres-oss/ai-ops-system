# Rule: decide today + queue

Long summaries make people answer everything at once and nothing in depth. Every summary the agents produce follows this format.

1. **Every topic goes to the queue first** (`queue.md`): one row per topic with desk, next step, owner, deadline and where the detail lives. What isn't answered stays in the queue.
2. **In the chat, only:**
   - **Decide today (max 3):** what needs a decision or an OK today, one line each, as a closed question.
   - **In queue:** one line with the number of topics and 3 to 5 short names.
   - Real alerts only (due today or tomorrow, or escalating).
3. **One topic at a time.** Work a topic until it's closed or parked, then: "Next in queue: X. Shall we?". The human can say "next", "skip" or pick a number.
4. Detail (texts, analysis, options) only when that topic is being worked.
