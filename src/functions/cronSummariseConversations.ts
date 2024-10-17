import { app, InvocationContext, Timer } from "@azure/functions";
import { db, getFullConversation } from "../DatabaseController";
import { ConversationStatusType, MessageCreatorType } from "../models/Database";
import { TextContentBlock } from "openai/resources/beta/threads/messages";
import {
  AzureKeyCredential,
  TextAnalysisClient,
  SentimentAnalysisSuccessResult,
  SentimentAnalysisResult,
} from "@azure/ai-language-text";
import { ConversationResponse } from "../models/ConversationResponse";
import { sendNegativeSentimentWarning } from "../OneSignalHandler";
import { createAzureOpenAIClient } from "../OpenAIHandler";
import { AzureOpenAI } from "openai";

export async function cronSummariseConversations(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const organisationsAssistants = await db
    .selectFrom("organisations")
    .select(["id", "assistant_id", "auto_close_conversations"])
    .execute();
  const allConversationIDs = await db
    .selectFrom("conversations")
    .select(["id"])
    .where("status", "!=", ConversationStatusType.DRAFT)
    .where((w) =>
      w.or([
        w("last_summarisation_at", "is", null),
        w("last_summarisation_at", "<", w.ref("last_message_at")),
      ])
    )
    .execute();

  const openai = createAzureOpenAIClient();
  const sentimentClient = new TextAnalysisClient(
    "https://8ai-conversation-summarisation.cognitiveservices.azure.com/",
    new AzureKeyCredential(process.env.AZURE_COGNITIVE_SERVICE_KEY)
  );

  context.log(`Summarising ${allConversationIDs.length} Conversations`);
  for (const { id: conv_id } of allConversationIDs) {
    try {
      context.log(`Summarising Conversation ${conv_id}`);
      const fullConversation = await getFullConversation(conv_id);
      const organisation = organisationsAssistants.find(
        (o) => o.id === fullConversation.organisation_id
      );

      const result = await Promise.all([
        processSummarisation(
          conv_id,
          organisation.assistant_id,
          openai,
          context
        ),
        processSentiment(fullConversation, sentimentClient, context),
      ]);

      fullConversation.summary = result[0];
      fullConversation.sentiment = result[1];
      // Can't do two thread runs at the same time
      fullConversation.resolution_estimation = await processResultionAnalysis(
        conv_id,
        organisation.assistant_id,
        openai,
        context
      );

      await db
        .updateTable("conversations")
        .set({
          summary: fullConversation.summary,
          sentiment: fullConversation.sentiment,
          resolution_estimation: fullConversation.resolution_estimation,
          last_summarisation_at: Date.now(),
          status:
            organisation.auto_close_conversations &&
            fullConversation.resolution_estimation &&
            fullConversation.resolution_estimation >= 70
              ? ConversationStatusType.CLOSED
              : fullConversation.status,
        })
        .where("id", "=", conv_id)
        .execute();

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: unknown) {
      context.error(
        `Error Summarising Conversation ${conv_id} - ${JSON.stringify(
          (error as Error).message
        )}`
      );
    }
  }
}

const processSummarisation = async (
  conv_id: string,
  assistant_id: string,
  openai: AzureOpenAI,
  context: InvocationContext
): Promise<string> => {
  try {
    // Summarise
    const thread_id = conv_id.replace("conv_", "thread_");

    await openai.beta.threads.messages.create(thread_id, {
      role: "assistant",
      content:
        "Please summarise in one line the conversation so far, what is it about, and if the customer's request been resolved",
    });

    const run = await openai.beta.threads.runs.createAndPoll(
      thread_id,
      {
        assistant_id,
      },
      { pollIntervalMs: 500 }
    );

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(run.thread_id, {
        limit: 1,
      });
      const content = messages.data[0].content.find(
        (c) => c.type === "text"
      ) as TextContentBlock;
      return content.text.value;
    } else {
      context.error(run.status);
      if (run.last_error) {
        context.error(
          `Summarise content - last error: ${run.last_error.code}: ${run.last_error.message}`
        );
      }
      return "Can't summarise this conversation at the moment.";
    }
  } catch (error: unknown) {
    const err = error as Error;
    context.error(
      `Summarising Conversation Error ${conv_id} - ${JSON.stringify(
        err.message
      )}`
    );
    return "Can't summarise this conversation at the moment.";
  }
};

const processSentiment = async (
  conversation: ConversationResponse,
  sentimentClient: TextAnalysisClient,
  context: InvocationContext
): Promise<number | undefined> => {
  try {
    // Messages ordered by most recent desc
    const orderedMessages = conversation.messages
      .filter((m) => m.creator === MessageCreatorType.CONTACT)
      .sort((a, b) => b.created_at - b.created_at)
      .slice(0, 10);

    const results: SentimentAnalysisResult[] = await sentimentClient.analyze(
      "SentimentAnalysis",
      orderedMessages.map((m) => m.message)
    );

    const successResults = results.filter(
      (r) => r.error === undefined
    ) as SentimentAnalysisSuccessResult[];

    // Int where negative means more is negative than positive, prioritises negative sentiment and more recent messages
    const result = successResults
      .map(
        (r, i) =>
          (r.confidenceScores.positive + r.confidenceScores.negative * -2) *
          (4 / (i + 4))
      )
      .reduce((a, b) => a + b, 0);

    if (
      result < -1.5 &&
      (conversation.sentiment > -1.5 || !conversation.sentiment)
    ) {
      // Send warning
      context.log(
        `Sending Negative Sentiment Warning for Conversation ${conversation.id}`
      );
      conversation.sentiment = result;
      await sendNegativeSentimentWarning(conversation, context);
    }
    return result;
  } catch (error: unknown) {
    context.error(
      `Error getting NPS Sentiment for Conversation ${
        conversation.id
      } - ${JSON.stringify((error as Error).message)}`
    );
    return undefined;
  }
};

const processResultionAnalysis = async (
  conv_id: string,
  assistant_id: string,
  openai: AzureOpenAI,
  context: InvocationContext
): Promise<number | undefined> => {
  try {
    const thread_id = conv_id.replace("conv_", "thread_");

    await openai.beta.threads.messages.create(thread_id, {
      role: "assistant",
      content:
        "Please rate the resolution of the customer's request as an integer, where 1 is not resolved at all and 100 is fully and completely resolved. Return only a single integer in your response",
    });

    const run = await openai.beta.threads.runs.createAndPoll(
      thread_id,
      {
        assistant_id,
      },
      { pollIntervalMs: 500 }
    );

    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(run.thread_id, {
        limit: 1,
      });
      const content = messages.data[0].content.find(
        (c) => c.type === "text"
      ) as TextContentBlock;
      return parseInt(content.text.value);
    } else {
      context.error(run.status);
      if (run.last_error) {
        context.error(
          `Resolution analysis - last error: ${run.last_error.code}: ${run.last_error.message}`
        );
      }
      return undefined;
    }
  } catch (error: unknown) {
    const err = error as Error;
    context.error(
      `Resolution analysis Error ${conv_id} - ${JSON.stringify(err.message)}`
    );
    return undefined;
  }
};

app.timer("cronSummariseConversations", {
  schedule: "0 */10 * * * *", // Every 10 minutes
  runOnStartup: false,
  handler: cronSummariseConversations,
});
