import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db } from "../DatabaseController";
import { ContactResponse } from "../models/ContactResponse";

export async function getContact(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const email = await authenticateRequest(request);
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

  if (contactData) {
    const conversationData = await db
      .selectFrom("conversations")
      .where("contact_id", "=", cont_id)
      .where("status", "!=", "DRAFT")
      .selectAll()
      .execute();
    const result: ContactResponse = {
      id: contactData.id,
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      conversations: conversationData.map((d) => {
        return {
          id: d.id,
          contact_name: contactData.name,
          created_at: d.created_at,
          last_message_at: d.last_message_at,
          status: d.status,
          summary: d.summary,
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
