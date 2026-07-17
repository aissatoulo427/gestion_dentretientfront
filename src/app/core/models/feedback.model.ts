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

export interface CreateFeedback {
  entretienId: number;
  auteurId: number;
  note: number;
  commentaire: string;
  decision: Decision;
}
