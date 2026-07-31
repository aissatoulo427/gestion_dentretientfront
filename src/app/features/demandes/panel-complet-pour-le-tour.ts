import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RoleEmploye, TypeEntretien } from '../../core/models';

/** Rôle qu'un tour exige au minimum dans son panel. */
export const ROLE_REQUIS: Record<TypeEntretien, RoleEmploye> = {
  RH: 'RH',
  Technique: 'EvaluateurTechnique',
  Managerial: 'Manager',
};

/**
 * Chaque type de tour exige au moins un évaluateur du rôle correspondant.
 * « Au moins un », pas « seulement » : d'autres rôles peuvent compléter le panel.
 *
 * Le rôle d'un évaluateur n'est pas porté par le formulaire, d'où le résolveur
 * passé en paramètre — il puise dans l'annuaire chargé par l'écran.
 */
export function panelCompletPourLeTour(
  roleDe: (id: number) => RoleEmploye | undefined,
): ValidatorFn {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const type = groupe.get('typeEntretien')?.value as TypeEntretien | undefined;
    const ids = (groupe.get('evaluateurIds')?.value ?? []) as number[];

    // Un panel vide relève de `auMoinsUnEvaluateur` : on ne double pas le message.
    if (!type || ids.length === 0) return null;

    const requis = ROLE_REQUIS[type];
    return ids.some((id) => roleDe(id) === requis)
      ? null
      : { roleManquantAuPanel: requis };
  };
}
