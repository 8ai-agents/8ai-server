import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { OrganisationFilesResponse } from "../models/OrganisationFilesResponse";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";

export async function getOrganisationFiles(
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

  context.log(`Get Organisation Files ${org_id}`);

  try {
    const jsonBody: OrganisationFilesResponse[] = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .execute();
    return { status: 200, jsonBody };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Organisation not found",
      },
    };
  }
}

app.http("getOrganisationFiles", {
  methods: ["GET"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: getOrganisationFiles,
});
