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
import { checkUserIsAdmin } from "../Utils";

export async function getConversations(
  request: HttpRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: InvocationContext
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
    const email = await authenticateRequest(request);
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
      "contacts.email",
      "contacts.phone",
      "conversations.created_at",
      "conversations.organisation_id",
      "conversations.last_message_at",
      "conversations.status",
      "conversations.summary",
      "conversations.sentiment",
      "conversations.channel",
      "conversations.resolution_estimation",
      "conversations.last_summarisation_at",
    ])
    .execute();

  const results: ConversationsResponse[] = data.map((conv) => {
    return {
      id: conv.id,
      organisation_id: conv.organisation_id,
      contact_name: conv.name,
      has_contact_details: conv.email || conv.phone ? true : false,
      created_at: conv.created_at,
      last_message_at: conv.last_message_at,
      status: conv.status,
      summary: conv.summary,
      sentiment: conv.sentiment,
      channel: conv.channel,
      resolution_estimation: conv.resolution_estimation,
      last_summarisation_at: conv.last_summarisation_at,
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
