import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { ContactResponse } from "../models/ContactResponse";
import { db } from "../DatabaseController";
import { checkUserIsAdmin } from "../Utils";

export async function getContacts(
  request: HttpRequest,
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
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin(org_id, email)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  context.log(`Get Contacts`);

  const contactData = await db
    .selectFrom("contacts")
    .where("organisation_id", "=", org_id)
    .selectAll()
    .execute();
  const results: ContactResponse[] = contactData.map((d) => {
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      updated_at: d.updated_at,
      conversations: undefined,
    };
  });

  return { status: 200, jsonBody: results };
}

app.http("getContacts", {
  methods: ["GET"],
  route: "contacts",
  authLevel: "anonymous",
  handler: getContacts,
});
