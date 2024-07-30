import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { OrganisationFileUpdate, RefreshFrequency } from "../models/Database";
import { db, getOrganisationFileResponse } from "../DatabaseController";
import { checkUserIsAdmin } from "../Utils";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import { updateAssistantFile } from "../OpenAIHandler";

export async function updateOrganisationFile(
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
    if (!checkUserIsAdmin(org_id, email, false)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    const newFileRequest = (await request.json()) as OrganisationFileRequest;
    newFileRequest.organisation_id = org_id;

    const fileToUpdate: OrganisationFileUpdate = await db
      .selectFrom("organisation_files")
      .where("id", "=", newFileRequest.id)
      .selectAll()
      .executeTakeFirstOrThrow();
    if (!fileToUpdate || fileToUpdate.organisation_id !== org_id) {
      return {
        status: 400,
        jsonBody: {
          error: "Organisations File ID mismatch",
        },
      };
    }

    context.log(
      `Updating organisation File for ${fileToUpdate.id} ${newFileRequest.name}`
    );

    // Update fields
    fileToUpdate.name = newFileRequest.name;
    fileToUpdate.url = newFileRequest.url;
    fileToUpdate.content = newFileRequest.content
      ? newFileRequest.content
      : fileToUpdate.content;
    fileToUpdate.refresh_frequency = newFileRequest.refresh_frequency;

    if (newFileRequest.refresh_frequency != RefreshFrequency.NEVER) {
      // We need to refresh this
      // TODO
    }

    // Save to OpenAI
    fileToUpdate.openai_id = await updateAssistantFile(fileToUpdate);

    await db
      .updateTable("organisation_files")
      .set(fileToUpdate)
      .where("id", "=", fileToUpdate.id)
      .execute();

    return {
      status: 200,
      jsonBody: await getOrganisationFileResponse(fileToUpdate.id),
    };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't create organisation file`,
      },
    };
  }
}

app.http("updateOrganisationFile", {
  methods: ["PUT"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: updateOrganisationFile,
});
