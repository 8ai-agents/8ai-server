import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";
import { authenticateRequest } from "../AuthController";

export async function getMyUserProfile(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let authData;
  try {
    authData = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  context.log(`get my user profile ${authData.email.toLowerCase()}`);

  const userData: UserResponse = await db
    .selectFrom("users")
    .leftJoin("organisations", "organisations.id", "users.organisation_id")
    .select([
      "users.id",
      "users.email",
      "users.name",
      "users.phone",
      "users.role",
      "organisations.id as organisation_id",
      "organisations.name as organisation_name",
    ])
    .where("email", "=", authData.email.toLowerCase())
    .executeTakeFirst();

  if (userData) {
    return { status: 200, jsonBody: userData };
  } else {
    return {
      status: 404,
      jsonBody: {
        error: "User not found",
      },
    };
  }
}

app.http("getMyUserProfile", {
  methods: ["GET"],
  route: "account",
  authLevel: "anonymous",
  handler: getMyUserProfile,
});
