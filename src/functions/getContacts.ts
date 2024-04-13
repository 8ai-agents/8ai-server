import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { ContactResponse } from "../models/ContactResponse";
import { db } from "../DatabaseController";

export async function getContacts(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const email = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  context.log(`Get Contacts`);

  const contactData = await db.selectFrom("contacts").selectAll().execute();
  const results: ContactResponse[] = contactData.map((d) => {
    return {
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone,
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
