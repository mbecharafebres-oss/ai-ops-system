# Design principles

1. **Agents prepare, people decide.** Every outbound action (message, post, form, ticket change) waits for an explicit OK.
2. **Check the source, not the file.** Before reporting something as pending, check the real place: sent folder, thread replies, ticket history.
3. **One owner per thread.** Requests to others always go to a waiting-for list with the exact place to check and a reminder date.
4. **Read the whole transcript.** Automatic meeting summaries miss numbers and commitments.
5. **Measure value, not runs.** A weekly review rates each agent (useful, so-so, not useful, didn't run) and agents that don't earn their keep are retired.
6. **Separate desks, shared method.** Each desk has its own context file with absolute rules (constraints) and habits (conventions); patterns move between desks only anonymized.
7. **Small, reviewable changes.** Agents are markdown in Git; every change is a commit.
