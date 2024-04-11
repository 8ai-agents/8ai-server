import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { MessageRequest } from "../models/MessageRequest";
import OpenAI from "openai";
import { TextContentBlock } from "openai/resources/beta/threads/messages/messages";
import { MessageResponse } from "../models/MessageResponse";
import { NewMessage } from "../models/Database";
import { db } from "../DatabaseController";

export async function sendMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const openai = new OpenAI({
      apiKey: "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",
    });
    const assistant_id = "asst_tRM0YNhdHurVz0QyGeWgtVQK";
    const messageRequest = (await request.json()) as MessageRequest;
    context.log(
      `Processing message for conversation ${messageRequest.conversation_id}`
    );
    const thread_id = messageRequest.conversation_id.replace(
      "conv_",
      "thread_"
    );

    await openai.beta.threads.messages.create(thread_id, {
      role: "user",
      content: messageRequest.message,
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
        const response: MessageResponse = new MessageResponse(
          messageRequest.conversation_id,
          content.text.value,
          "AGENT"
        );

        // Save message to database
        const newMessageRequest: NewMessage = {
          ...new MessageResponse(
            messageRequest.conversation_id,
            messageRequest.message,
            "CONTACT"
          ),
          created_at: response.created_at - 1,
        };
        const newMessageResponse: NewMessage = {
          ...response,
        };
        await Promise.all([
          db
            .insertInto("messages")
            .values([newMessageRequest, newMessageResponse])
            .execute(),
          db
            .updateTable("conversations")
            .set({
              last_message_at: newMessageResponse.created_at,
              status: "OPEN",
            })
            .where("id", "=", messageRequest.conversation_id)
            .execute(),
        ]);

        return {
          status: 200,
          jsonBody: response,
        };
      } else if (run.status === "failed") {
        context.error(run.last_error);
        return {
          status: 500,
          jsonBody: {
            error: "Failed to send message",
          },
        };
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    context.error(`Error sending message: ${err.message}`);

    return {
      status: 500,
      jsonBody: {
        error: "Failed to send message",
      },
    };
  }
}

app.http("sendMessage", {
  methods: ["POST"],
  route: "chat",
  authLevel: "anonymous",
  handler: sendMessage,
});
