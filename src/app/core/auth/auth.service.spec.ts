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
    req.flush({ token: 'jwt-123', expiration: future, role: 'Recruteur' });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.getToken()).toBe('jwt-123');
    expect(service.role()).toBe('Recruteur');
  });

  it('considère un token expiré comme non authentifié', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock
      .expectOne(`${base}/auth/login`)
      .flush({ token: 't', expiration: past, role: 'Manager' });

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  it('efface la session au logout', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    service.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock
      .expectOne(`${base}/auth/login`)
      .flush({ token: 't', expiration: future, role: 'Recruteur' });

    service.logout();
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });
});
