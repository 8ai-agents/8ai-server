import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin, createID } from "../Utils";
import { UserRequest } from "../models/UserRequest";
import { NewUser, UserRoleType } from "../models/Database";
import { db } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";

export async function createUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const organisation_id = request.params.organisation_id;
  try {
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin(organisation_id, email, false))
      return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    const userRequest = (await request.json()) as UserRequest;

    // We don't allow assigning super admin role yet for safety reasons
    userRequest.role =
      userRequest.role === UserRoleType.SUPER_ADMIN
        ? UserRoleType.ADMIN
        : userRequest.role;

    context.log(`Creating new user for ${organisation_id}`);
    const userToSave: NewUser = {
      id: createID("user"),
      organisation_id,
      name: userRequest.name,
      email: userRequest.email.toLowerCase(),
      phone: userRequest.phone,
      role: userRequest.role,
    };
    await db.insertInto("users").values(userToSave).executeTakeFirst();

    const jsonBody: UserResponse = await db
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
      .where("email", "=", userToSave.id)
      .executeTakeFirst();

    return { status: 200, jsonBody };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't create user`,
      },
    };
  }
}

app.http("createUser", {
  methods: ["POST", "OPTIONS"],
  route: "users/{organisation_id}",
  authLevel: "anonymous",
  handler: createUser,
});
