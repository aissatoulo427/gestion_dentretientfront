export interface Creneau {
  id: number;
  dateDebut: string;
  dateFin: string;
  disponible: boolean;
  /** Le propriétaire du créneau, quel que soit son rôle. S'appelait `recruteurId`. */
  employeId: number;
  demandeEntretienId: number | null;
}

/** Le créneau appartient au recruteur connecté, lu dans le token par l'API. */
export interface CreateCreneau {
  dateDebut: string;
  dateFin: string;
}
