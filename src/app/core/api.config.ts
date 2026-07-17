import { InjectionToken } from '@angular/core';

/** URL de base de l'API (préfixe /api inclus). Surchargeable dans app.config.ts. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:5062/api',
});
