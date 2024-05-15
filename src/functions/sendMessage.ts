import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { MessageRequest } from "../models/MessageRequest";
import OpenAI from "openai";
import { MessageResponse } from "../models/MessageResponse";
import {
  ConversationStatusType,
  MessageCreatorType,
  NewMessage,
} from "../models/Database";
import { db } from "../DatabaseController";

export async function sendMessage(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY,
    });
    const messageRequest = (await request.json()) as MessageRequest;
    context.log(
      `Processing message for conversation ${messageRequest.conversation_id}`,
    );
    const { interrupted, assistant_id } = await db
      .selectFrom("conversations")
      .innerJoin(
        "organisations",
        "conversations.organisation_id",
        "organisations.id",
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
        messageRequest.creator,
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
        "thread_",
      );
      await openai.beta.threads.messages.create(thread_id, {
        role: "user",
        content: messageRequest.message,
      });

      let run = await openai.beta.threads.runs.createAndPoll(
        thread_id,
        {
          assistant_id,
          instructions: "",
        },
        { pollIntervalMs: 1000 },
      );

      const messageResponse: MessageResponse[] = [];

      if (run.status === "completed") {
        const messages = await openai.beta.threads.messages.list(run.thread_id);
        for (const message of messages.data.slice(
          0,
          messages.data.findIndex((m) => m.role === "user"),
        )) {
          // Gets all messages from the assistant since last user message
          if (message.content[0].type === "text") {
            messageResponse.push(
              new MessageResponse(
                messageRequest.conversation_id,
                message.content[0].text.value,
                MessageCreatorType.AGENT,
                message.created_at * 1000,
              ),
            );
          }
        }
      } else {
        context.error(run.status);
        return {
          status: 500,
          jsonBody: {
            error: "Failed to send message",
          },
        };
      }

      // Save message to database
      await saveMessageToDatabase(newMessageRequest, messageResponse, false);

      return {
        status: 200,
        jsonBody: messageResponse,
      };
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
  requestToSave: NewMessage,
  responses: MessageResponse[] | undefined,
  setInterrupted: boolean,
) => {
  const responsesToSave: NewMessage[] = responses
    ? responses.map((r) => {
        return {
          ...r,
        } as NewMessage;
      })
    : undefined;
  return Promise.all([
    db
      .insertInto("messages")
      .values(
        responsesToSave ? [requestToSave, ...responsesToSave] : [requestToSave],
      )
      .execute(),
    setInterrupted
      ? db
          .updateTable("conversations")
          .set({
            last_message_at: responsesToSave
              ? Math.max(...responsesToSave.map((r) => r.created_at))
              : requestToSave.created_at,
            status: ConversationStatusType.OPEN,
            interrupted: true,
          })
          .where("id", "=", requestToSave.conversation_id)
          .execute()
      : db
          .updateTable("conversations")
          .set({
            last_message_at: responsesToSave
              ? Math.max(...responsesToSave.map((r) => r.created_at))
              : requestToSave.created_at,
            status: ConversationStatusType.OPEN,
          })
          .where("id", "=", requestToSave.conversation_id)
          .execute(),
  ]);
};

app.http("sendMessage", {
  methods: ["POST"],
  route: "chat",
  authLevel: "anonymous",
  handler: sendMessage,
});
