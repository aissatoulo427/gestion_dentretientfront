/**
 * Forme uniforme de toute réponse sans ressource, quel que soit le code HTTP :
 * erreurs (400, 401, 404) comme accusés de réception (annuler, confirmer,
 * reprogrammer, rappel, proposer).
 */
export interface ApiMessage {
  succes: boolean;
  message: string;
}
