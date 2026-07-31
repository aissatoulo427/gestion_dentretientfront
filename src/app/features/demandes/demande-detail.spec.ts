import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { NotificationService } from '../../core/notification.service';
import { DemandeDetail } from './demande-detail';

const DEMANDE = {
  id: 8,
  poste: 'Dev .NET',
  dateCreation: '2026-07-30T11:00:00',
  statut: 'Creee' as const,
  rhId: 32,
  candidatId: 35,
};

describe('DemandeDetail — planification', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<DemandeDetail>;
  let page: DemandeDetail;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DemandeDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DemandeDetail);
    page = fixture.componentInstance;
    fixture.detectChanges();

    page.chargerPourTest(8);
    httpMock.expectOne(`${base}/demandes/8`).flush(DEMANDE);
    httpMock.expectOne(`${base}/demandes/8/creneaux-disponibles`).flush([]);
    httpMock.expectOne(`${base}/entretiens`).flush([]);
    // Un employé par rôle : le panel doit pouvoir satisfaire chaque type de tour.
    httpMock
      .match(`${base}/personnes/rh`)
      .forEach((r) => r.flush([{ id: 32, nom: 'Lo', email: 'rh@x.com' }]));
    httpMock
      .match(`${base}/personnes/evaluateurs-techniques`)
      .forEach((r) => r.flush([{ id: 33, nom: 'Sy', email: 'tech@x.com' }]));
    httpMock
      .match(`${base}/personnes/managers`)
      .forEach((r) => r.flush([{ id: 34, nom: 'Ba', email: 'mgr@x.com' }]));
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => localStorage.clear());

  it("refuse un tour Technique dont le panel n'a aucun évaluateur technique", () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32], // uniquement le RH
    });

    page.submitPlan();

    expect(page.planForm.hasError('roleManquantAuPanel')).toBe(true);
    httpMock.expectNone(`${base}/entretiens`);
  });

  it('accepte un tour Technique dès que le rôle exigé est présent', () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32, 33], // le RH ne gêne pas : « au moins un », pas « seulement »
    });

    expect(page.planForm.hasError('roleManquantAuPanel')).toBe(false);
  });

  it('exige un manager sur un tour Managerial', () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Managerial',
      evaluateurIds: [33],
    });

    expect(page.planForm.hasError('roleManquantAuPanel')).toBe(true);

    page.planForm.patchValue({ evaluateurIds: [33, 34] });

    expect(page.planForm.hasError('roleManquantAuPanel')).toBe(false);
  });

  it('refuse la planification avec un panel vide', () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [],
    });

    page.submitPlan();

    expect(page.planForm.invalid).toBe(true);
    httpMock.expectNone(`${base}/entretiens`);
  });

  it('poste typeEntretien et evaluateurIds', () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32, 33],
    });

    page.submitPlan();

    const req = httpMock.expectOne(`${base}/entretiens`);
    // Le créneau est la seule source de vérité pour l'horaire : pas de dateHeure.
    expect(req.request.body).toEqual({
      demandeId: 8,
      creneauId: 9,
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32, 33],
    });
  });

  it("affiche le message renvoyé par le backend après annulation", () => {
    const notify = TestBed.inject(NotificationService);

    page.annuler();
    httpMock
      .expectOne(`${base}/demandes/8/annuler`)
      .flush({ succes: true, message: 'La demande #8 a été annulée.' });
    httpMock.expectOne(`${base}/demandes/8`).flush({ ...DEMANDE, statut: 'Annulee' });
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(notify.toasts().some((t) => t.message === 'La demande #8 a été annulée.')).toBe(true);
  });

  it('coche et décoche un évaluateur', () => {
    page.openPlan();

    page.toggleEvaluateur(33, true);
    expect(page.estEvaluateurCoche(33)).toBe(true);

    page.toggleEvaluateur(33, false);
    expect(page.estEvaluateurCoche(33)).toBe(false);
  });

  it("pré-coche l'organisateur de la demande", () => {
    page.openPlan();

    expect(page.estEvaluateurCoche(32)).toBe(true);
  });
});

describe('DemandeDetail — parcours multi-tours', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<DemandeDetail>;
  let page: DemandeDetail;
  let httpMock: HttpTestingController;

  const tour = (id: number, dateHeure: string, demandeId: number) => ({
    id,
    dateHeure,
    lieuOuLien: 'Salle A',
    statut: 'Planifie' as const,
    modalite: 'Presentiel' as const,
    typeEntretien: 'RH' as const,
    demandeEntretienId: demandeId,
    candidatId: 35,
    evaluateurIds: [32, 33],
    creneauId: 9,
  });

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DemandeDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DemandeDetail);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('liste les tours de la demande, triés par date, en excluant les autres demandes', () => {
    page.chargerPourTest(8);
    httpMock.expectOne(`${base}/demandes/8`).flush(DEMANDE);
    httpMock.expectOne(`${base}/demandes/8/creneaux-disponibles`).flush([]);
    httpMock.expectOne(`${base}/entretiens`).flush([
      tour(7, '2026-08-14T11:00:00', 8),
      tour(6, '2026-08-12T14:00:00', 8),
      tour(9, '2026-08-13T09:00:00', 99),
    ]);
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(page.tours().map((t) => t.id)).toEqual([6, 7]);
  });

  /** Charge la demande avec les tours donnés. */
  function chargerAvecTours(tours: unknown[]): void {
    page.chargerPourTest(8);
    httpMock.expectOne(`${base}/demandes/8`).flush(DEMANDE);
    httpMock.expectOne(`${base}/demandes/8/creneaux-disponibles`).flush([]);
    httpMock.expectOne(`${base}/entretiens`).flush(tours);
    httpMock.match(() => true).forEach((r) => r.flush([]));
  }

  it('suggère le premier type tant que rien n’est planifié', () => {
    chargerAvecTours([]);

    expect(page.prochainTypeSuggere()).toBe('RH');
  });

  it('suggère Technique une fois le tour RH planifié', () => {
    chargerAvecTours([{ ...tour(6, '2026-08-12T14:00:00', 8), typeEntretien: 'RH' }]);

    expect(page.prochainTypeSuggere()).toBe('Technique');
  });

  it('suggère Managerial quand RH et Technique sont passés', () => {
    chargerAvecTours([
      { ...tour(6, '2026-08-12T14:00:00', 8), typeEntretien: 'RH' },
      { ...tour(7, '2026-08-14T11:00:00', 8), typeEntretien: 'Technique' },
    ]);

    expect(page.prochainTypeSuggere()).toBe('Managerial');
  });

  it('ouvre la modale sur le type suggéré, sans le figer', () => {
    chargerAvecTours([{ ...tour(6, '2026-08-12T14:00:00', 8), typeEntretien: 'RH' }]);

    page.openPlan();

    expect(page.planForm.controls.typeEntretien.value).toBe('Technique');
    // Le RH garde la main : les trois types restent choisissables.
    page.planForm.patchValue({ typeEntretien: 'Managerial' });
    expect(page.planForm.controls.typeEntretien.value).toBe('Managerial');
  });

  it('compte les comptes-rendus déposés par tour', () => {
    page.chargerPourTest(8);
    httpMock.expectOne(`${base}/demandes/8`).flush(DEMANDE);
    httpMock.expectOne(`${base}/demandes/8/creneaux-disponibles`).flush([]);
    httpMock.expectOne(`${base}/entretiens`).flush([tour(6, '2026-08-12T14:00:00', 8)]);
    httpMock.match(`${base}/feedbacks?entretienId=6`).forEach((r) =>
      r.flush([
        {
          id: 2,
          note: 4,
          commentaire: 'ok',
          decision: 'Favorable',
          dateSaisie: '2026-07-30T11:04:20',
          entretienId: 6,
          auteurId: 33,
        },
      ]),
    );
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(page.comptesRendus().get(6)).toBe(1);
  });
});
