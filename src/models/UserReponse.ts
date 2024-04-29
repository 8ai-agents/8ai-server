import { randomBytes } from "crypto";
import { UserRoleType } from "./Database";

export class UserResponse {
  id: string;
  organisation_id: string;
  organisation_name: string;
  name: string;
  email: string;
  phone: string | undefined;
  role: UserRoleType;

  constructor(org_id: string, name: string, email: string) {
    this.id = `user_${randomBytes(8).toString("hex")}`;
    this.organisation_id = org_id;
    this.name = name;
    this.email = this.email;
    this.role = UserRoleType.USER;
  }
}
