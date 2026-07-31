import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { NotificationService } from './notification.service';

/**
 * Extrait un message lisible d'une réponse d'erreur.
 * Rappel README : sur un 400, le corps est une CHAÎNE (le message métier), pas un objet JSON.
 */
export function extractErrorMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return "API injoignable. Le backend est-il démarré sur http://localhost:5062 ?";
  }

  const body = error.error;
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }
  if (body && typeof body === 'object' && typeof body.message === 'string') {
    return body.message;
  }

  switch (error.status) {
    case 400:
      return 'Requête invalide.';
    case 401:
      return 'Non autorisé.';
    case 404:
      return 'Ressource introuvable.';
    default:
      return `Erreur ${error.status} : ${error.statusText || 'inconnue'}.`;
  }
}

/**
 * Endpoints appelés sans session : login, inscription, réinitialisation.
 * Un 401 y est une réponse métier, pas une session expirée — il ne doit
 * donc jamais déconnecter ni rediriger le visiteur.
 */
const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/mot-de-passe-oublie',
  '/auth/reinitialiser',
  '/auth/activer',
];

const isEndpointPublic = (url: string) =>
  PUBLIC_ENDPOINTS.some((endpoint) => url.includes(endpoint));

/** Interceptor fonctionnel : affiche un toast d'erreur, gère le 401 (session expirée). */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 sur un endpoint protégé = session invalide/expirée -> déconnexion + redirection.
      if (error.status === 401 && !isEndpointPublic(req.url)) {
        auth.logout();
        notifications.error('Session expirée, veuillez vous reconnecter.');
        router.navigate(['/login']);
        return throwError(() => new Error('Session expirée.'));
      }

      const message = extractErrorMessage(error);
      notifications.error(message);
      return throwError(() => new Error(message));
    }),
  );
};
