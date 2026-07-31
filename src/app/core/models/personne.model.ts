import { RoleEmploye } from './auth.model';
import { TypePersonne } from './enums';

/**
 * Segment de `/api/personnes` propre à chaque rôle d'employé.
 * L'`Admin` n'y figure pas : aucun endpoint ne le liste ni ne le crée, le
 * premier admin naît de la configuration au démarrage du backend.
 */
export const SEGMENT_ROLE: Record<RoleEmploye, string> = {
  RH: 'rh',
  EvaluateurTechnique: 'evaluateurs-techniques',
  Manager: 'managers',
};

export interface Candidat {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

export interface CreateCandidat {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
}

/** RH, évaluateur technique et manager partagent la même forme. */
export interface Employe {
  id: number;
  nom: string;
  email: string;
}

/**
 * Création d'un compte employé par l'admin. Aucun mot de passe : le titulaire
 * reçoit un code et choisit le sien via `POST /auth/activer`.
 */
export interface CreateEmploye {
  nom: string;
  email: string;
}

/** Renvoyé par GET /api/personnes/{id} (n'importe quel type). */
export interface Personne {
  id: number;
  nom: string;
  email: string;
  type: TypePersonne;
}
