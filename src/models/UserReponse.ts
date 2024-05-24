import { UserRoleType } from "./Database";
import { createID } from "../Utils";

export class UserResponse {
  id: string;
  organisation_id: string;
  organisation_name: string;
  name: string;
  email: string;
  phone: string | undefined;
  role: UserRoleType;

  constructor(org_id: string, name: string, email: string) {
    this.id = createID("user");
    this.organisation_id = org_id;
    this.name = name;
    this.email = email;
    this.role = UserRoleType.USER;
  }
}
