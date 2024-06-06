import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
// import OpenAI from "openai";
// import type { FormDataEntryValue } from "undici";
// // import { handleMessageForOpenAI, processOpenAIMessage } from "../openAIHandler";
// import { MessageCreatorType, NewMessage } from "../models/Database";
// import { MessageRequest } from "../models/MessageRequest";
// import { MessageResponse } from "../models/MessageResponse";

export async function sendMessageSlackNew(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const messageRequest = await request.json();
  if (messageRequest["type"] === "url_verification") {
    return {
      status: 200,
      jsonBody: {
        challenge: messageRequest["challenge"],
      },
    };
  }
  return;

  /**let data: FormDataEntryValue | null = formData.get("text");
  if (data && typeof data == "string") {
    context.log(`Processing message from Slack ${data}`);
    const openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY,
    });
    const assistant_id = "asst_rkDgpBkruW7HZqC0wwesebY2";
    const thread = await openai.beta.threads.createAndRunPoll(
      {
        assistant_id,
        instructions: "",
        thread: {
          messages: [
            {
              role: "user",
              content: data,
            },
          ],
        },
      },
      { pollIntervalMs: 300 }
    );
    const messageResponse: MessageResponse[] = [];

    if (thread.status === "completed") {
      const messages = await openai.beta.threads.messages.list(
        thread.thread_id
      );
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
    return {
      status: 200,
      jsonBody: {
        response_type: "in_channel",
        text: messageResponse.map((r) => r.message).join("\n"),
      },
    };
  }

  return {
    status: 500,
    jsonBody: {
      error: "Failed to send message",
    },
  }; */
}

app.http("sendMessageSlackNew", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "/chat/slack/new",
  handler: sendMessageSlackNew,
});
