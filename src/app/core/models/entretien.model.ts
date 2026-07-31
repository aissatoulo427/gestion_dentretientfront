import { Modalite, StatutEntretien, TypeEntretien } from './enums';

export interface Entretien {
  id: number;
  dateHeure: string;
  lieuOuLien: string;
  statut: StatutEntretien;
  modalite: Modalite;
  typeEntretien: TypeEntretien;
  demandeEntretienId: number;
  candidatId: number;
  evaluateurIds: number[];
  creneauId: number;
}

/**
 * L'horaire n'est pas transmis : l'API le déduit du créneau réservé
 * (`entretien.dateHeure = creneau.dateDebut`). Le créneau est la seule
 * source de vérité, ce qui rend impossible une date incohérente.
 */
export interface CreateEntretien {
  demandeId: number;
  creneauId: number;
  modalite: Modalite;
  lieuOuLien: string;
  typeEntretien: TypeEntretien;
  evaluateurIds: number[];
}

export interface ReprogrammerEntretien {
  nouveauCreneauId: number;
}
