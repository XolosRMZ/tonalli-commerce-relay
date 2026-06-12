export type UserRole =
  | "buyer"
  | "intermediary"
  | "arbitrator"
  | "moderator";

export interface TonalliIdentity {
  address: string;
  publicKey?: string;
  alias?: string;
}

export interface CommerceUser {
  id: string;
  identity: TonalliIdentity;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}
