import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { getOrganisationFileResponse } from "../DatabaseController";

export async function getOrganisationFile(
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
  context.log(`Get Organisation File ${file_id}`);

  try {
    return {
      status: 200,
      jsonBody: await getOrganisationFileResponse(file_id),
    };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Organisation not found",
      },
    };
  }
}

app.http("getOrganisationFile", {
  methods: ["GET"],
  route: "organisations/{org_id}/files/{file_id}",
  authLevel: "anonymous",
  handler: getOrganisationFile,
});
