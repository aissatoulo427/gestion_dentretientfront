import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

/** Réserve un écran au recruteur (RH). Le manager est renvoyé vers son tableau de bord. */
export const recruteurGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.role() === 'Recruteur' ? true : router.createUrlTree(['/dashboard']);
};
