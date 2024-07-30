import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db } from "../DatabaseController";
import { checkUserIsAdmin } from "../Utils";
import { OrganisationFileResponse } from "../models/OrganisationFileResponse";

export async function getOrganisationFiles(
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

  context.log(`Get Organisation Files ${org_id}`);

  const data = await db
    .selectFrom("organisation_files")
    .where("organisation_id", "=", org_id)
    .selectAll()
    .execute();

  const results: OrganisationFileResponse[] = data.map((d) => {
    return {
      ...d,
    };
  });

  return { status: 200, jsonBody: results };
}

app.http("getOrganisationFiles", {
  methods: ["GET"],
  route: "organisations/{org_id}/files",
  authLevel: "anonymous",
  handler: getOrganisationFiles,
});
