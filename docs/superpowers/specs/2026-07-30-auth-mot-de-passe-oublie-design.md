# Authentification : finalisation + mot de passe oublié

**Date :** 2026-07-30
**Périmètre :** front Angular (`gestiondentretienFront`) uniquement. Aucun changement backend.

## Contexte

Le front dispose déjà d'un module d'authentification : `AuthService` (login, inscription,
session en `localStorage`), `authGuard` / `recruteurGuard`, `authInterceptor` (header `Bearer`)
et un écran `LoginPage` à bascule Connexion / Inscription.

Trois défauts et une lacune motivent ce travail :

1. **L'expiration de session n'est jamais détectée.** `isAuthenticated` est un `computed` qui
   compare `expiration` à `Date.now()`. `Date.now()` n'étant pas un signal, le `computed` reste
   mémoïsé tant que `_session` ne change pas : un token expiré continue d'être considéré valide
   jusqu'au rechargement de la page. Seul un 401 du backend sort l'utilisateur.
2. **Une session expirée est restaurée au démarrage.** `read()` désérialise le `localStorage`
   sans vérifier `expiration`.
3. **L'interceptor d'erreurs ne connaît que `/auth/login` comme endpoint public.** Un 401 sur un
   endpoint de réinitialisation déclencherait un `logout()` et une redirection parasites pour un
   visiteur qui n'est pas connecté.
4. **Aucun parcours « mot de passe oublié »**, ni même de lien sur l'écran de connexion.

## Contrat d'API (fourni, existant côté backend)

```
POST /api/auth/login
     { email, motDePasse }
     -> 200 { token, expiration, role } | 401 texte

POST /api/auth/mot-de-passe-oublie
     { email }
     -> 200 { message }        (toujours 200 : pas d'énumération de comptes)

POST /api/auth/reinitialiser
     { email, code, nouveauMotDePasse }
     -> 200 { succes: true, message } | 400 { succes: false, message }
```

Le code de réinitialisation est envoyé **par email** et saisi manuellement. Il n'y a pas de lien
profond à gérer, donc aucune route porteuse de token.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Structure du parcours | Une route `mot-de-passe-oublie`, deux étapes pilotées par un signal | `/auth/reinitialiser` exige l'email à l'étape 2 ; le garder en mémoire évite de le retaper, et rien ne transite en query param |
| Expiration de session | Vérification réelle + purge au démarrage + auto-déconnexion sur timer | L'utilisateur est prévenu au bon moment plutôt que de découvrir l'expiration sur un 401 en pleine action |
| Refresh token | Écarté | Aucun endpoint de refresh côté backend |

## Architecture

Aucune couche nouvelle. Le travail s'inscrit dans la structure existante :

```
core/models/auth.model.ts          (+ 4 interfaces)
core/auth/auth.service.ts          (+ 2 méthodes, correction expiration)
core/http-error.interceptor.ts     (élargissement des endpoints publics)
features/auth/auth-layout.ts       (nouveau — colonne de marque partagée)
features/auth/forgot-password-page.{ts,html}  (nouveau)
features/auth/login-page.{ts,html} (+ lien « Mot de passe oublié ? »)
layout/shell.ts                    (+ effect de réaction à l'expiration)
app.routes.ts                      (+ route publique)
```

### 1. Modèles — `core/models/auth.model.ts`

```ts
export interface MotDePasseOublieRequest  { email: string; }
export interface MotDePasseOublieResponse { message: string; }
export interface ReinitialiserRequest  { email: string; code: string; nouveauMotDePasse: string; }
export interface ReinitialiserResponse { succes: boolean; message: string; }
```

Exportées via `core/models/index.ts` comme les autres.

### 2. `AuthService`

**Deux méthodes publiques**, sans effet sur la session (appels non authentifiés) :

- `demanderCodeReinitialisation(payload: MotDePasseOublieRequest): Observable<MotDePasseOublieResponse>`
  → `POST {base}/auth/mot-de-passe-oublie`
- `reinitialiserMotDePasse(payload: ReinitialiserRequest): Observable<ReinitialiserResponse>`
  → `POST {base}/auth/reinitialiser`

**Correction de l'expiration :**

- `isAuthenticated` passe de `computed` à une **méthode** `isAuthenticated(): boolean`. La
  comparaison à `Date.now()` est ainsi réévaluée à chaque appel. Les sites d'appel existants
  (`auth.isAuthenticated()` dans `auth.guard.ts`, `login-page.ts`, `getToken()`, les specs) sont
  inchangés — la propriété n'est utilisée dans aucun template, donc aucune réactivité n'est perdue.
- `read()` retourne `null` et vide le `localStorage` si la session lue est expirée.
- Un timer privé est armé sur `expiration - Date.now()` à chaque `setSession()` (et à la
  construction si une session valide est restaurée). À son déclenchement : `logout()` puis
  `_sessionExpiree.set(true)`. Le délai est borné au plafond de `setTimeout` (2^31-1 ms) ; un
  délai déjà négatif ou nul déclenche immédiatement. Le timer est annulé dans `logout()` et
  ré-armé à chaque nouvelle session.
- `readonly sessionExpiree` (signal en lecture seule) expose l'événement. `logout()` le remet à
  `false`, de sorte qu'une reconnexion repart d'un état propre.

`AuthService` **n'injecte ni `Router` ni `NotificationService`** : il reste testable sans
infrastructure de routage, et la réaction reste au niveau de l'UI.

### 3. Réaction à l'expiration — `layout/shell.ts`

Le `Shell` n'est monté que derrière l'`authGuard`, c'est-à-dire exactement quand l'expiration est
visible par l'utilisateur. Il installe un `effect` : lorsque `auth.sessionExpiree()` passe à
`true`, il affiche `notify.error('Session expirée, veuillez vous reconnecter.')` et navigue vers
`/login`. Le message reprend mot pour mot celui déjà émis par l'interceptor sur un 401, pour que
les deux chemins soient indiscernables côté utilisateur.

### 4. `ForgotPasswordPage` — `features/auth/forgot-password-page.{ts,html}`

Route `mot-de-passe-oublie`, déclarée en frère de `login`, donc hors du `Shell` et sans
`authGuard`.

État :

- `step = signal<1 | 2>(1)`
- `busy = signal(false)`
- `demandeForm` : `email` (`required`, `email`)
- `resetForm` : `email` (`required`, `email`), `code` (`required`),
  `nouveauMotDePasse` (`required`, `minLength(6)`), `confirmation` (`required`), plus un
  validateur de groupe `motsDePasseIdentiques` posant l'erreur `motsDePasseDifferents`.

Flux :

- `soumettreDemande()` — formulaire invalide → `markAllAsTouched()` et sortie. Sinon appel
  service ; en succès : toast `success` avec le `message` du backend, recopie de l'email dans
  `resetForm`, `step.set(2)`. En erreur : `busy` relâché (le toast est déjà émis par l'interceptor).
- `soumettreReset()` — même garde. En succès (`res.succes === true`) : toast `success` avec le
  `message`, navigation vers `/login`. Si un 200 revenait avec `succes: false`, le message est
  affiché en `error` et l'utilisateur reste à l'étape 2. Le cas 400 est couvert par l'interceptor.
- `allerAuCode()` — lien « J'ai déjà un code » sur l'étape 1, passe à l'étape 2 sans appel réseau.
  Couvre l'utilisateur qui ferme l'onglet et revient avec le code reçu par email.
- `retour()` — retour à l'étape 1 depuis l'étape 2.

À l'étape 2, le champ email reste **éditable** : il est pré-rempli dans le flux nominal, et
saisissable pour l'utilisateur arrivé par « J'ai déjà un code ».

### 5. `AuthLayout` — `features/auth/auth-layout.ts`

La colonne de marque de `login-page.html` (dégradé, logo, accroche, liste d'arguments, mention de
copyright — 18 lignes) serait dupliquée à l'identique dans le second écran. Elle est extraite en
un composant autonome avec `<ng-content>` pour la colonne de formulaire, consommé par `LoginPage`
et `ForgotPasswordPage`. Le rendu visuel est inchangé.

`login-page.html` gagne un lien « Mot de passe oublié ? » sous le champ mot de passe
(`routerLink="/mot-de-passe-oublie"`, `RouterLink` ajouté aux imports de `LoginPage`).

Les écrans réutilisent les classes utilitaires existantes de `styles.css` : `.label`, `.input`,
`.field-error`, `.btn-primary`.

### 6. `httpErrorInterceptor`

`isLoginRequest` devient `isEndpointPublic`, couvrant :

- `/auth/login`
- `/auth/mot-de-passe-oublie`
- `/auth/reinitialiser`
- `/personnes/recruteurs` et `/personnes/managers` (inscription)

Un 401 sur l'un de ces endpoints ne déclenche **ni `logout()` ni redirection** ; le message
d'erreur est extrait normalement. Le message spécifique « Email ou mot de passe incorrect. » reste
réservé au 401 sur `/auth/login`.

`extractErrorMessage` est inchangé : il lit déjà `body.message`, donc le
`400 { succes: false, message }` de `/auth/reinitialiser` affiche le message métier du backend.

## Flux de données

```
Étape 1
  ForgotPasswordPage.soumettreDemande()
    -> AuthService.demanderCodeReinitialisation({ email })
    -> POST /auth/mot-de-passe-oublie
    <- 200 { message }
    -> toast success + resetForm.email = email + step = 2

Étape 2
  ForgotPasswordPage.soumettreReset()
    -> AuthService.reinitialiserMotDePasse({ email, code, nouveauMotDePasse })
    -> POST /auth/reinitialiser
    <- 200 { succes: true, message }  -> toast success + navigate('/login')
    <- 400 { succes: false, message } -> interceptor : toast error, step inchangé

Expiration
  setSession() arme un timer sur `expiration`
    -> échéance : logout() + sessionExpiree = true
    -> effect du Shell : toast error + navigate('/login')
```

## Gestion des erreurs

- Les erreurs HTTP restent centralisées dans `httpErrorInterceptor` : les composants ne
  construisent aucun message, ils se contentent de relâcher `busy`.
- `/auth/mot-de-passe-oublie` répond toujours 200, y compris pour un email inconnu. Le front
  affiche le message du backend sans jamais laisser deviner l'existence d'un compte, et passe à
  l'étape 2 dans tous les cas.
- Validation côté client bloquante avant appel : email bien formé, code non vide, mot de passe
  d'au moins 6 caractères, confirmation identique.
- Backend injoignable : `extractErrorMessage` renvoie déjà son message dédié pour `status === 0`.

## Tests

Vitest + `HttpTestingController`, dans la continuité des specs existantes.

| Fichier | Cas |
|---|---|
| `core/auth/auth.service.spec.ts` *(étendu)* | une session expirée présente en `localStorage` n'est pas restaurée au démarrage ; `isAuthenticated()` bascule à `false` une fois l'expiration franchie sans nouveau login (fake timers) ; `sessionExpiree` passe à `true` à l'échéance du timer ; URL et payload de `demanderCodeReinitialisation` ; URL et payload de `reinitialiserMotDePasse` |
| `features/auth/forgot-password-page.spec.ts` *(nouveau)* | l'étape 1 passe à l'étape 2 après un 200 et reporte l'email ; une confirmation divergente rend `resetForm` invalide et n'émet aucune requête ; un reset réussi navigue vers `/login` |
| `core/http-error.interceptor.spec.ts` *(étendu)* | un 401 sur `/auth/reinitialiser` ne déclenche ni `logout` ni redirection ; un 401 sur un endpoint protégé les déclenche toujours |
| `core/auth/auth.guard.spec.ts` *(nouveau)* | session valide → `true` ; sans session → `UrlTree` vers `/login` avec le query param `redirectTo` |

## Hors périmètre (YAGNI)

Refresh token (aucun endpoint backend), renvoi du code avec compte à rebours, indicateur de
robustesse du mot de passe, changement de mot de passe depuis un compte connecté, verrouillage
après N tentatives.
