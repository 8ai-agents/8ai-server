import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationResponse } from "../models/ConversationResponse";
import { assert } from "console";
import { db } from "../DatabaseController";
import { MessageResponse } from "../models/MessageResponse";

export async function getConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const conv_id = request.params.conv_id as string;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  context.log(`Get Conversation ${conv_id}`);

  const data = await db
    .selectFrom("conversations")
    .innerJoin("contacts", "contacts.id", "conversations.contact_id")
    .where("conversations.id", "=", conv_id)
    .select([
      "conversations.id",
      "conversations.contact_id",
      "contacts.name",
      "contacts.email",
      "contacts.phone",
      "conversations.created_at",
      "conversations.last_message_at",
      "conversations.status",
      "conversations.summary",
      "conversations.sentiment",
    ])
    .executeTakeFirst();

  if (data) {
    const messageData = await db
      .selectFrom("messages")
      .where("conversation_id", "=", conv_id)
      .selectAll()
      .execute();
    const result: ConversationResponse = {
      id: data.id,
      contact: {
        id: data.contact_id,
        name: data.name,
        email: data.email,
        phone: data.phone,
      },
      messages: messageData,
      created_at: data.created_at,
      last_message_at: data.last_message_at,
      status: data.status,
      summary: data.summary,
      sentiment: data.sentiment,
    };
    return { status: 200, jsonBody: result };
  } else {
    return {
      status: 404,
      jsonBody: {
        error: "Conversation not found",
      },
    };
  }
}

app.http("getConversation", {
  methods: ["GET"],
  route: "conversations/{conv_id}",
  authLevel: "anonymous",
  handler: getConversation,
});
