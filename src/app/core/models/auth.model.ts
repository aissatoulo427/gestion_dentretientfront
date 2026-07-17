export type Role = 'Recruteur' | 'Manager';

export interface LoginRequest {
  email: string;
  motDePasse: string;
}

export interface LoginResponse {
  token: string;
  expiration: string;
  role: Role;
}

/** Session persistée localement. */
export interface AuthSession {
  token: string;
  expiration: string;
  role: Role;
  email: string;
}
