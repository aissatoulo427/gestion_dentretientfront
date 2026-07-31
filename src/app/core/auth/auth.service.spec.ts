import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const base = 'http://test/api';

  /** Reconstruit le service dans un injecteur neuf, pour observer sa lecture du stockage. */
  function recreerService(): AuthService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  /** Connecte le service avec une session valide pendant `dureeMs`. */
  function connecter(service: AuthService, dureeMs = 3_600_000): void {
    const expiration = new Date(Date.now() + dureeMs).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt-123',
      expiration,
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.useRealTimers();
  });

  it('démarre non authentifié', () => {
    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('stocke la session et le token après un login réussi', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();

    const req = httpMock.expectOne(`${base}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      token: 'jwt-123',
      expiration: future,
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getToken()).toBe('jwt-123');
    expect(service.role()).toBe('RH');
  });

  it('considère un token expiré comme non authentifié', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 't',
      expiration: past,
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'Manager',
    });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it("lit l'identité dans la réponse de login, pas dans le formulaire", () => {
    service.login({ email: 'saisi@formulaire.com', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });

    expect(service.personneId()).toBe(36);
    expect(service.nom()).toBe('Lo');
    expect(service.email()).toBe('u@test.com');
  });

  it('rejette et purge une session stockée sans personneId', () => {
    localStorage.setItem(
      'ge_auth',
      JSON.stringify({
        token: 't',
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        role: 'RH',
        email: 'a@b.c',
      }),
    );

    const recree = recreerService();

    expect(recree.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });

  it('ne restaure pas une session expirée au démarrage et purge le stockage', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(
      'ge_auth',
      JSON.stringify({ token: 't', expiration: past, role: 'RH', email: 'a@b.c' }),
    );

    const recree = recreerService();

    expect(recree.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });

  it("cesse d'être authentifié une fois l'expiration franchie, sans nouvel appel", () => {
    vi.useFakeTimers();
    const recree = recreerService();
    connecter(recree, 60_000);
    expect(recree.isAuthenticated()).toBe(true);

    // Avance l'horloge sans déclencher les timers : seule la relecture de
    // l'expiration doit faire basculer l'état.
    vi.setSystemTime(new Date(Date.now() + 61_000));

    expect(recree.isAuthenticated()).toBe(false);
    expect(recree.getToken()).toBeNull();
  });

  it("signale l'expiration et vide la session à l'échéance du token", () => {
    vi.useFakeTimers();
    const recree = recreerService();
    connecter(recree, 60_000);
    expect(recree.sessionExpiree()).toBe(false);

    vi.advanceTimersByTime(60_001);

    expect(recree.sessionExpiree()).toBe(true);
    expect(recree.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });

  it("remet sessionExpiree à false lorsqu'on se reconnecte", () => {
    vi.useFakeTimers();
    const recree = recreerService();
    connecter(recree, 60_000);
    vi.advanceTimersByTime(60_001);
    expect(recree.sessionExpiree()).toBe(true);

    connecter(recree, 60_000);

    expect(recree.sessionExpiree()).toBe(false);
    expect(recree.isAuthenticated()).toBe(true);
  });

  it('désarme le timer au logout manuel', () => {
    vi.useFakeTimers();
    const recree = recreerService();
    connecter(recree, 60_000);

    recree.logout();
    vi.advanceTimersByTime(60_001);

    // Une déconnexion volontaire ne doit pas être signalée comme une expiration.
    expect(recree.sessionExpiree()).toBe(false);
  });

  it('poste la demande de code sur /auth/mot-de-passe-oublie', () => {
    let recu: { message: string } | undefined;
    service.demanderCodeReinitialisation({ email: 'a@b.c' }).subscribe((r) => (recu = r));

    const req = httpMock.expectOne(`${base}/auth/mot-de-passe-oublie`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.c' });
    req.flush({ message: 'Si un compte existe, un code a été envoyé.' });

    expect(recu?.message).toBe('Si un compte existe, un code a été envoyé.');
  });

  it("n'ouvre aucune session sur une demande de code", () => {
    service.demanderCodeReinitialisation({ email: 'a@b.c' }).subscribe();
    httpMock.expectOne(`${base}/auth/mot-de-passe-oublie`).flush({ message: 'ok' });

    expect(service.isAuthenticated()).toBe(false);
  });

  it('poste la réinitialisation sur /auth/reinitialiser', () => {
    let recu: { succes: boolean; message: string } | undefined;
    service
      .reinitialiserMotDePasse({
        email: 'a@b.c',
        code: '123456',
        nouveauMotDePasse: 'secret1',
      })
      .subscribe((r) => (recu = r));

    const req = httpMock.expectOne(`${base}/auth/reinitialiser`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'a@b.c',
      code: '123456',
      nouveauMotDePasse: 'secret1',
    });
    req.flush({ succes: true, message: 'Mot de passe réinitialisé.' });

    expect(recu?.succes).toBe(true);
  });

  it('efface la session au logout', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 't',
      expiration: future,
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });
});
