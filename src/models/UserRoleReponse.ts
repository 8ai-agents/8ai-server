import { UserRoleType } from "./Database";

export interface UserRoleResponse {
  user_id: string;
  organisation_id: string;
  organisation_name: string;
  role: UserRoleType;
}
