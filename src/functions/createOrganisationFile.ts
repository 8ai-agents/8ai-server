import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin, createID } from "../Utils";
import {
  OrganisationFileResponse,
  OrganisationFileTrainingStatuses,
} from "../models/OrganisationFileResponse";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import { NewOrganisationFile } from "../models/Database";
import { createFileAndAttachToVectorStore } from "../OpenAIHandler";

export async function createOrganisationFile(
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

  if (fileRequest.url) {
    // URLs should generally be unique, so if this is set we check that there is not another already with it
    const existingURls = await db
      .selectFrom("organisation_files")
      .select(["id", "name", "url"])
      .where("organisation_id", "=", org_id)
      .where("id", "!=", fileRequest.id)
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

  context.log(`Create Organisation File for ${org_id} ${fileRequest.name}`);

  let newFile: NewOrganisationFile = {
    ...fileRequest,
    organisation_id: org_id,
    id: createID("file"),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Create in openAI
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
      newFile = await createFileAndAttachToVectorStore(
        newFile,
        assistant_id,
        org_id,
        organisation_name,
        undefined,
        context,
      );
      context.log(`Published new file to OpenAI`);
      training_status = OrganisationFileTrainingStatuses.IN_PROGRESS;
    } catch (e) {
      context.error(`Error Publishing file to OpenAI`);
      context.error(e);
      return {
        status: 500,
        jsonBody: {
          error: "We could not submit your file to the AI model",
        },
      };
    }
  }

  try {
    await db.insertInto("organisation_files").values(newFile).execute();

    const jsonBody: OrganisationFileResponse = {
      ...(await db
        .selectFrom("organisation_files")
        .selectAll()
        .where("organisation_id", "=", org_id)
        .where("id", "=", newFile.id)
        .executeTakeFirst()),
      training_status,
    };
    return { status: 200, jsonBody };
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured creating your file",
      },
    };
  }
}

app.http("createOrganisationFile", {
  methods: ["POST"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: createOrganisationFile,
});
