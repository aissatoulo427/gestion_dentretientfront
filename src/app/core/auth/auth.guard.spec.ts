import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { API_BASE_URL } from '../api.config';
import { AuthSession, Role } from '../models';
import { adminGuard, authGuard, employeGuard, rhGuard } from './auth.guard';

/**
 * Tests de caractérisation : ils verrouillent le comportement existant des gardes,
 * que la refonte de l'expiration de session ne doit pas altérer.
 */
describe('authGuard', () => {
  const base = 'http://test/api';

  /** Prépare un injecteur neuf avec la session voulue déjà en stockage. */
  function configurer(session: AuthSession | null): void {
    localStorage.clear();
    if (session) localStorage.setItem('ge_auth', JSON.stringify(session));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
  }

  function sessionValide(role: AuthSession['role'] = 'RH'): AuthSession {
    return {
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      role,
      personneId: 36,
      nom: 'Lo',
      email: 'a@b.c',
    };
  }

  function executer(url: string) {
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  afterEach(() => localStorage.clear());

  it('laisse passer une session valide', () => {
    configurer(sessionValide());

    expect(executer('/demandes')).toBe(true);
  });

  it("redirige vers /login en conservant l'url demandée", () => {
    configurer(null);

    const resultat = executer('/demandes') as UrlTree;

    expect(resultat).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultat)).toBe(
      '/login?redirectTo=%2Fdemandes',
    );
  });

  it('redirige une session expirée vers /login', () => {
    configurer({
      token: 'jwt',
      expiration: new Date(Date.now() - 1000).toISOString(),
      role: 'RH',
      personneId: 36,
      nom: 'Lo',
      email: 'a@b.c',
    });

    expect(executer('/demandes')).toBeInstanceOf(UrlTree);
  });
});

describe('rhGuard', () => {
  const base = 'http://test/api';

  function configurer(role: AuthSession['role']): void {
    localStorage.clear();
    localStorage.setItem(
      'ge_auth',
      JSON.stringify({
        token: 'jwt',
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        role,
        personneId: 36,
        nom: 'Lo',
        email: 'a@b.c',
      }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
  }

  function executer() {
    return TestBed.runInInjectionContext(() =>
      rhGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  afterEach(() => localStorage.clear());

  it('laisse passer un RH', () => {
    configurer('RH');

    expect(executer()).toBe(true);
  });

  it('renvoie un manager vers son tableau de bord', () => {
    configurer('Manager');

    expect(TestBed.inject(Router).serializeUrl(executer() as UrlTree)).toBe('/dashboard');
  });

  it('renvoie un évaluateur technique vers son tableau de bord', () => {
    configurer('EvaluateurTechnique');

    expect(TestBed.inject(Router).serializeUrl(executer() as UrlTree)).toBe('/dashboard');
  });

  it("renvoie l'admin vers son tableau de bord : il ne recrute pas", () => {
    configurer('Admin');

    expect(TestBed.inject(Router).serializeUrl(executer() as UrlTree)).toBe('/dashboard');
  });
});

describe('adminGuard', () => {
  const base = 'http://test/api';

  function configurer(role: Role): void {
    localStorage.clear();
    localStorage.setItem(
      'ge_auth',
      JSON.stringify({
        token: 'jwt',
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        role,
        personneId: 36,
        nom: 'Lo',
        email: 'a@b.c',
      }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
  }

  function executer() {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  afterEach(() => localStorage.clear());

  it("laisse passer l'admin", () => {
    configurer('Admin');

    expect(executer()).toBe(true);
  });

  it('renvoie un RH vers son tableau de bord', () => {
    configurer('RH');

    expect(TestBed.inject(Router).serializeUrl(executer() as UrlTree)).toBe('/dashboard');
  });
});

describe('employeGuard', () => {
  const base = 'http://test/api';

  function configurer(role: Role): void {
    localStorage.clear();
    localStorage.setItem(
      'ge_auth',
      JSON.stringify({
        token: 'jwt',
        expiration: new Date(Date.now() + 3_600_000).toISOString(),
        role,
        personneId: 36,
        nom: 'Lo',
        email: 'a@b.c',
      }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
  }

  function executer() {
    return TestBed.runInInjectionContext(() =>
      employeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  afterEach(() => localStorage.clear());

  it('laisse passer les trois rôles qui font passer des entretiens', () => {
    for (const role of ['RH', 'EvaluateurTechnique', 'Manager'] as Role[]) {
      configurer(role);
      expect(executer()).toBe(true);
    }
  });

  it("écarte l'admin, qui ne pose pas de créneau et n'évalue pas", () => {
    configurer('Admin');

    expect(TestBed.inject(Router).serializeUrl(executer() as UrlTree)).toBe('/dashboard');
  });
});
