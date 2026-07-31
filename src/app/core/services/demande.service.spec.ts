import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.config';
import { DemandeService } from './demande.service';

describe('DemandeService', () => {
  let service: DemandeService;
  let httpMock: HttpTestingController;
  const base = 'http://test/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: base },
      ],
    });
    service = TestBed.inject(DemandeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('crée une demande via POST /demandes', () => {
    const payload = { candidatId: 2, poste: 'Dev' };
    service.create(payload).subscribe();
    const req = httpMock.expectOne(`${base}/demandes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 1, ...payload, rhId: 1, dateCreation: '', statut: 'Creee' });
  });

  it('récupère les créneaux disponibles', () => {
    service.getCreneauxDisponibles(5).subscribe();
    const req = httpMock.expectOne(`${base}/demandes/5/creneaux-disponibles`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('annule une demande via POST /demandes/{id}/annuler', () => {
    service.annuler(7).subscribe();
    const req = httpMock.expectOne(`${base}/demandes/7/annuler`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
