import { Component, computed, input } from '@angular/core';
import {
  DECISION_LABEL,
  STATUT_DEMANDE_LABEL,
  STATUT_ENTRETIEN_LABEL,
} from '../format';

const LABELS: Record<string, string> = {
  ...STATUT_DEMANDE_LABEL,
  ...STATUT_ENTRETIEN_LABEL,
  ...DECISION_LABEL,
};

// Couleur (fond + texte + point) par valeur de statut/décision.
const COLORS: Record<string, string> = {
  Creee: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Planifie: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  Planifiee: 'bg-navy-50 text-navy-700 ring-navy-600/20',
  Confirme: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Reprogramme: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Termine: 'bg-navy-100 text-navy-600 ring-navy-500/20',
  Terminee: 'bg-navy-100 text-navy-600 ring-navy-500/20',
  Annule: 'bg-red-50 text-red-700 ring-red-600/20',
  Annulee: 'bg-red-50 text-red-700 ring-red-600/20',
  Favorable: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  Defavorable: 'bg-red-50 text-red-700 ring-red-600/20',
  ARevoir: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

@Component({
  selector: 'app-status-badge',
  template: `<span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
    [class]="classes()"
    >{{ label() }}</span
  >`,
})
export class StatusBadge {
  readonly value = input.required<string>();

  readonly label = computed(() => LABELS[this.value()] ?? this.value());
  readonly classes = computed(
    () => COLORS[this.value()] ?? 'bg-navy-50 text-navy-600 ring-navy-500/20',
  );
}
