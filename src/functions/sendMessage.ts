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
      apiKey: process.env.OPEN_API_KEY,
    });
    const messageRequest = (await request.json()) as MessageRequest;
    context.log(
      `Processing message for conversation ${messageRequest.conversation_id}`
    );
    const { interrupted, assistant_id } = await db
      .selectFrom("conversations")
      .innerJoin(
        "organisations",
        "conversations.organisation_id",
        "organisations.id"
      )
      .where("conversations.id", "=", messageRequest.conversation_id)
      .select([
        "conversations.id",
        "conversations.interrupted",
        "organisations.assistant_id",
      ])
      .executeTakeFirst();

    const newMessageRequest: NewMessage = {
      ...new MessageResponse(
        messageRequest.conversation_id,
        messageRequest.message,
        messageRequest.creator
      ),
      created_at: Date.now(),
      // TODO set user ID user_id
    };

    if (interrupted || messageRequest.creator === "USER") {
      // interrupted by a user, AI should not process
      // Save message to database
      await saveMessageToDatabase(newMessageRequest, undefined, true);
      return {
        status: 200,
      };
    } else {
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
          const newMessageResponse: NewMessage = {
            ...response,
          };
          await saveMessageToDatabase(
            newMessageRequest,
            newMessageResponse,
            false
          );

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
    }
  } catch (error) {
    context.error(`Error sending message: ${error}`);

    return {
      status: 500,
      jsonBody: {
        error: "Failed to send message",
      },
    };
  }
}

const saveMessageToDatabase = (
  request: NewMessage,
  response: NewMessage | undefined,
  setInterrupted: boolean
) => {
  return Promise.all([
    db
      .insertInto("messages")
      .values(response ? [request, response] : [request])
      .execute(),
    setInterrupted
      ? db
          .updateTable("conversations")
          .set({
            last_message_at: response
              ? response.created_at
              : request.created_at,
            status: "OPEN",
            interrupted: true,
          })
          .where("id", "=", request.conversation_id)
          .execute()
      : db
          .updateTable("conversations")
          .set({
            last_message_at: response
              ? response.created_at
              : request.created_at,
            status: "OPEN",
          })
          .where("id", "=", request.conversation_id)
          .execute(),
  ]);
};

app.http("sendMessage", {
  methods: ["POST"],
  route: "chat",
  authLevel: "anonymous",
  handler: sendMessage,
});
