import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from './http-error.interceptor';

describe('extractErrorMessage', () => {
  it('utilise le corps texte d\'un 400 (message métier)', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: 'Recruteur introuvable.',
    });
    expect(extractErrorMessage(err)).toBe('Recruteur introuvable.');
  });

  it('signale une API injoignable sur status 0', () => {
    const err = new HttpErrorResponse({ status: 0 });
    expect(extractErrorMessage(err)).toContain('injoignable');
  });

  it('retourne un message par défaut pour un 404 sans corps', () => {
    const err = new HttpErrorResponse({ status: 404 });
    expect(extractErrorMessage(err)).toBe('Ressource introuvable.');
  });

  it('lit la propriété message si le corps est un objet', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: { message: 'Note invalide.' },
    });
    expect(extractErrorMessage(err)).toBe('Note invalide.');
  });
});
