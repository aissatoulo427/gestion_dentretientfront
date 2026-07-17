# Front Gestion des entretiens — Design

Date : 2026-07-17
Statut : validé

## Objectif

Construire le front Angular 21 qui consomme l'API REST « Gestion des entretiens »
(ASP.NET Core + PostgreSQL). Application **complète** couvrant toutes les entités,
avec un style **tableau de bord professionnel** (sidebar, tables, badges de statut).

## Contexte technique

- Angular 21, standalone components, signals, control flow (`@if`/`@for`).
- Tailwind CSS 4 (déjà configuré via `@import 'tailwindcss'` dans `src/styles.css`).
- Pas de state manager externe : signals + services. Pas d'auth (l'API n'en a pas).
- API en camelCase, enums en **texte**, base `http://localhost:5062/api`.
- CORS ouvert en dev (`AllowAnyOrigin`).

## Architecture (3 couches)

```
src/app/
├── core/
│   ├── models/          interfaces + union types enum
│   ├── services/        1 service HTTP par groupe de ressources
│   ├── api.config.ts    URL de base (InjectionToken), configurable
│   ├── http-error.interceptor.ts   400 (corps texte) -> message lisible
│   └── notification.service.ts     toasts succès/erreur (signal store)
├── shared/ui/           layout, data-table, status-badge, modal,
│                        confirm-dialog, form-field, spinner, empty-state, toast-host
└── features/
    ├── dashboard/
    ├── personnes/       onglets Candidats / Recruteurs / Managers
    ├── demandes/        liste + détail (orchestrateur du workflow)
    ├── creneaux/        liste + création de disponibilités
    └── entretiens/      liste + détail (confirmer / reprogrammer / rappel + feedbacks)
```

## Modèles (core/models)

Types union pour coller aux enums texte :

- `TypeEntretien = 'RH' | 'Technique' | 'Managerial'`
- `Modalite = 'Presentiel' | 'Distanciel' | 'Telephone'`
- `Decision = 'Favorable' | 'Defavorable' | 'ARevoir'`
- `StatutDemande = 'Creee' | 'Planifiee' | 'Annulee' | 'Terminee'`
- `StatutEntretien = 'Planifie' | 'Confirme' | 'Reprogramme' | 'Termine' | 'Annule'`

Interfaces (d'après les DTO du README) :

- `Candidat { id, nom, prenom, email, telephone }`
- `RecruteurManager { id, nom, email }` (recruteur et manager partagent la forme)
- `Personne { id, nom, email, type: 'Candidat'|'Recruteur'|'Manager' }` (GET /personnes/{id})
- `Demande { id, poste, typeEntretien, dateCreation, statut, recruteurId, candidatId }`
- `Creneau { id, dateDebut, dateFin, disponible, recruteurId, demandeEntretienId }`
- `Entretien { id, dateHeure, lieuOuLien, statut, modalite, demandeEntretienId, candidatId, recruteurId, creneauId }`
- `Feedback { id, note, commentaire, decision, dateSaisie, entretienId, auteurId }`

Types de payload de création (`CreateXxx`) séparés des types de lecture.

## Services (core/services) — mapping endpoints

- `PersonneService` : `getCandidats`, `createCandidat`, `getRecruteurs`, `createRecruteur`,
  `getManagers`, `createManager`, `getPersonne(id)`.
- `DemandeService` : `create`, `get(id)`, `getCreneauxDisponibles(id)`, `annuler(id)`.
- `CreneauService` : `create`, `proposer(id, demandeId)`.
- `EntretienService` : `getAll`, `get(id)`, `planifier`, `confirmer(id)`,
  `reprogrammer(id, body)`, `rappel(id)`.
- `FeedbackService` : `getByEntretien(entretienId)`, `create`.

Chaque service injecte `HttpClient` + le token `API_BASE_URL`. Retourne des Observables typés.

## Flux de données & état

- Composant appelle le service, stocke le résultat dans des **signals** locaux
  (`items = signal<T[]>([])`, `loading = signal(false)`, `error = signal<string|null>(null)`).
- `provideHttpClient(withInterceptors([httpErrorInterceptor]))` dans `app.config.ts`.

## Gestion des erreurs

- Interceptor fonctionnel : sur `HttpErrorResponse`, si `status === 400` le corps est une
  **chaîne** → on l'utilise directement comme message ; sinon message générique selon le code
  (404 « Ressource introuvable », 0 « API injoignable », etc.).
- `NotificationService` (signal de toasts) : les composants affichent succès (201/204) en vert,
  erreurs en rouge. Auto-dismiss après quelques secondes.

## Écrans

1. **Shell** : sidebar (Dashboard, Personnes, Demandes, Créneaux, Entretiens) + topbar titre.
   `toast-host` monté dans le shell.
2. **Dashboard** : cartes compteurs (nb demandes par statut, entretiens à venir) + table des
   prochains entretiens. Données dérivées de `EntretienService.getAll` + `DemandeService`.
3. **Personnes** : onglets. Chaque onglet = table + bouton « Nouveau » ouvrant une modale de
   formulaire. Candidat a un champ téléphone/prénom en plus.
4. **Demandes** :
   - Liste : table (poste, type, statut badge, candidat/recruteur), bouton « Nouvelle demande ».
   - Détail (`/demandes/:id`) : infos + statut, section « Créneaux disponibles » (liste depuis
     `getCreneauxDisponibles`), action « Proposer un créneau », action « Planifier l'entretien »
     (modale) qui appelle `EntretienService.planifier`. Bouton « Annuler la demande ».
5. **Créneaux** : liste + formulaire de création d'une disponibilité (recruteur, début, fin).
6. **Entretiens** :
   - Liste : table (date, statut badge, modalité, candidat/recruteur).
   - Détail (`/entretiens/:id`) : infos + actions Confirmer / Reprogrammer (modale) / Rappel.
     Section Feedbacks : liste (`getByEntretien`) + formulaire d'ajout (note 0–5, décision,
     commentaire, auteur = recruteur/manager).

## Composants partagés

`status-badge` (couleur selon statut/décision), `data-table` (colonnes + template de cellule),
`modal` (overlay + slot), `confirm-dialog` (via NotificationService ou input), `form-field`
(label + erreur), `spinner`, `empty-state`, `toast-host`.

## Style

Palette : indigo sobre (`indigo-600` accent), fonds clairs (`gray-50`/blanc), texte `gray-900`.
Badges de statut colorés (vert=confirmé/favorable, ambre=en attente, rouge=annulé/défavorable,
bleu=planifié/créé). Tailwind utilitaires.

## Hors périmètre (YAGNI)

Authentification, NgRx, i18n, tests e2e, pagination serveur (l'API renvoie des listes simples),
mode sombre.

## Tests

Tests unitaires ciblés sur les services (mapping URL/payload via `HttpTestingController`) et sur
l'interceptor (extraction du message 400). Pas de tests de composants exhaustifs pour l'instant.

## Configuration

`API_BASE_URL` via `InjectionToken`, valeur par défaut `http://localhost:5062/api`, surchargeable
dans `app.config.ts` (préparé pour un futur fichier d'environnement).
