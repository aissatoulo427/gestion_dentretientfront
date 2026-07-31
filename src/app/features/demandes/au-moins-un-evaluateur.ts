import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Un entretien doit compter au moins un évaluateur.
 * Reproduit côté client le 400 « Un entretien doit compter au moins un évaluateur. »
 */
export function auMoinsUnEvaluateur(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valeur = control.value as number[] | null;
    return Array.isArray(valeur) && valeur.length > 0 ? null : { panelVide: true };
  };
}
