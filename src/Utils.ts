import { randomBytes } from "crypto";
import { db } from "./DatabaseController";
import { UserRoleType } from "./models/Database";

export const checkUserIsAdmin = async (
  org_id: string,
  email: string,
  superAdminOnly: boolean = false
) => {
  const roles = await db
    .selectFrom("user_roles")
    .leftJoin("users", "users.id", "user_roles.user_id")
    .where("users.email", "=", email.toLowerCase())
    .select(["user_roles.organisation_id", "user_roles.role"])
    .execute();

  if (superAdminOnly) {
    return roles.some((r) => r.role === UserRoleType.SUPER_ADMIN);
  } else {
    return (
      roles.some((r) => r.role === UserRoleType.SUPER_ADMIN) ||
      roles.some(
        (r) => r.role === UserRoleType.ADMIN && r.organisation_id === org_id
      )
    );
  }
};

export const createID = (type: "cont" | "conv" | "msg" | "org" | "user") =>
  `${type}_${randomBytes(16).toString("hex")}`;
