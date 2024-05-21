import { app, EventGridEvent, InvocationContext } from "@azure/functions";
import OpenAI from "openai";
import { MessageResponse } from "../models/MessageResponse";
import { processOpenAIMessage } from "../openAIHandler";

export async function messageProcessor(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  if (event.eventType === "Message.Slack") {
    context.log("Incomming Slack Message: ", event);
    await processSlackMessage(event, context);
  } else {
    context.log("Don't know how to process this event: ", event);
  }
}

const processSlackMessage = async (
  event: EventGridEvent,
  context: InvocationContext
) => {
  /// Process
  const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
  });
  const thread = await openai.beta.threads.createAndRunPoll(
    {
      assistant_id: event.data.assistant_id.toString(),
      instructions: "",
      thread: {
        messages: [
          {
            role: "user",
            content: event.data.message.toString(),
          },
        ],
      },
    },
    { pollIntervalMs: 300 }
  );
  const messageResponse: MessageResponse[] = [];

  if (thread.status === "completed") {
    const messages = await openai.beta.threads.messages.list(thread.thread_id);
    for (const message of messages.data.slice(
      0,
      messages.data.findIndex((m) => m.role === "user")
    )) {
      // Gets all messages from the assistant since last user message
      if (message.content[0].type === "text") {
        messageResponse.push(processOpenAIMessage(message, ""));
      }
    }
  } else {
    context.error(thread.status);
    throw new Error("OpenAI request failed");
  }

  await fetch(event.data.response_url.toString(), {
    method: "POST",
    body: JSON.stringify({
      response_type: "in_channel",
      replace_original: true,
      text:
        messageResponse.map((r) => r.message).join("\n") +
        ". If this solved your question give the message a  :white_tick:",
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  })
    .then((response) => context.log("Processed Slack Message"))
    .catch((error) => {
      context.log(error);
    });
};

app.eventGrid("messageProcessor", {
  handler: messageProcessor,
});
