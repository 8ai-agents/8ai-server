import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { MessageRequest } from "../models/MessageRequest";
import { MessageResponse } from "../models/MessageResponse";
import { ConversationStatusType, NewMessage } from "../models/Database";
import { db } from "../DatabaseController";
import { handleMessageForOpenAI } from "../openAIHandler";

export async function sendMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const messageRequest = (await request.json()) as MessageRequest;
    context.log(
      `Processing message for conversation ${messageRequest.conversation_id}`
    );
    const { interrupted, assistant_id, contact_id } = await db
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
        "conversations.contact_id",
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
      const responses = await handleMessageForOpenAI(
        messageRequest,
        assistant_id,
        contact_id,
        context
      );

      // Save message to database
      await saveMessageToDatabase(newMessageRequest, responses, false);

      return {
        status: 200,
        jsonBody: responses,
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
  setInterrupted: boolean
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
        responsesToSave ? [requestToSave, ...responsesToSave] : [requestToSave]
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
