import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db } from "../DatabaseController";
import { ContactResponse } from "../models/ContactResponse";
import { ConversationStatusType } from "../models/Database";
import { checkUserIsAdmin } from "../Utils";

export async function getContact(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let email;
  try {
    email = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  const cont_id = request.params.cont_id as string;
  if (!cont_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid contact ID",
      },
    };
  }
  context.log(`Get Contact ${cont_id}`);
  const contactData = await db
    .selectFrom("contacts")
    .where("id", "=", cont_id)
    .selectAll()
    .executeTakeFirst();

  // They need to be an admin of the organisation
  if (!checkUserIsAdmin(contactData.organisation_id, email))
    return { status: 403 };

  if (contactData) {
    const conversationData = await db
      .selectFrom("conversations")
      .where("contact_id", "=", cont_id)
      .where("status", "!=", ConversationStatusType.DRAFT)
      .selectAll()
      .execute();
    const result: ContactResponse = {
      id: contactData.id,
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      updated_at: contactData.updated_at,
      created_at: contactData.created_at,
      conversations: conversationData.map((conv) => {
        return {
          id: conv.id,
          organisation_id: conv.organisation_id,
          contact_name: contactData.name,
          has_contact_details:
            contactData.email || contactData.phone ? true : false,
          created_at: conv.created_at,
          last_message_at: conv.last_message_at,
          status: conv.status,
          summary: conv.summary,
          sentiment: conv.sentiment,
          channel: conv.channel,
          resolution_estimation: conv.resolution_estimation,
          last_summarisation_at: conv.last_summarisation_at,
        };
      }),
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

app.http("getContact", {
  methods: ["GET"],
  route: "contacts/{cont_id}",
  authLevel: "anonymous",
  handler: getContact,
});
