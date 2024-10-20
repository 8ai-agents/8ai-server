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
    .select([
      "id",
      "browser",
      "ip",
      "origin",
      "location_estimate_string",
      "location_estimate_lat",
      "location_estimate_lon",
      "language",
      "language_raw",
      "organisation_id",
    ])
    .executeTakeFirst();

  // They need to be an admin of the organisation
  if (!checkUserIsAdmin(contactData.organisation_id, email))
    return { status: 403 };

  if (contactData) {
    const jsonBody: ContactMetadataResponse = {
      contact_id: contactData.id,
      browser: contactData.browser,
      ip: contactData.ip,
      origin: contactData.origin,
      location_estimate_string: contactData.location_estimate_string,
      location_estimate_lat: contactData.location_estimate_lat,
      location_estimate_lon: contactData.location_estimate_lon,
      language: contactData.language,
      language_raw: contactData.language_raw,
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
