import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db } from "../DatabaseController";
import { checkUserIsAdmin } from "../Utils";
import { ContactMetadataResponse } from "../models/ContactMetadataResponse";

export async function getContactMetadata(
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
  context.log(`Get Contact Metadata ${cont_id}`);
  const contactData = await db
    .selectFrom("contacts")
    .where("id", "=", cont_id)
    .selectAll()
    .executeTakeFirst();

  // They need to be an admin of the organisation
  if (!checkUserIsAdmin(contactData.organisation_id, email))
    return { status: 403 };

  if (contactData) {
    const jsonBody: ContactMetadataResponse = {
      ...contactData,
      contact_id: contactData.id,
    };
    return { status: 200, jsonBody };
  } else {
    return {
      status: 404,
      jsonBody: {
        error: "Contact not found",
      },
    };
  }
}

app.http("getContactMetadata", {
  methods: ["GET"],
  route: "contacts/{cont_id}/metadata",
  authLevel: "anonymous",
  handler: getContactMetadata,
});
