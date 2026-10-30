# Agent: meeting capture

## Purpose
After every customer or team call, turn the recording into updated account files, so nothing said in a meeting depends on memory.

## Sources
Meeting recorder transcripts (Fathom, Otter, Gemini notes or similar), or notes pasted by the human.

## Steps
1. Read the **full transcript**. The automatic summary is only an index; decisions and numbers are checked against the transcript.
2. Extract:
   - decisions taken,
   - commitments, each with owner and date,
   - risks and blockers, especially those that depend on someone outside the team,
   - customer feedback on the product, kept separate from requests.
3. Update the project or account file, the people file for each stakeholder, the week log and, if there is a new risk, the signals file.
4. Add every request made to someone else to the reply watcher list.
5. Prepare the follow-up message (after-call summary) for approval.

## Rules
- Terms the transcription is unsure about are not copied as facts; mark them as unconfirmed.
- Technical questions from the customer go to the engineer who owns them; the agent never answers them by inference.
