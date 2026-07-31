import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role, ROLES_EMPLOYES } from '../models';
import { AuthService } from './auth.service';

/** Empêche l'accès aux écrans protégés sans session valide. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  auth.logout();
  return router.createUrlTree(['/login'], {
    queryParams: { redirectTo: state.url },
  });
};

/** Renvoie vers le tableau de bord tout rôle hors de la liste autorisée. */
function reserveAux(roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    return role !== null && roles.includes(role)
      ? true
      : router.createUrlTree(['/dashboard']);
  };
}

/** Candidats, demandes, planification : le RH pilote le recrutement seul. */
export const rhGuard: CanActivateFn = reserveAux(['RH']);

/** Gestion des comptes : l'admin, et lui seul. */
export const adminGuard: CanActivateFn = reserveAux(['Admin']);

/**
 * Créneaux et entretiens : les trois rôles qui font passer des entretiens.
 * L'admin en est écarté, il ne recrute pas.
 */
export const employeGuard: CanActivateFn = reserveAux([...ROLES_EMPLOYES]);
