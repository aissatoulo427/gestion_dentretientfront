import { Decision, Modalite, StatutDemande, StatutEntretien } from '../core/models';

/** Formate une date ISO en JJ/MM/AAAA HH:mm (locale fr). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Convertit une saisie <input type="datetime-local"> en ISO sans fuseau (ex. 2026-07-20T09:00:00). */
export function toApiDateTime(local: string): string {
  if (!local) return local;
  // datetime-local -> "2026-07-20T09:00" ; on complète les secondes.
  return local.length === 16 ? `${local}:00` : local;
}

export const MODALITE_LABEL: Record<Modalite, string> = {
  Presentiel: 'Présentiel',
  Distanciel: 'Distanciel',
  Telephone: 'Téléphone',
};

export const DECISION_LABEL: Record<Decision, string> = {
  Favorable: 'Favorable',
  Defavorable: 'Défavorable',
  ARevoir: 'À revoir',
};

export const STATUT_DEMANDE_LABEL: Record<StatutDemande, string> = {
  Creee: 'Créée',
  Planifiee: 'Planifiée',
  Annulee: 'Annulée',
  Terminee: 'Terminée',
};

export const STATUT_ENTRETIEN_LABEL: Record<StatutEntretien, string> = {
  Planifie: 'Planifié',
  Confirme: 'Confirmé',
  Reprogramme: 'Reprogrammé',
  Termine: 'Terminé',
  Annule: 'Annulé',
};
