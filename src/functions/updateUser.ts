import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { UserRequest } from "../models/UserRequest";
import { User, UserRole, UserRoleType } from "../models/Database";
import { db } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";

export async function updateUser(
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

    if (!userRequest.id) {
      return {
        status: 400,
        jsonBody: {
          error: `You must provide an user ID to update`,
        },
      };
    }

    if (userRequest.role === UserRoleType.SUPER_ADMIN) {
      return {
        status: 400,
        jsonBody: {
          error: `You can't assign this role to the user`,
        },
      };
    }

    const existingUser: User = await db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", userRequest.id)
      .executeTakeFirst();
    if (!existingUser) {
      return {
        status: 404,
        jsonBody: {
          error: `User with ID ${userRequest.id} not found`,
        },
      };
    }

    const existingRole: UserRole = await db
      .selectFrom("user_roles")
      .selectAll()
      .where("user_id", "=", userRequest.id)
      .where("organisation_id", "=", organisation_id)
      .executeTakeFirst();
    if (!existingRole) {
      return {
        status: 404,
        jsonBody: {
          error: `This user does not exist in this organisation`,
        },
      };
    }

    context.log(`Updating user for ${organisation_id}`);

    existingUser.name = userRequest.name;
    existingUser.email = userRequest.email.toLowerCase();
    existingUser.phone = userRequest.phone;

    await db
      .updateTable("users")
      .set({
        name: existingUser.name,
        email: existingUser.email,
        phone: existingUser.phone,
      })
      .where("id", "=", userRequest.id)
      .execute();

    await db
      .updateTable("user_roles")
      .set({ role: userRequest.role })
      .where("user_id", "=", userRequest.id)
      .where("organisation_id", "=", organisation_id)
      .execute();

    const jsonBody: UserResponse = await db
      .selectFrom("users")
      .where("users.id", "=", userRequest.id)
      .leftJoin("user_roles", "user_roles.user_id", "users.id")
      .where("user_roles.organisation_id", "=", organisation_id)
      .select([
        "users.id",
        "users.name",
        "users.email",
        "users.phone",
        "user_roles.role",
        "user_roles.active",
      ])
      .executeTakeFirst()
      .then((row): UserResponse => {
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          roles: [
            {
              role: row.role,
              organisation_name: "",
              user_id: row.id,
              organisation_id: organisation_id,
            },
          ],
        };
      });

    return { status: 200, jsonBody };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't update user`,
      },
    };
  }
}

app.http("updateUser", {
  methods: ["PUT"],
  route: "users/{organisation_id}",
  authLevel: "anonymous",
  handler: updateUser,
});
