import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth/auth.service';
import { NotificationService } from './notification.service';
import { extractErrorMessage, httpErrorInterceptor } from './http-error.interceptor';

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

describe('httpErrorInterceptor — traitement du 401', () => {
  const base = 'http://test/api';
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** Ouvre une session valide en passant par le vrai flux de login. */
  function connecter(): void {
    const expiration = new Date(Date.now() + 3_600_000).toISOString();
    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration,
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });
  }

  it('affiche le message du backend sur un 401 de login', () => {
    const notify = TestBed.inject(NotificationService);

    http.post(`${base}/auth/login`, {}).subscribe({ error: () => {} });
    httpMock.expectOne(`${base}/auth/login`).flush(
      { succes: false, message: 'Email ou mot de passe invalide.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(
      notify.toasts().some((t) => t.message === 'Email ou mot de passe invalide.'),
    ).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('conserve la session sur un 401 venant de /auth/reinitialiser', () => {
    connecter();

    http.post(`${base}/auth/reinitialiser`, {}).subscribe({ error: () => {} });
    httpMock.expectOne(`${base}/auth/reinitialiser`).flush('Code invalide.', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('conserve la session sur un 401 venant de /auth/mot-de-passe-oublie', () => {
    connecter();

    http.post(`${base}/auth/mot-de-passe-oublie`, {}).subscribe({ error: () => {} });
    httpMock.expectOne(`${base}/auth/mot-de-passe-oublie`).flush('Refusé.', {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('déconnecte et redirige sur un 401 venant d\'un endpoint protégé', () => {
    connecter();

    http.get(`${base}/demandes`).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${base}/demandes`)
      .flush('', { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
