import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { db, getOrganisationFileResponse } from "../DatabaseController";
import { deleteAssistantFile } from "../OpenAIHandler";

export async function deleteOrganisationFile(
  request: HttpRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const file_id = request.params.org_id as string;
  if (!file_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid file ID",
      },
    };
  }
  context.log(`Delete Organisation File ${file_id}`);

  try {
    const { openai_id } = await getOrganisationFileResponse(file_id);

    if (openai_id) {
      // Delete from OpenAI
      await deleteAssistantFile(openai_id);
    }

    await db
      .deleteFrom("organisation_files")
      .where("id", "=", file_id)
      .execute();

    return {
      status: 200,
    };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "File can't be deleted",
      },
    };
  }
}

app.http("deleteOrganisationFile", {
  methods: ["DELETE"],
  route: "organisations/{org_id}/files/{file_id}",
  authLevel: "anonymous",
  handler: deleteOrganisationFile,
});
