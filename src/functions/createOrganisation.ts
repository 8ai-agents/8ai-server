import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { NewOrganisation, UserRoleType } from "../models/Database";
import { OrganisationRequest } from "../models/OrganisationRequest";
import { randomBytes } from "crypto";
import { db, getOrganisation } from "../DatabaseController";

export async function createOrganisation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { role } = await authenticateRequest(request);
    if (role != UserRoleType.SUPER_ADMIN) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    const organisationRequest = (await request.json()) as OrganisationRequest;

    context.log(`Creating organisation ${organisationRequest.name}`);
    const organisationToSave: NewOrganisation = {
      ...organisationRequest,
      id: `org_${randomBytes(8).toString("hex")}`,
    };
    await db
      .insertInto("organisations")
      .values(organisationToSave)
      .executeTakeFirst();

    const jsonBody = await getOrganisation(organisationToSave.id);
    return { status: 200, jsonBody };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't create organisation`,
      },
    };
  }
}

app.http("createOrganisation", {
  methods: ["POST"],
  route: "organisations",
  authLevel: "anonymous",
  handler: createOrganisation,
});
