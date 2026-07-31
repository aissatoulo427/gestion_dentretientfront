import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { AuthService } from '../../core/auth/auth.service';
import { Entretien } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { EntretienDetail } from './entretien-detail';

/** Entretien complet conforme au contrat, surchargeable par test. */
export function unEntretien(patch: Partial<Entretien> = {}): Entretien {
  return {
    id: 6,
    dateHeure: '2026-08-12T14:00:00',
    lieuOuLien: 'Salle A',
    statut: 'Planifie',
    modalite: 'Presentiel',
    typeEntretien: 'Technique',
    demandeEntretienId: 8,
    candidatId: 35,
    evaluateurIds: [32, 33],
    creneauId: 9,
    ...patch,
  };
}

describe('EntretienDetail', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<EntretienDetail>;
  let page: EntretienDetail;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EntretienDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EntretienDetail);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("charge la demande pour connaître l'organisateur", () => {
    page.chargerPourTest(6);

    httpMock.expectOne(`${base}/entretiens/6`).flush(unEntretien());
    httpMock.expectOne(`${base}/demandes/8`).flush({
      id: 8,
      poste: 'Dev .NET',
      dateCreation: '2026-07-30T11:00:00',
      statut: 'Planifiee',
      rhId: 32,
      candidatId: 35,
    });
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(page.demande()?.rhId).toBe(32);
  });

  it('affiche le message renvoyé par le backend après confirmation', () => {
    const notify = TestBed.inject(NotificationService);
    page.chargerPourTest(6);
    httpMock.expectOne(`${base}/entretiens/6`).flush(unEntretien());
    httpMock.match(() => true).forEach((r) => r.flush([]));

    page.confirmer();
    httpMock
      .expectOne(`${base}/entretiens/6/confirmer`)
      .flush({ succes: true, message: 'Présence confirmée, e-mail envoyé au candidat.' });
    httpMock.expectOne(`${base}/entretiens/6`).flush(unEntretien({ statut: 'Confirme' }));
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(
      notify.toasts().some((t) => t.message === 'Présence confirmée, e-mail envoyé au candidat.'),
    ).toBe(true);
  });

  it('reprogramme en ne postant que le nouveau créneau', () => {
    page.chargerPourTest(6);
    httpMock.expectOne(`${base}/entretiens/6`).flush(unEntretien());
    httpMock.match(() => true).forEach((r) => r.flush([]));

    page.openReprog();
    page.reprogForm.setValue({ nouveauCreneauId: 10 });
    page.submitReprog();

    const req = httpMock.expectOne(`${base}/entretiens/6/reprogrammer`);
    // L'horaire est déduit du créneau côté API : aucune date n'est envoyée.
    expect(req.request.body).toEqual({ nouveauCreneauId: 10 });
    req.flush(null);
  });

  /** Ouvre une session pour la personne `id`. */
  function connecter(id: number): void {
    const auth = TestBed.inject(AuthService);
    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      id,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'RH',
    });
  }

  /** Charge l'entretien et sa demande, puis vide les requêtes annexes. */
  function charger(
    entretien = unEntretien(),
    feedbacks: unknown[] = [],
    rhId = 32,
  ): void {
    page.chargerPourTest(entretien.id);
    httpMock.expectOne(`${base}/entretiens/${entretien.id}`).flush(entretien);
    httpMock
      .match(`${base}/demandes/${entretien.demandeEntretienId}`)
      .forEach((r) =>
        r.flush({
          id: entretien.demandeEntretienId,
          poste: 'Dev .NET',
          dateCreation: '2026-07-30T11:00:00',
          statut: 'Planifiee',
          rhId,
          candidatId: 35,
        }),
      );
    httpMock
      .match(`${base}/feedbacks?entretienId=${entretien.id}`)
      .forEach((r) => r.flush(feedbacks));
    httpMock.match(() => true).forEach((r) => r.flush([]));
  }

  it('ouvre les actions au RH organisateur de la demande', () => {
    connecter(32);
    charger(unEntretien(), [], 32);

    expect(page.canAct()).toBe(true);
    expect(page.raisonActionsIndisponibles()).toBeNull();
  });

  it("ferme les actions à un évaluateur qui n'a pas créé la demande", () => {
    connecter(33);
    charger(unEntretien(), [], 32);

    expect(page.canAct()).toBe(false);
    expect(page.raisonActionsIndisponibles()).toContain('RH');
  });

  it('ferme les actions sur un entretien terminé, même pour son organisateur', () => {
    connecter(32);
    charger(unEntretien({ statut: 'Termine' }), [], 32);

    expect(page.canAct()).toBe(false);
    expect(page.raisonActionsIndisponibles()).toContain('statut');
  });

  it('interdit la saisie à qui ne figure pas au panel', () => {
    connecter(99);
    charger(unEntretien({ evaluateurIds: [32, 33] }));

    expect(page.peutSaisirCompteRendu()).toBe(false);
    expect(page.raisonBlocage()).toContain('panel');
  });

  it('interdit une seconde saisie au même évaluateur', () => {
    connecter(33);
    charger(unEntretien({ evaluateurIds: [32, 33] }), [
      {
        id: 2,
        note: 4,
        commentaire: 'ok',
        decision: 'Favorable',
        dateSaisie: '2026-07-30T11:04:20',
        entretienId: 6,
        auteurId: 33,
      },
    ]);

    expect(page.peutSaisirCompteRendu()).toBe(false);
    expect(page.raisonBlocage()).toContain('déjà');
  });

  it("autorise un évaluateur du panel qui n'a pas encore déposé", () => {
    connecter(33);
    charger(unEntretien({ evaluateurIds: [32, 33] }));

    expect(page.peutSaisirCompteRendu()).toBe(true);
    expect(page.raisonBlocage()).toBeNull();
  });

  it("poste le compte-rendu sans auteurId : l'API lit le claim", () => {
    connecter(33);
    charger(unEntretien({ evaluateurIds: [32, 33] }));

    page.openFeedback();
    page.feedbackForm.setValue({
      note: 4,
      decision: 'Favorable',
      commentaire: 'Bon niveau technique.',
    });
    page.submitFeedback();

    const req = httpMock.expectOne(`${base}/feedbacks`);
    expect(req.request.body).toEqual({
      entretienId: 6,
      note: 4,
      commentaire: 'Bon niveau technique.',
      decision: 'Favorable',
    });
  });
});
