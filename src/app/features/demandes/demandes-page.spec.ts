import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { DemandesPage } from './demandes-page';

describe('DemandesPage', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<DemandesPage>;
  let page: DemandesPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DemandesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    // Session : l'API lit le RH organisateur dans le token.
    const auth = TestBed.inject(AuthService);
    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });

    fixture = TestBed.createComponent(DemandesPage);
    page = fixture.componentInstance;
    httpMock.expectOne(`${base}/demandes`).flush([]);
    fixture.detectChanges();

    // Aucune route n'est déclarée : on neutralise la redirection post-création.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("ne poste ni organisateur ni typeEntretien : l'API lit le claim", () => {
    page.form.setValue({ candidatId: 35, poste: 'Dev .NET' });

    page.submit();

    const req = httpMock.expectOne(`${base}/demandes`);
    expect(req.request.body).toEqual({
      candidatId: 35,
      poste: 'Dev .NET',
    });
    req.flush({
      id: 8,
      poste: 'Dev .NET',
      dateCreation: '2026-07-30T11:00:00',
      statut: 'Creee',
      rhId: 36,
      candidatId: 35,
    });
  });
});
