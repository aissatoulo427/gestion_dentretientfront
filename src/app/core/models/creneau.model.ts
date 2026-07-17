export interface Creneau {
  id: number;
  dateDebut: string;
  dateFin: string;
  disponible: boolean;
  recruteurId: number;
  demandeEntretienId: number | null;
}

export interface CreateCreneau {
  recruteurId: number;
  dateDebut: string;
  dateFin: string;
}
