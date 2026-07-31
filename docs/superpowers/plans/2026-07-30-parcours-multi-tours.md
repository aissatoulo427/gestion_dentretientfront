# Parcours multi-tours et panel d'évaluateurs — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le front sur le contrat d'API du 30/07/2026 : une demande porte plusieurs tours d'entretien, chaque tour a un type et un panel d'évaluateurs, et seul un membre du panel saisit son compte-rendu.

**Architecture:** Aucune couche nouvelle. Le détail de demande devient le hub du parcours (liste de tours au lieu d'un entretien unique). La session enrichie par le login (`id`, `nom`) alimente `recruteurId` et `auteurId`, ce qui supprime trois menus de sélection manuelle. Les écrans existants suivent les patterns en place : composants standalone, signals, formulaires réactifs, services injectés.

**Tech Stack:** Angular 21 (standalone, signals, `@if`/`@for`), Tailwind 4, RxJS 7, Vitest + `HttpTestingController`.

## Global Constraints

- Spec de référence : `docs/superpowers/specs/2026-07-30-parcours-multi-tours-design.md`
- Commande de test unique : `npx ng test --watch=false`. Il n'y a pas de filtrage par fichier configuré : chaque exécution passe toute la suite (~4 s).
- Vérification finale de chaque phase : `npx ng build --configuration production` — les templates ne sont pas couverts par les tests, seul le build les compile.
- Enums envoyés et reçus **en texte** (`'RH'`, `'Presentiel'`…), jamais en nombre.
- Dates envoyées au format `"yyyy-MM-ddTHH:mm:ss"` via `toApiDateTime` (`shared/format.ts`).
- Toute réponse sans ressource a la forme `{ succes: false, message: "…" }`, quel que soit le code HTTP.
- Les erreurs HTTP sont affichées par `httpErrorInterceptor` : **aucun composant ne construit de message d'erreur**, il relâche seulement son signal `busy`/`saving`.
- Classes CSS existantes à réutiliser : `.label`, `.input`, `.select`, `.field-error`, `.btn-primary`, `.btn-ghost`, `.btn-accent`, `.btn-sm`, `.card`, `.card-pad`, `.section-title`, `.kicker`, `.table`, `.page-title`, `.page-subtitle`.
- **L'utilisateur a demandé de ne pas commiter.** Les étapes « Commit » sont fournies pour référence : les exécuter uniquement sur accord explicite.

---

## Phase 1 — Session et modèles

### Task 1: Session enrichie par le login

**Files:**
- Modify: `src/app/core/models/auth.model.ts`
- Modify: `src/app/core/auth/auth.service.ts:33-46,66-90`
- Modify: `src/app/layout/shell.html`
- Test: `src/app/core/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces: `AuthService.personneId(): number | null`, `AuthService.nom(): string | null`. `AuthSession` gagne `personneId: number` et `nom: string`. Les tâches 3, 4 et 8 consomment `personneId()`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/app/core/auth/auth.service.spec.ts`, remplacer le helper `connecter` par une version qui renvoie l'identité complète, et ajouter deux tests :

```ts
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
      role: 'Recruteur',
    });
  }

  it("lit l'identité dans la réponse de login, pas dans le formulaire", () => {
    service.login({ email: 'saisi@formulaire.com', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'Recruteur',
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
        role: 'Recruteur',
        email: 'a@b.c',
      }),
    );

    const recree = recreerService();

    expect(recree.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('ge_auth')).toBeNull();
  });
```

Mettre aussi à jour les trois `flush({ token: …, expiration: …, role: … })` des tests existants (`stocke la session et le token après un login réussi`, `considère un token expiré comme non authentifié`, `efface la session au logout`) pour y ajouter `id: 36, nom: 'Lo', email: 'u@test.com'`.

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `TS2339: Property 'personneId' does not exist on type 'AuthService'` et `Property 'nom' does not exist`.

- [ ] **Step 3: Étendre les modèles**

Dans `src/app/core/models/auth.model.ts` :

```ts
export interface LoginResponse {
  token: string;
  expiration: string;
  id: number;
  nom: string;
  email: string;
  role: Role;
}

/** Session persistée localement. */
export interface AuthSession {
  token: string;
  expiration: string;
  role: Role;
  personneId: number;
  nom: string;
  email: string;
}
```

- [ ] **Step 4: Construire la session depuis la réponse**

Dans `src/app/core/auth/auth.service.ts`, remplacer le corps de `login` :

```ts
  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, payload)
      .pipe(
        tap((res) =>
          this.setSession({
            token: res.token,
            expiration: res.expiration,
            role: res.role,
            personneId: res.id,
            nom: res.nom,
            email: res.email,
          }),
        ),
      );
  }
```

Ajouter les deux `computed` à côté de `role` et `email` :

```ts
  readonly personneId = computed<number | null>(() => this._session()?.personneId ?? null);
  readonly nom = computed(() => this._session()?.nom ?? null);
```

Dans `read()`, rejeter les sessions écrites avant ce changement, juste après le contrôle d'expiration :

```ts
      const session = JSON.parse(raw) as AuthSession;
      // Session écrite avant l'enrichissement du login : incomplète, on repart d'un login propre.
      if (this.estExpiree(session) || typeof session.personneId !== 'number') {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
```

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS — tous verts.

- [ ] **Step 6: Afficher le nom dans le shell**

Dans `src/app/layout/shell.html`, remplacer l'interpolation `{{ email() }}` par `{{ nom() }}` (l'email reste affiché en dessous s'il y figure déjà). Exposer le signal dans `src/app/layout/shell.ts`, à côté de `role` et `email` :

```ts
  readonly nom = this.auth.nom;
```

- [ ] **Step 7: Vérifier le build**

Run: `npx ng build --configuration production`
Expected: `Application bundle generation complete.` sans erreur.

- [ ] **Step 8: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/core/models/auth.model.ts src/app/core/auth/auth.service.ts src/app/core/auth/auth.service.spec.ts src/app/layout/shell.ts src/app/layout/shell.html
git commit -m "feat(auth): lire id, nom et email dans la reponse de login"
```

---

### Task 2: Supprimer le message de 401 codé en dur

**Files:**
- Modify: `src/app/core/http-error.interceptor.ts:53-58`
- Test: `src/app/core/http-error.interceptor.spec.ts`

**Interfaces:**
- Consumes: `PUBLIC_ENDPOINTS` et `isEndpointPublic` (déjà en place).
- Produces: rien de nouveau. `extractErrorMessage` conserve sa signature.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans le `describe('httpErrorInterceptor — traitement du 401')` de `src/app/core/http-error.interceptor.spec.ts` :

```ts
  it('affiche le message du backend sur un 401 de login', () => {
    const notify = TestBed.inject(NotificationService);

    http.post(`${base}/auth/login`, {}).subscribe({ error: () => {} });
    httpMock.expectOne(`${base}/auth/login`).flush(
      { succes: false, message: 'Email ou mot de passe invalide.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(notify.toasts().some((t) => t.message === 'Email ou mot de passe invalide.')).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
```

Ajouter l'import manquant en tête de fichier :

```ts
import { NotificationService } from './notification.service';
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — le toast contient « Email ou mot de passe incorrect. » (message codé en dur) au lieu du message du backend.

- [ ] **Step 3: Supprimer le cas spécial**

Dans `src/app/core/http-error.interceptor.ts`, remplacer le bloc de calcul du message par :

```ts
      const message = extractErrorMessage(error);
      notifications.error(message);
      return throwError(() => new Error(message));
```

Supprimer la constante `isLoginRequest`, devenue inutilisée.

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/core/http-error.interceptor.ts src/app/core/http-error.interceptor.spec.ts
git commit -m "refactor(http): laisser le backend fournir le message de 401"
```

---

### Task 3: Demande sans typeEntretien, recruteur implicite

**Files:**
- Modify: `src/app/core/models/demande.model.ts`
- Modify: `src/app/features/demandes/demandes-page.ts:32,37,43-48,66-75,86-94`
- Modify: `src/app/features/demandes/demandes-page.html:36,55-61,89`
- Modify: `src/app/features/demandes/demande-detail.html:13`
- Test: `src/app/features/demandes/demandes-page.spec.ts` *(nouveau)*
- Test: `src/app/core/services/demande.service.spec.ts:29-36`

**Interfaces:**
- Consumes: `AuthService.personneId()` (Task 1).
- Produces: `CreateDemande` sans `typeEntretien` — `{ recruteurId: number; candidatId: number; poste: string }`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/app/features/demandes/demandes-page.spec.ts` :

```ts
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

    // Session : l'id du connecté sert de recruteurId.
    const auth = TestBed.inject(AuthService);
    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      id: 36,
      nom: 'Lo',
      email: 'u@test.com',
      role: 'Recruteur',
    });

    fixture = TestBed.createComponent(DemandesPage);
    page = fixture.componentInstance;
    httpMock.expectOne(`${base}/demandes`).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it("poste l'id du connecté en recruteurId, sans typeEntretien", () => {
    page.form.setValue({ candidatId: 35, poste: 'Dev .NET' });

    page.submit();

    const req = httpMock.expectOne(`${base}/demandes`);
    expect(req.request.body).toEqual({
      recruteurId: 36,
      candidatId: 35,
      poste: 'Dev .NET',
    });
    req.flush({
      id: 8,
      poste: 'Dev .NET',
      dateCreation: '2026-07-30T11:00:00',
      statut: 'Creee',
      recruteurId: 36,
      candidatId: 35,
    });
  });
});
```

Mettre à jour `src/app/core/services/demande.service.spec.ts:30` :

```ts
    const payload = { recruteurId: 1, candidatId: 2, poste: 'Dev' };
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `setValue` refuse un objet sans `recruteurId` ni `typeEntretien` (`TS2345`), et `demande.service.spec` échoue sur la forme du payload.

- [ ] **Step 3: Alléger le modèle**

`src/app/core/models/demande.model.ts` :

```ts
import { StatutDemande } from './enums';

export interface Demande {
  id: number;
  poste: string;
  dateCreation: string;
  statut: StatutDemande;
  recruteurId: number;
  candidatId: number;
}

export interface CreateDemande {
  recruteurId: number;
  candidatId: number;
  poste: string;
}
```

- [ ] **Step 4: Alléger le composant**

Dans `src/app/features/demandes/demandes-page.ts` :
- supprimer `TYPE_ENTRETIEN_VALUES` de l'import et la propriété `typeValues` ;
- supprimer le signal `recruteurs` et la propriété `RecruteurManager` de l'import ;
- injecter `AuthService` : `private readonly auth = inject(AuthService);` (import depuis `'../../core/auth/auth.service'`) ;
- remplacer le formulaire, `openModal` et `submit` :

```ts
  readonly form = this.fb.nonNullable.group({
    candidatId: [null as number | null, Validators.required],
    poste: ['', Validators.required],
  });

  openModal(): void {
    this.form.reset({ candidatId: null, poste: '' });
    this.personnes.getCandidats().subscribe((candidats) => this.candidats.set(candidats));
    this.modalOpen.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.demandes
      .create({
        recruteurId: this.auth.personneId()!,
        candidatId: v.candidatId!,
        poste: v.poste,
      })
      .subscribe({
        next: (demande) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.notify.success('Demande créée.');
          this.router.navigate(['/demandes', demande.id]);
        },
        error: () => this.saving.set(false),
      });
  }
```

`forkJoin` n'est plus utilisé : retirer son import.

- [ ] **Step 5: Nettoyer les templates**

Dans `src/app/features/demandes/demandes-page.html`, supprimer exactement ces trois fragments.

Ligne 36, la cellule du tableau — **et son `<th>Type</th>` correspondant** dans le `<thead>` (juste avant `<th>Créée le</th>`, ligne 24) :

```html
              <td>{{ d.typeEntretien }}</td>
```

Lignes 53-64, le champ Recruteur en entier :

```html
      <div>
        <label class="label">Recruteur</label>
        <select formControlName="recruteurId" class="select">
          <option [ngValue]="null" disabled>— Sélectionner —</option>
          @for (r of recruteurs(); track r.id) {
            <option [ngValue]="r.id">{{ r.nom }} ({{ r.email }})</option>
          }
        </select>
        @if (form.controls.recruteurId.touched && form.controls.recruteurId.invalid) {
          <p class="field-error">Recruteur requis.</p>
        }
      </div>
```

Lignes 87-94, le champ Type d'entretien en entier :

```html
      <div>
        <label class="label">Type d'entretien</label>
        <select formControlName="typeEntretien" class="select">
          @for (t of typeValues; track t) {
            <option [ngValue]="t">{{ t }}</option>
          }
        </select>
      </div>
```

Dans `src/app/features/demandes/demande-detail.html:13`, remplacer :

```html
        <p class="page-subtitle">Demande #{{ d.id }}</p>
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 7: Vérifier le build**

Run: `npx ng build --configuration production`
Expected: succès. Toute erreur ici signale un usage résiduel de `typeEntretien` sur une `Demande`.

- [ ] **Step 8: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/core/models/demande.model.ts src/app/features/demandes/ src/app/core/services/demande.service.spec.ts
git commit -m "feat(demandes): retirer typeEntretien et deduire le recruteur de la session"
```

---

### Task 4: Créneau créé au nom du connecté

**Files:**
- Modify: `src/app/features/creneaux/creneaux-page.ts:4,28,32-36,38-41,54-57,63-75`
- Modify: `src/app/features/creneaux/creneaux-page.html:55-67`
- Test: `src/app/features/creneaux/creneaux-page.spec.ts` *(nouveau)*

**Interfaces:**
- Consumes: `AuthService.personneId()` (Task 1).
- Produces: rien de nouveau.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/app/features/creneaux/creneaux-page.spec.ts` :

```ts
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
      role: 'Recruteur',
    });

    fixture = TestBed.createComponent(CreneauxPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    // Requêtes de chargement initial : créneaux + annuaire du DirectoryService.
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it("poste l'id du connecté en recruteurId", () => {
    page.form.setValue({
      dateDebut: '2026-08-10T09:00',
      dateFin: '2026-08-10T10:00',
    });

    page.submit();

    const req = httpMock.expectOne(`${base}/creneaux`);
    expect(req.request.body).toEqual({
      recruteurId: 36,
      dateDebut: '2026-08-10T09:00:00',
      dateFin: '2026-08-10T10:00:00',
    });
    req.flush({
      id: 8,
      dateDebut: '2026-08-10T09:00:00',
      dateFin: '2026-08-10T10:00:00',
      disponible: true,
      recruteurId: 36,
      demandeEntretienId: null,
    });
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `setValue` refuse un objet sans `recruteurId` (`TS2345`).

- [ ] **Step 3: Alléger le composant**

Dans `src/app/features/creneaux/creneaux-page.ts` :
- injecter `AuthService` : `private readonly auth = inject(AuthService);` ;
- supprimer le signal `recruteurs`, l'import `RecruteurManager` et la ligne `this.personnes.getRecruteurs()...` du constructeur ; supprimer l'injection `personnes` si elle n'est plus utilisée, ainsi que son import ;
- remplacer formulaire, `openModal` et le payload :

```ts
  readonly form = this.fb.nonNullable.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
  });

  openModal(): void {
    this.form.reset({ dateDebut: '', dateFin: '' });
    this.modalOpen.set(true);
  }
```

Dans `submit()`, remplacer `recruteurId: v.recruteurId!` par `recruteurId: this.auth.personneId()!`.

- [ ] **Step 4: Nettoyer le template**

Dans `src/app/features/creneaux/creneaux-page.html`, supprimer exactement le fragment des lignes 58-69 :

```html
      <div>
        <label class="label">Recruteur</label>
        <select formControlName="recruteurId" class="select">
          <option [ngValue]="null" disabled>— Sélectionner —</option>
          @for (r of recruteurs(); track r.id) {
            <option [ngValue]="r.id">{{ r.nom }} ({{ r.email }})</option>
          }
        </select>
        @if (form.controls.recruteurId.touched && form.controls.recruteurId.invalid) {
          <p class="field-error">Recruteur requis.</p>
        }
      </div>
```

**Conserver la colonne « Recruteur » du tableau** (ligne 34) : elle affiche les créneaux de tous les recruteurs.

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/features/creneaux/
git commit -m "feat(creneaux): creer le creneau au nom du recruteur connecte"
```

---

## Phase 2 — Parcours et planification

### Task 5: EntretienDto aligné sur le contrat

**Files:**
- Modify: `src/app/core/models/entretien.model.ts`
- Modify: `src/app/features/entretiens/entretien-detail.ts:38-58,97-110`
- Modify: `src/app/features/entretiens/entretien-detail.html:38-44`
- Test: `src/app/features/entretiens/entretien-detail.spec.ts` *(nouveau)*

**Interfaces:**
- Consumes: `DemandeService.get(id)` (existant).
- Produces: `Entretien` avec `typeEntretien: TypeEntretien` et `evaluateurIds: number[]`, sans `recruteurId`. La Task 7 lit `evaluateurIds` pour la timeline, la Task 8 pour le compte-rendu.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/app/features/entretiens/entretien-detail.spec.ts` :

```ts
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { Entretien } from '../../core/models';
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
      recruteurId: 32,
      candidatId: 35,
    });

    expect(page.demande()?.recruteurId).toBe(32);
  });
});
```

> Note : `chargerPourTest(id)` n'existe pas encore — c'est une méthode publique minimale exposée à l'étape 4 pour déclencher `load(id)` sans passer par le routeur. `DemandeDetail` reçoit la même méthode avec la même signature en Task 6.

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `TS2353: 'typeEntretien' does not exist in type 'Entretien'` et `Property 'demande' does not exist on type 'EntretienDetail'`.

- [ ] **Step 3: Aligner le modèle**

`src/app/core/models/entretien.model.ts` :

```ts
import { Modalite, StatutEntretien, TypeEntretien } from './enums';

export interface Entretien {
  id: number;
  dateHeure: string;
  lieuOuLien: string;
  statut: StatutEntretien;
  modalite: Modalite;
  typeEntretien: TypeEntretien;
  demandeEntretienId: number;
  candidatId: number;
  evaluateurIds: number[];
  creneauId: number;
}

export interface CreateEntretien {
  demandeId: number;
  creneauId: number;
  dateHeure: string;
  modalite: Modalite;
  lieuOuLien: string;
  typeEntretien: TypeEntretien;
  evaluateurIds: number[];
}

export interface ReprogrammerEntretien {
  nouveauCreneauId: number;
  nouvelleDateHeure: string;
}
```

- [ ] **Step 4: Charger la demande dans le détail d'entretien**

Dans `src/app/features/entretiens/entretien-detail.ts`, ajouter l'import `Demande` depuis `'../../core/models'`, le signal et le chargement :

```ts
  readonly demande = signal<Demande | null>(null);

  /** Point d'entrée de test : déclenche le chargement sans passer par le routeur. */
  chargerPourTest(id: number): void {
    this.load(id);
  }
```

Dans `load(id)`, ajouter la récupération de la demande à côté des créneaux :

```ts
  private load(id: number): void {
    this.loading.set(true);
    this.entretiens.get(id).subscribe({
      next: (e) => {
        this.entretien.set(e);
        this.loadFeedbacks(id);
        this.demandes.get(e.demandeEntretienId).subscribe({
          next: (d) => this.demande.set(d),
        });
        this.demandes
          .getCreneauxDisponibles(e.demandeEntretienId)
          .subscribe({ next: (c) => this.creneauxDispo.set(c) });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
```

- [ ] **Step 5: Corriger le template**

Dans `src/app/features/entretiens/entretien-detail.html`, remplacer le bloc « Recruteur » (lignes 38-44) et ajouter le type et le panel :

```html
          <div>
            <dt class="kicker">Type de tour</dt>
            <dd class="mt-1 text-sm font-medium text-navy-900">{{ e.typeEntretien }}</dd>
          </div>
          <div>
            <dt class="kicker">Organisateur</dt>
            @if (demande(); as dem) {
              <dd class="mt-1 text-sm font-medium text-navy-900">{{ directory.recruteurLabel(dem.recruteurId) }}</dd>
            } @else {
              <dd class="mt-1 text-sm text-navy-300">—</dd>
            }
          </div>
          <div class="col-span-2">
            <dt class="kicker">Panel d'évaluateurs</dt>
            <dd class="mt-1 flex flex-wrap gap-2">
              @for (id of e.evaluateurIds; track id) {
                <span class="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">
                  {{ directory.auteurLabel(id) }}
                </span>
              }
            </dd>
          </div>
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: FAIL attendu sur `demande-detail` — `submitPlan` ne fournit ni `typeEntretien` ni `evaluateurIds` à `CreateEntretien`. C'est l'objet de la Task 6 ; ne pas corriger ici autrement qu'en enchaînant sur la tâche suivante.

- [ ] **Step 7: Commit** *(sur accord explicite uniquement)*

Ne pas commiter tant que la Task 6 n'a pas rétabli la compilation.

---

### Task 6: Planification avec type de tour et panel

**Files:**
- Create: `src/app/features/demandes/au-moins-un-evaluateur.ts`
- Modify: `src/app/features/demandes/demande-detail.ts:1-20,37,42-48,79-84,152-187`
- Modify: `src/app/features/demandes/demande-detail.html:184-225`
- Test: `src/app/features/demandes/demande-detail.spec.ts` *(nouveau)*

**Interfaces:**
- Consumes: `CreateEntretien` avec `typeEntretien` et `evaluateurIds` (Task 5).
- Produces: `auMoinsUnEvaluateur: ValidatorFn`, et sur `DemandeDetail` : `evaluateursDispo()`, `toggleEvaluateur(id, coche)`, `estEvaluateurCoche(id)`. La Task 7 réutilise `chargerPourTest`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/app/features/demandes/demande-detail.spec.ts` :

```ts
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api.config';
import { DemandeDetail } from './demande-detail';

const DEMANDE = {
  id: 8,
  poste: 'Dev .NET',
  dateCreation: '2026-07-30T11:00:00',
  statut: 'Creee' as const,
  recruteurId: 32,
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
    httpMock.match(() => true).forEach((r) => r.flush([]));
  });

  afterEach(() => localStorage.clear());

  it('refuse la planification avec un panel vide', () => {
    page.openPlan();
    page.planForm.patchValue({
      creneauId: 9,
      dateHeure: '2026-08-12T14:00',
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
      dateHeure: '2026-08-12T14:00',
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32, 33],
    });

    page.submitPlan();

    const req = httpMock.expectOne(`${base}/entretiens`);
    expect(req.request.body).toEqual({
      demandeId: 8,
      creneauId: 9,
      dateHeure: '2026-08-12T14:00:00',
      modalite: 'Presentiel',
      lieuOuLien: 'Salle A',
      typeEntretien: 'Technique',
      evaluateurIds: [32, 33],
    });
  });

  it("coche et décoche un évaluateur", () => {
    page.openPlan();

    page.toggleEvaluateur(33, true);
    expect(page.estEvaluateurCoche(33)).toBe(true);

    page.toggleEvaluateur(33, false);
    expect(page.estEvaluateurCoche(33)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `Property 'chargerPourTest' does not exist`, `Property 'toggleEvaluateur' does not exist`, et `typeEntretien`/`evaluateurIds` absents de `planForm`.

- [ ] **Step 3: Écrire le validateur**

Créer `src/app/features/demandes/au-moins-un-evaluateur.ts` :

```ts
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Un entretien doit compter au moins un évaluateur.
 * Reproduit côté client le 400 « Un entretien doit compter au moins un évaluateur. »
 */
export function auMoinsUnEvaluateur(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valeur = control.value as number[] | null;
    return Array.isArray(valeur) && valeur.length > 0 ? null : { panelVide: true };
  };
}
```

- [ ] **Step 4: Étendre le composant**

Dans `src/app/features/demandes/demande-detail.ts` :

Ajouter aux imports : `TYPE_ENTRETIEN_VALUES`, `TypeEntretien` et `Modalite` depuis `'../../core/models'`, `forkJoin` depuis `'rxjs'`, `PersonneService` depuis `'../../core/services/personne.service'`, et `auMoinsUnEvaluateur` depuis `'./au-moins-un-evaluateur'`.

Ajouter l'interface et l'état, à côté des signaux existants :

```ts
interface Evaluateur {
  id: number;
  nom: string;
  role: 'Recruteur' | 'Manager';
}
```

```ts
  private readonly personnes = inject(PersonneService);

  readonly typeValues = TYPE_ENTRETIEN_VALUES;
  readonly evaluateursDispo = signal<Evaluateur[]>([]);

  /** Point d'entrée de test : déclenche le chargement sans passer par le routeur. */
  chargerPourTest(id: number): void {
    this.load(id);
  }
```

Charger l'annuaire des évaluateurs dans le constructeur, après l'abonnement au `paramMap` :

```ts
    forkJoin({
      recruteurs: this.personnes.getRecruteurs(),
      managers: this.personnes.getManagers(),
    }).subscribe(({ recruteurs, managers }) => {
      this.evaluateursDispo.set([
        ...recruteurs.map((r) => ({ id: r.id, nom: r.nom, role: 'Recruteur' as const })),
        ...managers.map((m) => ({ id: m.id, nom: m.nom, role: 'Manager' as const })),
      ]);
    });
```

Remplacer `planForm` :

```ts
  readonly planForm = this.fb.nonNullable.group({
    creneauId: [null as number | null, Validators.required],
    dateHeure: ['', Validators.required],
    modalite: ['Presentiel' as Modalite, Validators.required],
    lieuOuLien: ['', Validators.required],
    typeEntretien: ['RH' as TypeEntretien, Validators.required],
    evaluateurIds: [[] as number[], auMoinsUnEvaluateur()],
  });
```

> **Attention au typage.** Écrire `['RH' as const, …]` figerait le contrôle sur le littéral `'RH'` : le `<select>` peut proposer les trois valeurs à l'exécution, mais TypeScript refuserait `patchValue({ typeEntretien: 'Technique' })`. D'où `as TypeEntretien`. La même correction est appliquée à `modalite`, qui portait ce défaut depuis l'origine (`demande-detail.ts:82`).

Remplacer `openPlan` et ajouter les deux méthodes de sélection :

```ts
  openPlan(creneau?: Creneau): void {
    // L'organisateur de la demande est pré-coché : il siège au panel dans la quasi-totalité des cas.
    const organisateur = this.demande()?.recruteurId;
    this.planForm.reset({
      creneauId: creneau?.id ?? null,
      dateHeure: creneau ? creneau.dateDebut.slice(0, 16) : '',
      modalite: 'Presentiel',
      lieuOuLien: '',
      typeEntretien: 'RH',
      evaluateurIds: organisateur ? [organisateur] : [],
    });
    this.planOpen.set(true);
  }

  toggleEvaluateur(id: number, coche: boolean): void {
    const control = this.planForm.controls.evaluateurIds;
    const actuels = control.value;
    control.setValue(coche ? [...actuels, id] : actuels.filter((x) => x !== id));
    control.markAsTouched();
  }

  estEvaluateurCoche(id: number): boolean {
    return this.planForm.controls.evaluateurIds.value.includes(id);
  }
```

Compléter le payload de `submitPlan` :

```ts
      .planifier({
        demandeId: d.id,
        creneauId: v.creneauId!,
        dateHeure: toApiDateTime(v.dateHeure),
        modalite: v.modalite,
        lieuOuLien: v.lieuOuLien,
        typeEntretien: v.typeEntretien,
        evaluateurIds: v.evaluateurIds,
      })
```

- [ ] **Step 5: Étendre la modale**

Dans `src/app/features/demandes/demande-detail.html`, insérer avant le bloc « Lieu ou lien » de la modale de planification :

```html
      <div>
        <label class="label">Type de tour</label>
        <select formControlName="typeEntretien" class="select">
          @for (t of typeValues; track t) {
            <option [ngValue]="t">{{ t }}</option>
          }
        </select>
      </div>
```

Et après le bloc « Lieu ou lien » :

```html
      <div>
        <label class="label">Panel d'évaluateurs</label>
        <div class="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-navy-100 p-2">
          @for (role of ['Recruteur', 'Manager']; track role) {
            <p class="kicker px-1 pt-1">{{ role }}s</p>
            @for (ev of evaluateursDispo(); track ev.id) {
              @if (ev.role === role) {
                <label class="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-navy-700 hover:bg-navy-50">
                  <input
                    type="checkbox"
                    [checked]="estEvaluateurCoche(ev.id)"
                    (change)="toggleEvaluateur(ev.id, $any($event.target).checked)"
                  />
                  {{ ev.nom }}
                </label>
              }
            }
          }
        </div>
        @if (planForm.controls.evaluateurIds.touched && planForm.controls.evaluateurIds.invalid) {
          <p class="field-error">Sélectionnez au moins un évaluateur.</p>
        }
      </div>
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS — y compris les tests de la Task 5, dont la compilation est maintenant rétablie.

- [ ] **Step 7: Vérifier le build**

Run: `npx ng build --configuration production`
Expected: succès.

- [ ] **Step 8: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/core/models/entretien.model.ts src/app/features/demandes/ src/app/features/entretiens/
git commit -m "feat(entretiens): type de tour et panel d'evaluateurs a la planification"
```

---

### Task 7: Timeline des tours dans le détail de demande

**Files:**
- Modify: `src/app/features/demandes/demande-detail.ts:44,55-72,112-117,178-186`
- Modify: `src/app/features/demandes/demande-detail.html:18-42,91-100,104-118,142-146`
- Test: `src/app/features/demandes/demande-detail.spec.ts`

**Interfaces:**
- Consumes: `Entretien.evaluateurIds` et `typeEntretien` (Task 5), `chargerPourTest(id)` (Task 6).
- Produces: `DemandeDetail.tours(): Entretien[]`, `comptesRendus(): Map<number, number>`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/app/features/demandes/demande-detail.spec.ts` un second `describe` :

```ts
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
    httpMock.match(`${base}/feedbacks?entretienId=6`).forEach((r) => r.flush([]));
    httpMock.match(`${base}/feedbacks?entretienId=7`).forEach((r) => r.flush([]));
    httpMock.match(() => true).forEach((r) => r.flush([]));

    expect(page.tours().map((t) => t.id)).toEqual([6, 7]);
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
```

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `Property 'tours' does not exist on type 'DemandeDetail'`.

- [ ] **Step 3: Remplacer l'entretien unique par la liste des tours**

Dans `src/app/features/demandes/demande-detail.ts` :

Ajouter l'import `FeedbackService` depuis `'../../core/services/feedback.service'` et l'injecter :

```ts
  private readonly feedbacks = inject(FeedbackService);
```

Remplacer le signal `entretien` :

```ts
  readonly tours = signal<Entretien[]>([]);
  readonly comptesRendus = signal<Map<number, number>>(new Map());
```

Supprimer entièrement le `computed` `steps` (lignes 55-72).

Remplacer `loadEntretien` :

```ts
  /** Tous les tours de la demande, du plus ancien au plus récent. */
  private loadTours(demandeId: number): void {
    this.entretiens.getAll().subscribe({
      next: (list) => {
        const tours = list
          .filter((e) => e.demandeEntretienId === demandeId)
          .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
        this.tours.set(tours);
        this.loadCompteurs(tours);
      },
    });
  }

  /** Avancement des comptes-rendus, tour par tour. Un échec laisse les compteurs vides. */
  private loadCompteurs(tours: Entretien[]): void {
    if (tours.length === 0) {
      this.comptesRendus.set(new Map());
      return;
    }
    forkJoin(tours.map((t) => this.feedbacks.getByEntretien(t.id))).subscribe({
      next: (listes) =>
        this.comptesRendus.set(new Map(tours.map((t, i) => [t.id, listes[i].length]))),
      error: () => this.comptesRendus.set(new Map()),
    });
  }
```

Dans `load(id)`, remplacer l'appel `this.loadEntretien(id)` par `this.loadTours(id)`.

Dans `submitPlan`, remplacer le bloc `next` pour rester sur la demande :

```ts
        next: () => {
          this.busy.set(false);
          this.planOpen.set(false);
          this.notify.success('Tour planifié, invitation envoyée.');
          this.loadTours(d.id);
          this.loadCreneaux(d.id);
        },
```

`Router` n'est plus utilisé : retirer l'injection `router` et son import si aucun autre usage ne subsiste.

- [ ] **Step 4: Remplacer le fil d'étapes par la timeline**

Dans `src/app/features/demandes/demande-detail.html`, remplacer tout le bloc « Fil d'étapes » (lignes 18-42) par :

```html
    <!-- Tours d'entretien -->
    <div class="card mt-6 overflow-hidden">
      <div class="flex items-center justify-between border-b border-navy-100 px-5 py-4">
        <h2 class="section-title">Tours d'entretien</h2>
        @if (canModify()) {
          <button type="button" (click)="openPlan()" class="btn-accent btn-sm">
            Planifier le tour suivant
          </button>
        }
      </div>
      @if (tours().length === 0) {
        <app-empty-state title="Aucun tour planifié" hint="Proposez un créneau, puis planifiez le premier tour." />
      } @else {
        <ol class="divide-y divide-navy-100">
          @for (t of tours(); track t.id; let i = $index) {
            <li class="flex items-center gap-4 px-5 py-4">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                {{ i + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <a [routerLink]="['/entretiens', t.id]" class="text-sm font-semibold text-navy-900 hover:text-accent-600">
                    {{ t.typeEntretien }}
                  </a>
                  <app-status-badge [value]="t.statut" />
                </div>
                <p class="mt-0.5 text-xs text-navy-400">
                  {{ formatDateTime(t.dateHeure) }} · {{ t.lieuOuLien }}
                </p>
                <p class="mt-1 flex flex-wrap gap-1">
                  @for (id of t.evaluateurIds; track id) {
                    <span class="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                      {{ directory.auteurLabel(id) }}
                    </span>
                  }
                </p>
              </div>
              <span class="shrink-0 text-xs font-medium text-navy-500">
                {{ comptesRendus().get(t.id) ?? 0 }}/{{ t.evaluateurIds.length }} CR
              </span>
            </li>
          }
        </ol>
      }
    </div>
```

Dans la carte « Détails », remplacer le bloc `<dt>Entretien lié</dt>` (lignes 91-100) par :

```html
          <div>
            <dt class="kicker">Tours planifiés</dt>
            <dd class="mt-1 text-sm font-medium text-navy-900">{{ tours().length }}</dd>
          </div>
```

Dans la carte « Actions », supprimer le bouton conditionné par `@if (!entretien())` (lignes 110-112) : la planification vit désormais dans l'en-tête de la timeline.

Dans le tableau des créneaux, remplacer la condition `@if (canModify() && !entretien())` (ligne 143) par `@if (canModify())`.

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Vérifier le build**

Run: `npx ng build --configuration production`
Expected: succès. Une erreur `entretien is not defined` signale un usage résiduel du signal supprimé dans le template.

- [ ] **Step 7: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/features/demandes/
git commit -m "feat(demandes): timeline des tours d'entretien"
```

---

## Phase 3 — Compte-rendu

### Task 8: Compte-rendu réservé au panel

**Files:**
- Modify: `src/app/features/entretiens/entretien-detail.ts:28-32,44,58,74-79,81-95,174-204`
- Modify: `src/app/features/entretiens/entretien-detail.html:65-71` et la modale de feedback
- Test: `src/app/features/entretiens/entretien-detail.spec.ts`

**Interfaces:**
- Consumes: `AuthService.personneId()` (Task 1), `Entretien.evaluateurIds` (Task 5), `unEntretien(patch)` (Task 5).
- Produces: `EntretienDetail.peutSaisirCompteRendu(): boolean`, `raisonBlocage(): string | null`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/app/features/entretiens/entretien-detail.spec.ts`, dans le `describe` existant, un helper de session puis les tests :

```ts
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
      role: 'Recruteur',
    });
  }

  /** Charge l'entretien puis vide les requêtes annexes. */
  function charger(entretien = unEntretien(), feedbacks: unknown[] = []): void {
    page.chargerPourTest(entretien.id);
    httpMock.expectOne(`${base}/entretiens/${entretien.id}`).flush(entretien);
    httpMock
      .match(`${base}/feedbacks?entretienId=${entretien.id}`)
      .forEach((r) => r.flush(feedbacks));
    httpMock.match(() => true).forEach((r) => r.flush([]));
  }

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

  it("poste le compte-rendu au nom de l'utilisateur connecté", () => {
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
      auteurId: 33,
      note: 4,
      commentaire: 'Bon niveau technique.',
      decision: 'Favorable',
    });
  });
```

Ajouter l'import `AuthService` depuis `'../../core/auth/auth.service'` en tête de fichier.

- [ ] **Step 2: Lancer les tests et vérifier l'échec**

Run: `npx ng test --watch=false`
Expected: FAIL — `Property 'peutSaisirCompteRendu' does not exist` et `setValue` refuse un objet sans `auteurId`.

- [ ] **Step 3: Supprimer le menu auteur et calculer le droit de saisie**

Dans `src/app/features/entretiens/entretien-detail.ts` :

- supprimer l'interface `Auteur`, le signal `auteurs`, le `forkJoin` du constructeur qui l'alimente, l'injection `personnes` et l'import `PersonneService` ;
- injecter `AuthService` : `private readonly auth = inject(AuthService);` ;
- retirer `auteurId` de `feedbackForm` :

```ts
  readonly feedbackForm = this.fb.nonNullable.group({
    note: [3, [Validators.required, Validators.min(0), Validators.max(5)]],
    decision: ['Favorable' as const, Validators.required],
    commentaire: ['', Validators.required],
  });
```

- ajouter les deux `computed`, à côté de `canAct` :

```ts
  /** Seul un évaluateur du panel, qui n'a pas encore déposé, peut saisir son compte-rendu. */
  readonly peutSaisirCompteRendu = computed(() => this.raisonBlocage() === null);

  readonly raisonBlocage = computed<string | null>(() => {
    const e = this.entretien();
    const moi = this.auth.personneId();
    if (!e || moi === null) return "Votre session ne permet pas d'identifier l'auteur.";
    if (!e.evaluateurIds.includes(moi)) {
      return "Vous ne faites pas partie du panel de cet entretien.";
    }
    if (this.feedbackList().some((f) => f.auteurId === moi)) {
      return 'Vous avez déjà saisi votre compte-rendu pour ce tour.';
    }
    return null;
  });
```

- corriger `openFeedback` et le payload de `submitFeedback` :

```ts
  openFeedback(): void {
    this.feedbackForm.reset({ note: 3, decision: 'Favorable', commentaire: '' });
    this.feedbackOpen.set(true);
  }
```

```ts
      .create({
        entretienId: e.id,
        auteurId: this.auth.personneId()!,
        note: v.note,
        commentaire: v.commentaire,
        decision: v.decision,
      })
```

- [ ] **Step 4: Conditionner le bouton dans le template**

Dans `src/app/features/entretiens/entretien-detail.html`, remplacer l'en-tête de la section Feedbacks (lignes 65-71) :

```html
    <div class="mt-8 flex items-center justify-between gap-4">
      <h2 class="text-lg font-semibold text-navy-950">Comptes-rendus</h2>
      @if (peutSaisirCompteRendu()) {
        <button type="button" (click)="openFeedback()" class="btn-primary btn-sm">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
          Saisir mon compte-rendu
        </button>
      } @else {
        <p class="text-xs text-navy-400">{{ raisonBlocage() }}</p>
      }
    </div>
```

Dans la modale de feedback, supprimer le bloc `<div>` contenant le `select formControlName="auteurId"` et son message d'erreur.

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Vérifier le build**

Run: `npx ng build --configuration production`
Expected: succès.

- [ ] **Step 7: Commit** *(sur accord explicite uniquement)*

```bash
git add src/app/features/entretiens/
git commit -m "feat(feedbacks): reserver la saisie aux evaluateurs du panel"
```

---

## Vérification finale

- [ ] `npx ng test --watch=false` — toute la suite verte, sortie sans avertissement.
- [ ] `npx ng build --configuration production` — build propre.
- [ ] Revue manuelle des trois parcours, backend démarré sur `http://localhost:5062` :
  1. Se connecter, créer une demande (aucun menu « Recruteur » n'apparaît), proposer deux créneaux.
  2. Planifier un tour `RH` avec un évaluateur, puis un tour `Technique` avec deux évaluateurs sur **la même demande** ; vérifier que la timeline affiche les deux, triés par date.
  3. Ouvrir le tour `Technique` : le bouton de compte-rendu n'apparaît que si le compte connecté figure au panel ; après saisie, il disparaît et le compteur passe à `1/2`.
