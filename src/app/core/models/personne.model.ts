import { TypePersonne } from './enums';

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

/** Recruteur et Manager partagent la même forme. */
export interface RecruteurManager {
  id: number;
  nom: string;
  email: string;
}

/** Création d'un compte staff (recruteur/manager) — inclut le mot de passe. */
export interface CreateRecruteurManager {
  nom: string;
  email: string;
  motDePasse: string;
}

/** Renvoyé par GET /api/personnes/{id} (n'importe quel type). */
export interface Personne {
  id: number;
  nom: string;
  email: string;
  type: TypePersonne;
}
