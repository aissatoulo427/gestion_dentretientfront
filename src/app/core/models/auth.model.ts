/**
 * Quatre rôles. L'`Admin` gère les comptes et rien d'autre : il ne recrute pas,
 * ne pose pas de créneau et ne peut pas siéger à un panel. Le RH pilote le
 * recrutement ; les deux autres n'interviennent que comme évaluateurs.
 */
export type Role = 'Admin' | 'RH' | 'EvaluateurTechnique' | 'Manager';

/**
 * Les rôles qui font passer des entretiens : seuls ceux-là ont un endpoint de
 * liste, posent des créneaux et peuvent composer un panel.
 */
export type RoleEmploye = Exclude<Role, 'Admin'>;

export const ROLES_EMPLOYES: RoleEmploye[] = ['RH', 'EvaluateurTechnique', 'Manager'];

export const ROLE_VALUES: Role[] = ['Admin', ...ROLES_EMPLOYES];

export const ROLE_LABEL: Record<Role, string> = {
  Admin: 'Administrateur',
  RH: 'RH',
  EvaluateurTechnique: 'Évaluateur technique',
  Manager: 'Manager',
};

export interface LoginRequest {
  email: string;
  motDePasse: string;
}

export interface LoginResponse {
  token: string;
  expiration: string;
  id: number;
  nom: string;
  email: string;
  role: Role;
}

/** Demande d'envoi d'un code de réinitialisation par email. */
export interface MotDePasseOublieRequest {
  email: string;
}

/** Même forme que toute réponse sans ressource : c'est `succes` qui tranche, pas le code HTTP. */
export interface MotDePasseOublieResponse {
  succes: boolean;
  message: string;
}

/** Vérification du code seul, avant de faire choisir un mot de passe. */
export interface VerifierCodeRequest {
  email: string;
  code: string;
}

export interface ReinitialiserRequest {
  email: string;
  code: string;
  nouveauMotDePasse: string;
}

export interface ReinitialiserResponse {
  succes: boolean;
  message: string;
}

/** Session persistée localement. */
export interface AuthSession {
  token: string;
  expiration: string;
  role: Role;
  personneId: number;
  nom: string;
  email: string;
}
