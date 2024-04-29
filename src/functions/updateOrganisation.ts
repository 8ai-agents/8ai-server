import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { OrganisationUpdate, UserRoleType } from "../models/Database";
import { OrganisationRequest } from "../models/OrganisationRequest";
import { db, getOrganisation } from "../DatabaseController";

export async function updateOrganisation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { role } = await authenticateRequest(request);
    if (role != UserRoleType.SUPER_ADMIN) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    const organisationRequest = (await request.json()) as OrganisationRequest;
    if (!organisationRequest.id) {
      return {
        status: 400,
        jsonBody: {
          error: `You must provide an organisation ID to update`,
        },
      };
    }
    const orgToUpdate: OrganisationUpdate = await getOrganisation(
      organisationRequest.id
    );

    context.log(`Updating organisation ${orgToUpdate.id}`);

    // Update fields
    orgToUpdate.name = organisationRequest.name;
    orgToUpdate.assistant_id = organisationRequest.assistant_id;
    orgToUpdate.description = organisationRequest.description;
    orgToUpdate.logo_url = organisationRequest.logo_url;
    orgToUpdate.website = organisationRequest.website;

    await db
      .updateTable("organisations")
      .where("id", "=", orgToUpdate.id)
      .execute();

    const jsonBody = await getOrganisation(orgToUpdate.id);
    return { status: 200, jsonBody };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't update organisation`,
      },
    };
  }
}

app.http("updateOrganisation", {
  methods: ["PUT"],
  route: "organisations",
  authLevel: "anonymous",
  handler: updateOrganisation,
});
