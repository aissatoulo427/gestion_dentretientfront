import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validateur de groupe : le champ `confirmation` doit reprendre `champMotDePasse`.
 * Le nom du champ est passé en paramètre car l'inscription utilise `motDePasse`
 * et la réinitialisation `nouveauMotDePasse`.
 */
export function motsDePasseIdentiques(champMotDePasse: string): ValidatorFn {
  return (groupe: AbstractControl): ValidationErrors | null => {
    const motDePasse = groupe.get(champMotDePasse)?.value;
    const confirmation = groupe.get('confirmation')?.value;
    return motDePasse === confirmation ? null : { motsDePasseDifferents: true };
  };
}
