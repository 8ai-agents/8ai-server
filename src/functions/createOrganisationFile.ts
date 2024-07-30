import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { NewOrganisationFile, RefreshFrequency } from "../models/Database";
import { db, getOrganisationFileResponse } from "../DatabaseController";
import { checkUserIsAdmin, createID } from "../Utils";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import { createAssistantFile } from "../OpenAIHandler";

export async function createOrganisationFile(
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

  // Check if there is space (limit of 100 files)
  const allIDs = await db
    .selectFrom("organisation_files")
    .where("organisation_id", "=", org_id)
    .select("id")
    .execute();
  if (allIDs.length >= 100) {
    return {
      status: 400,
      jsonBody: {
        error: `You are already at the maximum amount of organisation files, please delete one other`,
      },
    };
  }

  try {
    const fileRequest = (await request.json()) as OrganisationFileRequest;
    fileRequest.organisation_id = org_id;

    context.log(`Creating organisation File for ${org_id} ${fileRequest.name}`);
    const fileToSave: NewOrganisationFile = {
      id: createID("file"),
      openai_id: "",
      organisation_id: org_id,
      name: fileRequest.name,
      url: fileRequest.url,
      content: fileRequest.content,
      refresh_frequency: fileRequest.refresh_frequency,
      last_refreshed: undefined,
    };

    if (fileRequest.refresh_frequency != RefreshFrequency.NEVER) {
      // We need to refresh this
      // TODO
    }

    // Save to OpenAI
    fileToSave.openai_id = await createAssistantFile(fileToSave);

    await db
      .insertInto("organisation_files")
      .values(fileToSave)
      .executeTakeFirst();

    return {
      status: 200,
      jsonBody: await getOrganisationFileResponse(fileToSave.id),
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

app.http("createOrganisationFile", {
  methods: ["POST", "OPTIONS"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: createOrganisationFile,
});
