import { StatutDemande } from './enums';

export interface Demande {
  id: number;
  poste: string;
  dateCreation: string;
  statut: StatutDemande;
  /** Le RH organisateur. S'appelait `recruteurId`. */
  rhId: number;
  candidatId: number;
}

/** L'organisateur est le recruteur connecté, lu dans le token par l'API. */
export interface CreateDemande {
  candidatId: number;
  poste: string;
}

/** Seul le poste est corrigeable : changer de candidat invaliderait les tours déjà planifiés. */
export interface UpdateDemande {
  poste: string;
}
