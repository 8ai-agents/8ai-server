import { UserRoleType } from "./Database";

export interface UserRequest {
  id: string | undefined;
  organisation_id: string;
  name: string;
  email: string;
  phone: string | undefined;
  role: UserRoleType;
}
