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

export async function getOrganisationFile(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const org_id = request.params.org_id as string;
  const file_id = request.params.file_id as string;
  if (!org_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid organisation ID",
      },
    };
  }
  if (!file_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid file ID",
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

  context.log(`Get Organisation File ${org_id} ${file_id}`);

  try {
    const jsonBody: OrganisationFileResponse = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .where("id", "=", file_id)
      .executeTakeFirst();
    if (jsonBody) {
      return { status: 200, jsonBody };
    } else {
      return {
        status: 404,
        jsonBody: {
          error: "Organisation file not found",
        },
      };
    }
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured retrieving your file",
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
