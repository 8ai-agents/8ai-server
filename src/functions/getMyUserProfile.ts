import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getUser } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";
import { authenticateRequest } from "../AuthController";

export async function getMyUserProfile(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  let email: string;
  try {
    email = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  context.log(`get my user profile ${email.toLowerCase()}`);

  const userData: UserResponse = await getUser(email.toLowerCase());

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
