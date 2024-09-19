import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin, createID } from "../Utils";
import { UserRequest } from "../models/UserRequest";
import {
  NewUser,
  NotificationSettingsType,
  UserRoleType,
} from "../models/Database";
import { db, getUser } from "../DatabaseController";
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
      name: userRequest.name,
      email: userRequest.email.toLowerCase(),
      phone: userRequest.phone,
    };
    await db.insertInto("users").values(userToSave).execute();
    await db
      .insertInto("user_roles")
      .values({
        user_id: userToSave.id,
        role: userRequest.role,
        organisation_id,
        active: true,
      })
      .execute();
    // Initialise default notification settings for user
    await db
      .insertInto("notification_settings")
      .values([
        {
          user_id: userToSave.id,
          type: NotificationSettingsType.DAILY_SUMMARY,
          enabled: true,
        },
        {
          user_id: userToSave.id,
          type: NotificationSettingsType.WEEKLY_SUMMARY,
          enabled: false,
        },
        {
          user_id: userToSave.id,
          type: NotificationSettingsType.NEGATIVE_SENTIMENT,
          enabled: true,
        },
        {
          user_id: userToSave.id,
          type: NotificationSettingsType.CONTACT_DETAILS_LEFT,
          enabled: true,
        },
        {
          user_id: userToSave.id,
          type: NotificationSettingsType.NEW_CONVERSATION,
          enabled: false,
        },
      ])
      .executeTakeFirst();

    const jsonBody: UserResponse = await getUser(userToSave.email);

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
