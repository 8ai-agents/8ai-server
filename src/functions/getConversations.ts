import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationsResponse } from "../models/ConversationsResponse";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { ConversationStatusType, UserRoleType } from "../models/Database";
import { checkUserIsAdmin } from "../Utils";

export async function getConversations(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const org_id = request.params.org_id as string;
  if (!org_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid organisation ID",
      },
    };
  }

  try {
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin(org_id, email)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  const data = await db
    .selectFrom("conversations")
    .innerJoin("contacts", "conversations.contact_id", "contacts.id")
    .where("conversations.organisation_id", "=", org_id)
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
  route: "{org_id}/conversations",
  authLevel: "anonymous",
  handler: getConversations,
});
