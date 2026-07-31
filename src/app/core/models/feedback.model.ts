import { Decision } from './enums';

export interface Feedback {
  id: number;
  note: number;
  commentaire: string;
  decision: Decision;
  dateSaisie: string;
  entretienId: number;
  auteurId: number;
}

/** Le compte-rendu est signé par l'utilisateur connecté, lu dans le token par l'API. */
export interface CreateFeedback {
  entretienId: number;
  note: number;
  commentaire: string;
  decision: Decision;
}
