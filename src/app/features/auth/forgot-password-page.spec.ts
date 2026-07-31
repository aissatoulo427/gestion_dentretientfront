import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { ForgotPasswordPage } from './forgot-password-page';

describe('ForgotPasswordPage', () => {
  const base = 'http://test/api';
  let fixture: ComponentFixture<ForgotPasswordPage>;
  let page: ForgotPasswordPage;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordPage);
    page = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** Amène le composant à l'étape 3 avec un email et un code saisis. */
  function allerJusquAuMotDePasse(email = 'a@b.c', code = '246621'): void {
    page.demandeForm.setValue({ email });
    page.soumettreDemande();
    httpMock
      .expectOne(`${base}/auth/mot-de-passe-oublie`)
      .flush({ succes: true, message: 'Si un compte existe, un code vient d’être envoyé.' });
    page.codeForm.setValue({ email, code });
    page.validerCode();
    httpMock
      .expectOne(`${base}/auth/verifier-code`)
      .flush({ succes: true, message: 'Code valide.' });
  }

  // --- Étape 1 : demande du code ---

  it("passe à l'étape 2 et reporte l'email après l'envoi du code", () => {
    page.demandeForm.setValue({ email: 'a@b.c' });

    page.soumettreDemande();
    const req = httpMock.expectOne(`${base}/auth/mot-de-passe-oublie`);
    expect(req.request.body).toEqual({ email: 'a@b.c' });
    req.flush({ succes: true, message: 'Si un compte existe, un code vient d’être envoyé.' });

    expect(page.step()).toBe(2);
    expect(page.codeForm.controls.email.value).toBe('a@b.c');
  });

  it("reste à l'étape 1 sans requête si l'email est mal formé", () => {
    page.demandeForm.setValue({ email: 'pas-un-email' });

    page.soumettreDemande();

    httpMock.expectNone(`${base}/auth/mot-de-passe-oublie`);
    expect(page.step()).toBe(1);
  });

  it("reste à l'étape 1 quand l'API refuse l'adresse", () => {
    page.demandeForm.setValue({ email: 'inconnu@test.com' });

    page.soumettreDemande();
    httpMock.expectOne(`${base}/auth/mot-de-passe-oublie`).flush(
      { succes: false, message: 'Email incorrect.' },
      { status: 400, statusText: 'Bad Request' },
    );

    // On n'envoie pas l'utilisateur saisir un code qui n'arrivera jamais.
    expect(page.step()).toBe(1);
    expect(page.busy()).toBe(false);
  });

  it("reste à l'étape 1 sur un 200 porteur de succes: false", () => {
    page.demandeForm.setValue({ email: 'inconnu@test.com' });

    page.soumettreDemande();
    httpMock
      .expectOne(`${base}/auth/mot-de-passe-oublie`)
      .flush({ succes: false, message: 'Email incorrect.' });

    // Le code HTTP ne fait pas foi : c'est `succes` qui tranche.
    expect(page.step()).toBe(1);
    expect(page.busy()).toBe(false);
  });

  it("permet de rejoindre l'étape 2 avec un code déjà reçu", () => {
    expect(page.step()).toBe(1);

    page.allerAuCode();

    expect(page.step()).toBe(2);
  });

  // --- Étape 2 : le code, sans appel réseau ---

  it('fait vérifier le code par l’API avant de laisser choisir un mot de passe', () => {
    page.allerAuCode();
    page.codeForm.setValue({ email: 'a@b.c', code: '246621' });

    page.validerCode();

    const req = httpMock.expectOne(`${base}/auth/verifier-code`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.c', code: '246621' });
    // Tant que l'API n'a pas répondu, on ne montre pas l'écran du mot de passe.
    expect(page.step()).toBe(2);

    req.flush({ succes: true, message: 'Code valide.' });

    expect(page.step()).toBe(3);
    httpMock.expectNone(`${base}/auth/reinitialiser`);
  });

  it("annonce un code invalide sans faire saisir de mot de passe", () => {
    page.allerAuCode();
    page.codeForm.setValue({ email: 'a@b.c', code: '000000' });

    page.validerCode();
    httpMock
      .expectOne(`${base}/auth/verifier-code`)
      .flush(
        { succes: false, message: 'Code invalide ou expiré.' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(page.step()).toBe(2);
    expect(page.busy()).toBe(false);
  });

  it("refuse aussi un code rejeté par un 200 porteur de succes: false", () => {
    page.allerAuCode();
    page.codeForm.setValue({ email: 'a@b.c', code: '000000' });

    page.validerCode();
    httpMock
      .expectOne(`${base}/auth/verifier-code`)
      .flush({ succes: false, message: 'Code invalide ou expiré.' });

    expect(page.step()).toBe(2);
  });

  it("reste à l'étape 2 si le code n'a pas 6 chiffres", () => {
    page.allerAuCode();

    for (const code of ['123', '1234567', '12345a']) {
      page.codeForm.setValue({ email: 'a@b.c', code });
      page.validerCode();

      expect(page.step()).toBe(2);
      expect(page.codeForm.controls.code.invalid).toBe(true);
    }

    page.codeForm.setValue({ email: 'a@b.c', code: '246621' });
    page.validerCode();
    httpMock
      .expectOne(`${base}/auth/verifier-code`)
      .flush({ succes: true, message: 'Code valide.' });

    expect(page.step()).toBe(3);
  });

  it("reste à l'étape 2 si le code est vide", () => {
    page.allerAuCode();
    page.codeForm.setValue({ email: 'a@b.c', code: '' });

    page.validerCode();

    expect(page.step()).toBe(2);
    expect(page.codeForm.invalid).toBe(true);
  });

  it("revient à l'étape 2 pour corriger le code sans perdre sa saisie", () => {
    allerJusquAuMotDePasse();

    page.retourAuCode();

    expect(page.step()).toBe(2);
    expect(page.codeForm.controls.code.value).toBe('246621');
  });

  // --- Étape 3 : le nouveau mot de passe ---

  it("n'envoie pas la réinitialisation si la confirmation diffère", () => {
    allerJusquAuMotDePasse();
    page.motDePasseForm.setValue({
      nouveauMotDePasse: 'secret1',
      confirmation: 'secret2',
    });

    page.soumettreReset();

    expect(page.motDePasseForm.invalid).toBe(true);
    httpMock.expectNone(`${base}/auth/reinitialiser`);
  });

  it("assemble email, code et mot de passe puis redirige vers /login", () => {
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    allerJusquAuMotDePasse('u@test.com', '246621');
    page.motDePasseForm.setValue({
      nouveauMotDePasse: 'secret1',
      confirmation: 'secret1',
    });

    page.soumettreReset();
    const req = httpMock.expectOne(`${base}/auth/reinitialiser`);
    expect(req.request.body).toEqual({
      email: 'u@test.com',
      code: '246621',
      nouveauMotDePasse: 'secret1',
    });
    req.flush({ succes: true, message: 'Mot de passe réinitialisé.' });

    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it("appelle /auth/activer et non /auth/reinitialiser en mode activation", async () => {
    // Le mode vient des données de route : on reconstruit le composant avec.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { mode: 'activation' } } },
        },
      ],
    }).compileComponents();

    const fixtureActivation = TestBed.createComponent(ForgotPasswordPage);
    const pageActivation = fixtureActivation.componentInstance;
    const mock = TestBed.inject(HttpTestingController);
    fixtureActivation.detectChanges();
    // Aucune route n'est déclarée : on neutralise la redirection finale.
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(pageActivation.estActivation).toBe(true);

    pageActivation.codeForm.setValue({ email: 'u@test.com', code: '246621' });
    pageActivation.validerCode();
    mock.expectOne(`${base}/auth/verifier-code`).flush({ succes: true, message: 'ok' });
    pageActivation.motDePasseForm.setValue({
      nouveauMotDePasse: 'secret1',
      confirmation: 'secret1',
    });
    pageActivation.soumettreReset();

    const req = mock.expectOne(`${base}/auth/activer`);
    expect(req.request.body).toEqual({
      email: 'u@test.com',
      code: '246621',
      nouveauMotDePasse: 'secret1',
    });
    req.flush({ succes: true, message: 'Compte activé.' });
    mock.verify();
  });

  it("renvoie à l'étape du code quand le backend refuse le code", () => {
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    allerJusquAuMotDePasse();
    page.motDePasseForm.setValue({
      nouveauMotDePasse: 'secret1',
      confirmation: 'secret1',
    });

    page.soumettreReset();
    httpMock
      .expectOne(`${base}/auth/reinitialiser`)
      .flush({ succes: false, message: 'Code invalide ou expiré.' });

    expect(page.step()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });
});
