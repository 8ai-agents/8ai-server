import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ContactRequest } from "../models/ContactRequest";
import { db } from "../DatabaseController";
import { ContactResponse } from "../models/ContactResponse";

export async function updateContactDetails(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const contactRequest = (await request.json()) as ContactRequest;
    context.log(`Processing update for contact ${contactRequest.id}`);

    const result: ContactResponse = {
      ...(await db
        .updateTable("contacts")
        .set({
          name: contactRequest.name,
          email: contactRequest.email,
          phone: contactRequest.phone,
          updated_at: Date.now(),
        })
        .where("id", "=", contactRequest.id)
        .returning(["id", "name", "email", "phone", "updated_at"])
        .executeTakeFirst()),
      conversations: undefined,
    };

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error(`Error updating contact: ${error}`);

    return {
      status: 500,
      jsonBody: {
        error: "Failed to update contact",
      },
    };
  }
}

app.http("updateContactDetails", {
  methods: ["PUT"],
  route: "contacts",
  authLevel: "anonymous",
  handler: updateContactDetails,
});
