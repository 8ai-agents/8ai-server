import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db, getFullConversation } from "../DatabaseController";
import { ConversationStatusType } from "../models/Database";
import { checkUserIsAdmin } from "../Utils";

export async function updateConversationStatus(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const conv_id = request.params.conv_id as string;
  const new_status = request.params.new_status as ConversationStatusType;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  if (!new_status) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid status",
      },
    };
  }

  const { organisation_id } = await db
    .selectFrom("conversations")
    .select(["organisation_id"])
    .executeTakeFirst();

  try {
    const email = await authenticateRequest(request);
    if (!checkUserIsAdmin(organisation_id, email, false))
      return { status: 403 };
  } catch {
    return { status: 401 };
  }

  context.log(`Update Conversation Status ${conv_id}`);

  await db
    .updateTable("conversations")
    .set({ status: new_status })
    .where("id", "=", conv_id)
    .execute();

  try {
    const result = await getFullConversation(conv_id);
    return { status: 200, jsonBody: result };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Conversation not found",
      },
    };
  }
}

app.http("updateConversationStatus", {
  methods: ["PUT"],
  authLevel: "anonymous",
  route: "conversations/{conv_id}/status/{new_status}",
  handler: updateConversationStatus,
});
