import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import { db } from "../DatabaseController";
import { UserResponse } from "../models/UserReponse";

export async function getUsers(
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
  try {
    const email = await authenticateRequest(request);
    if (!checkUserIsAdmin(org_id, email, false)) return { status: 403 };
  } catch {
    return { status: 401 };
  }
  context.log(`Get Organisation Users ${org_id}`);

  try {
    const jsonBody: UserResponse[] = await db
      .selectFrom("users")
      .leftJoin("user_roles", "user_roles.user_id", "users.id")
      .where("user_roles.organisation_id", "=", org_id)
      .select([
        "users.id",
        "users.name",
        "users.email",
        "users.phone",
        "user_roles.role",
        "user_roles.active",
      ])
      .execute()
      .then((rows) =>
        rows
          ? rows.map((row): UserResponse => {
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
                    organisation_id: org_id,
                  },
                ],
              };
            })
          : []
      );
    return { status: 200, jsonBody };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Cant get organisation users",
      },
    };
  }
}

app.http("getUsers", {
  methods: ["GET"],
  route: "users/{org_id}",
  authLevel: "anonymous",
  handler: getUsers,
});
