import { Modalite, StatutEntretien } from './enums';

export interface Entretien {
  id: number;
  dateHeure: string;
  lieuOuLien: string;
  statut: StatutEntretien;
  modalite: Modalite;
  demandeEntretienId: number;
  candidatId: number;
  recruteurId: number;
  creneauId: number;
}

export interface CreateEntretien {
  demandeId: number;
  creneauId: number;
  dateHeure: string;
  modalite: Modalite;
  lieuOuLien: string;
}

export interface ReprogrammerEntretien {
  nouveauCreneauId: number;
  nouvelleDateHeure: string;
}
