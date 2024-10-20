import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import {
  OrganisationFileResponse,
  OrganisationFileTrainingStatuses,
} from "../models/OrganisationFileResponse";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import { OrganisationFileToUpdate } from "../models/Database";
import { updateFile } from "../OpenAIHandler";

export async function updateOrganisationFile(
  request: HttpRequest,
  context: InvocationContext,
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

  if (fileRequest.url) {
    // URLs should generally be unique, so if this is set we check that there is not another already with it
    const existingURls = await db
      .selectFrom("organisation_files")
      .select(["id", "name", "url"])
      .where("organisation_id", "=", org_id)
      .where("id", "!=", existingFileToUpdate.id)
      .where("url", "is not", null)
      .execute();
    if (
      existingURls.some(
        (f) => f.url.toLowerCase() === fileRequest.url.toLowerCase(),
      )
    ) {
      return {
        status: 400,
        jsonBody: {
          error: `There is another file ${
            existingURls.find(
              (f) => f.url.toLowerCase() === fileRequest.url.toLowerCase(),
            ).name
          } already with this URL`,
        },
      };
    }
  }

  context.log(
    `Update Organisation File for ${org_id} ${existingFileToUpdate.id}`,
  );

  existingFileToUpdate.updated_at = Date.now();
  existingFileToUpdate.name = fileRequest.name;
  existingFileToUpdate.url = fileRequest.url.toLowerCase();
  existingFileToUpdate.content = fileRequest.content;

  // Create or update in openAI
  let training_status: OrganisationFileTrainingStatuses =
    OrganisationFileTrainingStatuses.NOT_SYNCED;
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
        context,
      );
      training_status = OrganisationFileTrainingStatuses.IN_PROGRESS;
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

    const jsonBody: OrganisationFileResponse = {
      ...(await db
        .selectFrom("organisation_files")
        .selectAll()
        .where("organisation_id", "=", org_id)
        .where("id", "=", existingFileToUpdate.id)
        .executeTakeFirst()),
      training_status,
    };
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
