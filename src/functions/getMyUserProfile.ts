import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";

export async function getMyUserProfile(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`get my user profile "${request.url}"`);

  const userData: UserResponse = await db
    .selectFrom("users")
    .leftJoin("organisations", "organisations.id", "users.organisation_id")
    .select([
      "users.id",
      "users.email",
      "users.name",
      "users.phone",
      "organisations.id as organisation_id",
      "organisations.name as organisation_name",
    ])
    .executeTakeFirst();

  return { status: 200, jsonBody: userData };
}

app.http("getMyUserProfile", {
  methods: ["GET"],
  route: "account",
  authLevel: "anonymous",
  handler: getMyUserProfile,
});
