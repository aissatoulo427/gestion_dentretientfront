import { StatutDemande, TypeEntretien } from './enums';

export interface Demande {
  id: number;
  poste: string;
  typeEntretien: TypeEntretien;
  dateCreation: string;
  statut: StatutDemande;
  recruteurId: number;
  candidatId: number;
}

export interface CreateDemande {
  recruteurId: number;
  candidatId: number;
  poste: string;
  typeEntretien: TypeEntretien;
}
