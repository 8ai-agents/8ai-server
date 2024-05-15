import { app, InvocationContext, Timer } from "@azure/functions";
import { db } from "../DatabaseController";
import OpenAI from "openai";
import { ConversationStatusType } from "../models/Database";
import { TextContentBlock } from "openai/resources/beta/threads/messages";

export async function cronSummariseConversations(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Summarising Conversations");

  const tenMinutesAgo: number = Date.now() - 1000 * 60 * 10; // More than 10 minutes ago
  const twentyMinutesAgo: number = Date.now() - 1000 * 60 * 20; // More than 10 minutes ago
  const organisationsAssistants = await db
    .selectFrom("organisations")
    .select(["id", "assistant_id"])
    .execute();
  const conversations = await db
    .selectFrom("conversations")
    .where("status", "!=", ConversationStatusType.DRAFT)
    .select(["id", "organisation_id", "last_message_at", "summary"])
    .execute();

  for (const { id, organisation_id } of conversations.filter(
    (c) =>
      !c.summary ||
      (c.last_message_at <= tenMinutesAgo &&
        c.last_message_at >= twentyMinutesAgo)
  )) {
    context.log(`Summarising Conversation ${id}`);

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPEN_API_KEY,
      });
      const organisation = organisationsAssistants.find(
        (o) => o.id === organisation_id
      );
      const thread_id = id.replace("conv_", "thread_");

      await openai.beta.threads.messages.create(thread_id, {
        role: "assistant",
        content:
          "Please summarise in one line the conversation so far, what is it about, and if the customer's request been resolved",
      });

      let run = await openai.beta.threads.runs.create(thread_id, {
        assistant_id: organisation.assistant_id,
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
          context.error(
            `Summarising Conversation Failed ${id} - ${JSON.stringify(
              run.last_error
            )}`
          );
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error: unknown) {
      const err = error as Error;
      context.error(
        `Summarising Conversation Error ${id} - ${JSON.stringify(err.message)}`
      );
    }
  }
}

app.timer("cronSummariseConversations", {
  //schedule: "* * * * *", // Every minute for testing
  schedule: "0 */10 * * * *", // Every 10 minutes
  handler: cronSummariseConversations,
});
