import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { OrganisationResponse } from "../models/OrganisationResponse";

export async function getOrganisation(
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
  context.log(`Get Organisation ${org_id}`);

  try {
    const data = await db
      .selectFrom("organisations")
      .where("organisations.id", "=", org_id)
      .selectAll()
      .executeTakeFirstOrThrow();

    const result: OrganisationResponse = {
      ...data,
    };
    return { status: 200, jsonBody: result };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Organisation not found",
      },
    };
  }
}

app.http("getOrganisation", {
  methods: ["GET"],
  route: "organisations/{org_id}",
  authLevel: "anonymous",
  handler: getOrganisation,
});
