import { randomBytes } from "crypto";
import { db } from "./DatabaseController";
import { UserRoleType } from "./models/Database";

export const checkUserIsAdmin = async (
  org_id: string,
  email: string,
  superAdminOnly: boolean = false,
) => {
  const { organisation_id, role } = await db
    .selectFrom("users")
    .where("email", "=", email.toLowerCase())
    .select(["organisation_id", "role"])
    .executeTakeFirst();

  if (superAdminOnly) {
    return role === UserRoleType.SUPER_ADMIN;
  } else {
    return (
      role === UserRoleType.SUPER_ADMIN ||
      (role === UserRoleType.ADMIN && organisation_id == org_id)
    );
  }
};

export const createID = (type: "cont" | "conv" | "msg" | "org" | "user") =>
  `${type}_${randomBytes(16).toString("hex")}`;
