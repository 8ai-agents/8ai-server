import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationsResponse } from "../models/ConversationsResponse";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { ConversationStatusType } from "../models/Database";

export async function getConversations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const email = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  const data = await db
    .selectFrom("conversations")
    .innerJoin("contacts", "conversations.contact_id", "contacts.id")
    .where("status", "!=", ConversationStatusType.DRAFT)
    .select([
      "conversations.id",
      "contacts.name",
      "conversations.created_at",
      "conversations.last_message_at",
      "conversations.status",
      "conversations.summary",
    ])
    .execute();

  const results: ConversationsResponse[] = data.map((d) => {
    return {
      id: d.id,
      contact_name: d.name,
      created_at: d.created_at,
      last_message_at: d.last_message_at,
      status: d.status,
      summary: d.summary,
    };
  });

  return { status: 200, jsonBody: results };
}

app.http("getConversations", {
  methods: ["GET"],
  route: "conversations",
  authLevel: "anonymous",
  handler: getConversations,
});
