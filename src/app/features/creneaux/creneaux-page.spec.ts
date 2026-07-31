import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { CreneauxPage } from './creneaux-page';

describe('CreneauxPage', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<CreneauxPage>;
  let page: CreneauxPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [CreneauxPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

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

    fixture = TestBed.createComponent(CreneauxPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    // Chargements initiaux : créneaux de la page + annuaire du DirectoryService.
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("ne poste pas de propriétaire : l'API lit le claim", () => {
    page.form.setValue({
      dateDebut: '2026-08-10T09:00',
      dateFin: '2026-08-10T10:00',
    });

    page.submit();

    const req = httpMock.expectOne(`${base}/creneaux`);
    expect(req.request.body).toEqual({
      dateDebut: '2026-08-10T09:00:00',
      dateFin: '2026-08-10T10:00:00',
    });
    req.flush({
      id: 8,
      dateDebut: '2026-08-10T09:00:00',
      dateFin: '2026-08-10T10:00:00',
      disponible: true,
      employeId: 36,
      demandeEntretienId: null,
    });
  });
});
