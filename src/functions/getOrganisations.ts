import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db, getUser } from "../DatabaseController";
import { UserRoleType } from "../models/Database";
import { OrganisationResponse } from "../models/OrganisationResponse";
import { checkUserIsAdmin } from "../Utils";

export async function getOrganisations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin("", email, true)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  const data = await db.selectFrom("organisations").selectAll().execute();

  const results: OrganisationResponse[] = data.map((d) => {
    return {
      ...d,
    };
  });

  return { status: 200, jsonBody: results };
}

app.http("getOrganisations", {
  methods: ["GET"],
  route: "organisations",
  authLevel: "anonymous",
  handler: getOrganisations,
});
