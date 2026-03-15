import { Role } from "../../iam/roles.enum";

export interface AuthContext {
  userId: string;
  role: Role;
  companyId?: string | null;
}
