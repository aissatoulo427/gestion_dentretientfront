// Enums de l'API — envoyés/reçus en TEXTE (voir README-FRONT §4)

export type TypeEntretien = 'RH' | 'Technique' | 'Managerial';
export const TYPE_ENTRETIEN_VALUES: TypeEntretien[] = ['RH', 'Technique', 'Managerial'];

export type Modalite = 'Presentiel' | 'Distanciel' | 'Telephone';
export const MODALITE_VALUES: Modalite[] = ['Presentiel', 'Distanciel', 'Telephone'];

export type Decision = 'Favorable' | 'Defavorable' | 'ARevoir';
export const DECISION_VALUES: Decision[] = ['Favorable', 'Defavorable', 'ARevoir'];

export type StatutDemande = 'Creee' | 'Planifiee' | 'Annulee' | 'Terminee';

export type StatutEntretien =
  | 'Planifie'
  | 'Confirme'
  | 'Reprogramme'
  | 'Termine'
  | 'Annule';

export type TypePersonne = 'Candidat' | 'Recruteur' | 'Manager';
