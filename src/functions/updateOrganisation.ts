import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { OrganisationUpdate, UserRoleType } from "../models/Database";
import { OrganisationRequest } from "../models/OrganisationRequest";
import { db, getOrganisation, getUser } from "../DatabaseController";
import { updateAssistantFile } from "../openAIHandler";

export async function updateOrganisation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { email } = await authenticateRequest(request);
    const user = await getUser(email);
    if (user.role != UserRoleType.SUPER_ADMIN) return { status: 403 };
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
    orgToUpdate.support_email = organisationRequest.support_email;
    orgToUpdate.support_phone = organisationRequest.support_phone;
    orgToUpdate.chat_icon_color = organisationRequest.chat_icon_color;
    orgToUpdate.chat_bubble_color = organisationRequest.chat_bubble_color;
    orgToUpdate.chat_text_color = organisationRequest.chat_text_color;
    if (organisationRequest.fine_tuning_data) {
      // Fine tuning data has been updated, update OpenAI
      orgToUpdate.fine_tuning_filename =
        organisationRequest.fine_tuning_filename;
      await updateAssistantFile(
        organisationRequest.id,
        organisationRequest.assistant_id,
        organisationRequest.fine_tuning_filename,
        organisationRequest.fine_tuning_data
      );
    }

    await db
      .updateTable("organisations")
      .set(orgToUpdate)
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
