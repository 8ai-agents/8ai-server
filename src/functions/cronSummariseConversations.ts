import { app, InvocationContext, Timer } from "@azure/functions";
import { db } from "../DatabaseController";
import OpenAI from "openai";
import { TextContentBlock } from "openai/resources/beta/threads/messages/messages";

export async function cronSummariseConversations(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Summarising Conversations");

  const tenMinutesAgo: number = Date.now() - 1000 * 60 * 10; // More than 10 minutes ago
  const twentyMinutesAgo: number = Date.now() - 1000 * 60 * 20; // More than 10 minutes ago
  const conversations = await db
    .selectFrom("conversations")
    .where("status", "!=", "DRAFT")
    .select(["id", "last_message_at", "summary"])
    .execute();

  for (const { id } of conversations.filter(
    (c) =>
      !c.summary ||
      (c.last_message_at <= tenMinutesAgo &&
        c.last_message_at >= twentyMinutesAgo)
  )) {
    context.log(`Summarising Conversation ${id}`);

    try {
      const openai = new OpenAI({
        apiKey: "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",
      });
      const assistant_id = "asst_tRM0YNhdHurVz0QyGeWgtVQK";
      const thread_id = id.replace("conv_", "thread_");

      await openai.beta.threads.messages.create(thread_id, {
        role: "assistant",
        content:
          "Please summarise in one line the conversation so far, what is it about, and has the customer's request been resolved",
      });

      let run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id,
        instructions: "",
      });

      while (["queued", "in_progress", "cancelling"].includes(run.status)) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
        run = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);

        if (run.status === "completed") {
          const messagesResponse = await openai.beta.threads.messages.list(
            run.thread_id
          );
          const content = messagesResponse.data[0].content.find(
            (c) => c.type === "text"
          ) as TextContentBlock;
          const summary = content.text.value;

          // Save summary to database
          await db
            .updateTable("conversations")
            .set({ summary })
            .where("id", "=", id)
            .execute();
        } else if (run.status === "failed") {
          context.error(`Summarising Conversation ${id} - ${run.last_error}`);
        }
      }
    } catch (error: unknown) {
      const err = error as Error;
      context.error(`Summarising Conversation ${id} - ${err.message}`);
    }
  }
}

app.timer("cronSummariseConversations", {
  //schedule: "* * * * *", // Every minute for testing
  schedule: "0 */10 * * * *", // Every 10 minutes
  handler: cronSummariseConversations,
});
