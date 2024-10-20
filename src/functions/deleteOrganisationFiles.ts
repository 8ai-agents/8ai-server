import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { createAzureOpenAIClient } from "../OpenAIHandler";

export async function deleteOrganisationFiles(
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

  const { file_ids } = (await request.json()) as { file_ids: string[] };

  const existingFilesToDelete = await db
    .selectFrom("organisation_files")
    .select(["id", "openai_id"])
    .where("organisation_id", "=", org_id)
    .where("id", "in", file_ids)
    .execute();

  context.log(`Delete Organisation Files for ${org_id}`);

  const openAI = createAzureOpenAIClient();
  for (const fileToDelete of existingFilesToDelete) {
    try {
      await openAI.files.del(fileToDelete.openai_id);
    } catch {
      // Do nothing major, we can accept this erorr
      context.error(
        `Error deleting organisation file from OpenAI: ${fileToDelete.openai_id} (internal ID ${fileToDelete.id})`,
      );
    }
  }

  try {
    await db
      .deleteFrom("organisation_files")
      .where("organisation_id", "=", org_id)
      .where("id", "in", file_ids)
      .execute();

    return { status: 200 };
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured deleting your files",
      },
    };
  }
}

app.http("deleteOrganisationFiles", {
  methods: ["DELETE"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: deleteOrganisationFiles,
});
