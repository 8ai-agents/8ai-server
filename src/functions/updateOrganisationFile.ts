import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { OrganisationFileResponse } from "../models/OrganisationFileResponse";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import { OrganisationFileToUpdate } from "../models/Database";
import { updateFile } from "../OpenAIHandler";

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

  // Authenticate
  try {
    const email = await authenticateRequest(request);
    if (!checkUserIsAdmin(org_id, email, false)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  const fileRequest = (await request.json()) as OrganisationFileRequest;

  let existingFileToUpdate: OrganisationFileToUpdate = await db
    .selectFrom("organisation_files")
    .selectAll()
    .where("organisation_id", "=", org_id)
    .where("id", "=", fileRequest.id)
    .executeTakeFirst();
  if (!existingFileToUpdate) {
    return {
      status: 404,
      jsonBody: {
        error: "Organisation file not found",
      },
    };
  }

  context.log(
    `Update Organisation File for ${org_id} ${existingFileToUpdate.id}`
  );

  existingFileToUpdate.updated_at = Date.now();
  existingFileToUpdate.name = fileRequest.name;
  existingFileToUpdate.url = fileRequest.url;
  existingFileToUpdate.content = fileRequest.content;

  // Create or update in openAI
  const { assistant_id, name: organisation_name } = await db
    .selectFrom("organisations")
    .select(["assistant_id", "name", "id"])
    .where("id", "=", org_id)
    .executeTakeFirst();
  if (assistant_id) {
    // Publish to openAI
    try {
      existingFileToUpdate = await updateFile(
        existingFileToUpdate,
        assistant_id,
        org_id,
        organisation_name,
        undefined,
        context
      );
    } catch (e) {
      context.error(`Error Publishing file to OpenAI`);
      context.error(e);
      return {
        status: 500,
        jsonBody: {
          error: "We could not submit your updated file to the AI model",
        },
      };
    }
  }

  try {
    await db
      .updateTable("organisation_files")
      .set(existingFileToUpdate)
      .where("id", "=", existingFileToUpdate.id)
      .execute();

    const jsonBody: OrganisationFileResponse = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .where("id", "=", existingFileToUpdate.id)
      .executeTakeFirst();
    return { status: 200, jsonBody };
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured updating your file",
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
