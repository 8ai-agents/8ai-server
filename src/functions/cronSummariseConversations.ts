import { app, InvocationContext, Timer } from "@azure/functions";
import { db, getFullConversation } from "../DatabaseController";
import OpenAI from "openai";
import { ConversationStatusType, MessageCreatorType } from "../models/Database";
import { TextContentBlock } from "openai/resources/beta/threads/messages";
import {
  AzureKeyCredential,
  TextAnalysisClient,
  SentimentAnalysisSuccessResult,
  SentimentAnalysisResult,
} from "@azure/ai-language-text";
import { sendNegativeSentimentWarning } from "../OneSignalHandler";

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
    .select([
      "id",
      "organisation_id",
      "last_message_at",
      "summary",
      "sentiment",
    ])
    .execute();

  const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
  });
  const sentimentClient = new TextAnalysisClient(
    "https://8ai-conversation-summarisation.cognitiveservices.azure.com/",
    new AzureKeyCredential(process.env.AZURE_CONGNITIVE_SERVICE_KEY)
  );

  for (const {
    id,
    organisation_id,
    sentiment: currentSentiment,
  } of conversations.filter(
    (c) =>
      !c.summary ||
      (c.last_message_at <= tenMinutesAgo &&
        c.last_message_at >= twentyMinutesAgo)
  )) {
    context.log(`Summarising Conversation ${id}`);

    let summary = "";
    let sentiment = 0;
    try {
      // Summarise
      const organisation = organisationsAssistants.find(
        (o) => o.id === organisation_id
      );

      summary = await summariseConversation(
        openai,
        id,
        organisation?.assistant_id
      );
    } catch (error: unknown) {
      const err = error as Error;
      context.error(
        `Summarising Conversation Error ${id} - ${JSON.stringify(err.message)}`
      );
      summary = "Can't summarise this conversation at the moment.";
    }

    try {
      // Sentiment
      const messages = await db
        .selectFrom("messages")
        .where("conversation_id", "=", id)
        .where("creator", "=", MessageCreatorType.CONTACT)
        .select(["message", "created_at"])
        .orderBy("created_at", "desc")
        .limit(10)
        .execute();

      const results: SentimentAnalysisResult[] = await sentimentClient.analyze(
        "SentimentAnalysis",
        messages.map((m) => m.message)
      );

      const successResults = results.filter(
        (r) => r.error === undefined
      ) as SentimentAnalysisSuccessResult[];

      // Int where negative means more is negative than positive, prioritises negative sentiment and more recent messages
      sentiment = successResults
        .map(
          (r, i) =>
            (r.confidenceScores.positive + r.confidenceScores.negative * -2) *
            (4 / (i + 4))
        )
        .reduce((a, b) => a + b, 0);

      context.log(`NPS Sentiment for Conversation ${id}: ${sentiment}`);

      if (sentiment < 0 && (currentSentiment >= 0 || !currentSentiment)) {
        // Send warning
        context.log(
          `Sending Negative Sentiment Warning for Conversation ${id}`
        );
        const fullConversation = await getFullConversation(id);
        await sendNegativeSentimentWarning(
          organisation_id,
          fullConversation,
          context
        );
      }
    } catch (error: unknown) {
      context.error(
        `Error getting NPS Sentiment for Conversation ${id} - ${JSON.stringify(
          (error as Error).message
        )}`
      );
    }

    await db
      .updateTable("conversations")
      .set({ summary, sentiment })
      .where("id", "=", id)
      .execute();

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

const summariseConversation = async (
  openai: OpenAI,
  conversation_id: string,
  assistant_id: string
) => {
  const thread_id = conversation_id.replace("conv_", "thread_");

  await openai.beta.threads.messages.create(thread_id, {
    role: "assistant",
    content:
      "Please summarise in one line the conversation so far, what is it about, and if the customer's request been resolved",
  });

  let run = await openai.beta.threads.runs.create(thread_id, {
    assistant_id: assistant_id,
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
      return content.text.value;

      // Save summary to database
    } else if (run.status === "failed") {
      throw `Summarising Conversation Failed ${conversation_id} - ${JSON.stringify(
        run.last_error
      )}`;
    }
  }
};

app.timer("cronSummariseConversations", {
  schedule: "0 */10 * * * *", // Every 10 minutes
  runOnStartup: false,
  handler: cronSummariseConversations,
});
