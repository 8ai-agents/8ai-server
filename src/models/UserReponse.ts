import { createID } from "../Utils";
import { UserRoleResponse } from "./UserRoleReponse";

export class UserResponse {
  id: string;
  name: string;
  email: string;
  phone: string | undefined;
  roles: UserRoleResponse[];

  constructor(org_id: string, name: string, email: string) {
    this.id = createID("user");
    this.name = name;
    this.email = email;
    this.roles = [];
  }
}
