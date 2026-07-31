# Parcours multi-tours et panel d'évaluateurs

**Date :** 2026-07-30
**Périmètre :** front Angular (`gestiondentretienFront`). Aucune dépendance backend restante.

## Contexte

Le contrat d'API du 30/07/2026 introduit deux règles métier que le front ne sait pas représenter :

1. **Une demande donne lieu à plusieurs tours d'entretien.** Le candidat enchaîne `RH`, puis
   `Technique`, puis `Managerial` sur une même demande. Le type est choisi **à chaque
   planification**, plus à la création de la demande.
2. **Chaque entretien a un panel de 1 à n évaluateurs**, variable d'un tour à l'autre. Seul un
   évaluateur présent à l'entretien peut en saisir le compte-rendu.

Le front actuel suppose une relation 1:1 entre demande et entretien.

Deux évolutions accompagnent ce contrat et simplifient le travail :

- **`POST /api/auth/login` renvoie désormais l'identité complète** :
  `{ token, expiration, id, nom, email, role }`. L'`id` sert de `recruteurId` à la création, d'
  `auteurId` sur un compte-rendu, et alimente `evaluateurIds`.
- **Le format d'erreur est uniforme** : toute réponse sans ressource a la forme
  `{ succes: false, message: "…" }`, quel que soit le code HTTP et l'endpoint.

### Écarts constatés

| Emplacement | Écart |
|---|---|
| `features/demandes/demande-detail.ts:112-117` | `list.find(e => e.demandeEntretienId === id)` ne retient qu'un entretien ; `entretien` est un signal singulier |
| `features/demandes/demande-detail.ts:79-84` | `planForm` sans `typeEntretien` ni `evaluateurIds`, tous deux désormais obligatoires : toute planification part en 400 |
| `features/demandes/demande-detail.ts:56-72` | le fil d'étapes `steps` s'arrête à « Entretien planifié », faux dès le deuxième tour |
| `features/demandes/demande-detail.ts:183` | redirection vers `/entretiens/:id` après planification, qui interrompt l'enchaînement des tours |
| `features/demandes/demandes-page.ts:44,47,90,93` | `recruteurId` choisi à la main et `typeEntretien` posté à la création, tous deux inutiles désormais |
| `features/creneaux/creneaux-page.ts:33,72` | `recruteurId` choisi à la main |
| `features/entretiens/entretien-detail.html:40-41` | affiche `e.recruteurId`, supprimé de `EntretienDto` |
| `features/entretiens/entretien-detail.ts:74-94` | l'auteur du compte-rendu se choisit parmi **tous** les recruteurs et managers, alors que l'API exige un membre du panel |
| `core/auth/auth.service.ts:42` | `email` recopié depuis le formulaire de login au lieu d'être lu dans la réponse |
| `core/http-error.interceptor.ts:56-58` | message de 401 sur login codé en dur, devenu inutile |
| `core/models/demande.model.ts:6,17` | `typeEntretien` présent dans `Demande` et `CreateDemande` |
| `core/models/entretien.model.ts:11` | `recruteurId` présent ; `typeEntretien` et `evaluateurIds` absents |

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Où vit le parcours | Dans le détail de demande | C'est déjà la structure de l'API : les tours partagent une `demandeId`. Aucun écran nouveau, aucune donnée dupliquée |
| Sélection des évaluateurs | Cases à cocher groupées Recruteurs / Managers | Le panel est visible d'un coup d'œil ; `<select multiple>` est pénible sur mobile, un composant à tags serait du code en trop |
| Auteur du compte-rendu | `id` de la session, sans champ de saisie | Le backend le fournit au login ; aucun choix à proposer, donc aucun 400 possible sur ce motif |
| Menus « Recruteur » des créations | Supprimés | L'id du connecté fait foi. Deux champs en moins, et plus de risque de créer une demande au nom d'un collègue |

## 1. Modèles et session

`core/models/demande.model.ts` — retirer `typeEntretien` de `Demande` et de `CreateDemande`.

`core/models/entretien.model.ts` :

```ts
export interface Entretien {
  id: number;
  dateHeure: string;
  lieuOuLien: string;
  statut: StatutEntretien;
  modalite: Modalite;
  typeEntretien: TypeEntretien;   // ajouté
  demandeEntretienId: number;
  candidatId: number;
  evaluateurIds: number[];        // ajouté
  creneauId: number;
  // recruteurId supprimé
}

export interface CreateEntretien {
  demandeId: number;
  creneauId: number;
  dateHeure: string;
  modalite: Modalite;
  lieuOuLien: string;
  typeEntretien: TypeEntretien;   // ajouté, obligatoire
  evaluateurIds: number[];        // ajouté, obligatoire, non vide
}
```

`core/models/auth.model.ts` :

```ts
export interface LoginResponse {
  token: string;
  expiration: string;
  id: number;        // ajouté
  nom: string;       // ajouté
  email: string;     // ajouté
  role: Role;
}

export interface AuthSession {
  token: string;
  expiration: string;
  role: Role;
  personneId: number;   // ajouté
  nom: string;          // ajouté
  email: string;        // désormais lu dans la réponse
}
```

`AuthService.login()` construit la session à partir de la **réponse** et non plus du payload
envoyé (`auth.service.ts:42`). Le service expose `personneId` et `nom` en `computed`, à côté des
`role` et `email` existants.

**Sessions déjà en stockage.** Une session écrite avant ce changement n'a ni `personneId` ni `nom`.
`read()` la rejette et vide le stockage, exactement comme une session expirée : l'utilisateur se
reconnecte une fois et repart sur une session complète. Cela évite de propager des `undefined` dans
les écrans et de tester partout un cas transitoire. La condition de rejet est
`typeof session.personneId !== 'number'`.

`layout/shell.html` affiche `nom` plutôt que l'email brut, désormais disponible.

## 2. Détail de demande — le hub du parcours

`entretien = signal<Entretien | null>` devient `tours = signal<Entretien[]>`, alimenté par un
`filter` sur `demandeEntretienId` suivi d'un tri croissant sur `dateHeure`.

**Timeline des tours** — une carte par tour affichant : rang (1, 2, 3…, issu de l'ordre trié),
`typeEntretien`, date, statut via `StatusBadge`, panel résolu en noms par
`DirectoryService.auteurLabel`, et l'avancement des comptes-rendus sous la forme
`n/{evaluateurIds.length}`.

Les compteurs viennent d'un `forkJoin` sur `GET /feedbacks?entretienId=` pour chaque tour. Le
nombre de tours est petit (2 à 3), et un `forkJoin` unique évite une cascade de requêtes. Une
erreur sur ce chargement n'empêche pas l'affichage de la timeline : les compteurs restent vides.

**« Planifier le tour suivant »** reste disponible tant que `canModify()` est vrai (demande ni
annulée ni terminée), au lieu de disparaître dès le premier entretien planifié.

**Plus de redirection** après planification : `submitPlan` recharge les tours et ferme la modale.
L'utilisateur reste sur la demande et peut enchaîner. Un lien par tour mène à `/entretiens/:id`
pour les actions propres à un entretien (confirmer, reprogrammer, rappel, comptes-rendus).

Le `computed` `steps` est supprimé : il code en dur un parcours à un seul entretien. La timeline
porte la même information sans cette hypothèse.

## 3. Formulaire de planification

`planForm` gagne deux contrôles :

- **`typeEntretien`** — `select` sur `TYPE_ENTRETIEN_VALUES` (RH / Technique / Managerial),
  `Validators.required`, valeur initiale `RH`.
- **`evaluateurIds`** — `FormControl<number[]>` piloté par des cases à cocher groupées en deux
  blocs, Recruteurs et Managers, alimentés par `DirectoryService`. Validateur `auMoinsUnEvaluateur`
  qui rejette le tableau vide, reproduisant côté client le `400 Un entretien doit compter au moins
  un évaluateur.`

À l'ouverture de la modale, le recruteur de la demande (`demande.recruteurId`) est pré-coché : il
est l'organisateur de ce parcours, et ce choix reste juste même quand un autre recruteur consulte
la demande. L'utilisateur peut le décocher.

Le validateur `auMoinsUnEvaluateur` vit dans `features/demandes/au-moins-un-evaluateur.ts`, à côté
de son unique consommateur.

## 4. Formulaires de création

**`features/demandes/demandes-page.ts`** — retirer les contrôles `recruteurId` et `typeEntretien`,
leurs `select` du template, et la colonne `typeEntretien` du tableau
(`demandes-page.html:36`). Le payload devient `{ recruteurId: auth.personneId(), candidatId, poste }`.

**`features/creneaux/creneaux-page.ts`** — retirer le contrôle `recruteurId` et son `select`. Le
payload devient `{ recruteurId: auth.personneId(), dateDebut, dateFin }`. La colonne « Recruteur »
du tableau (`creneaux-page.html:34`) est conservée : elle affiche les créneaux de tous les
recruteurs, l'information reste utile.

## 5. Détail d'entretien

**Compte-rendu.** Le contrôle `auteurId` disparaît de `feedbackForm` ; le signal `auteurs` et le
`forkJoin` qui l'alimente (`entretien-detail.ts:86-94`) disparaissent aussi. `auteurId` vaut
`auth.personneId()` au moment de l'envoi.

Un `computed` `peutSaisirCompteRendu` conditionne le bouton « Saisir mon compte-rendu ». Il est vrai
si les deux conditions tiennent :

1. `personneId()` figure dans `entretien().evaluateurIds` ;
2. aucun feedback de `feedbackList()` ne porte cet `auteurId`.

Quand il est faux, une phrase indique laquelle des deux raisons s'applique — hors panel d'abord,
compte-rendu déjà saisi ensuite.

**Organisateur.** `entretien-detail.html:40-41` lit `e.recruteurId`, qui disparaît. L'écran charge
désormais la demande via `DemandeService.get(e.demandeEntretienId)` et affiche son `recruteurId`,
résolu en nom par `DirectoryService.recruteurLabel`. On passe par le service plutôt que par la map
de `DirectoryService`, qui peut être froide ou périmée : l'écran a besoin de la valeur autoritative.
`DirectoryService` n'est pas modifié.

**Affichage.** L'en-tête montre le `typeEntretien` du tour et la liste nominative du panel.

## Flux de données

```
/demandes/:id
  DemandeService.get(id)                     -> demande
  DemandeService.getCreneauxDisponibles(id)  -> créneaux libres
  EntretienService.getAll()                  -> filtre demandeEntretienId, tri dateHeure -> tours
  forkJoin(tours.map(t => FeedbackService.getByEntretien(t.id))) -> compteurs n/panel

  « Planifier le tour suivant »
    -> POST /entretiens { demandeId, creneauId, dateHeure, modalite,
                          lieuOuLien, typeEntretien, evaluateurIds }
    <- 201 EntretienDto  -> rechargement des tours, modale fermée, on reste sur la demande

/entretiens/:id
  EntretienService.get(id)                   -> entretien (typeEntretien, evaluateurIds)
  DemandeService.get(demandeEntretienId)     -> organisateur
  FeedbackService.getByEntretien(id)         -> comptes-rendus

  « Saisir mon compte-rendu »  (si peutSaisirCompteRendu)
    -> POST /feedbacks { entretienId, auteurId: personneId(), note, commentaire, decision }
```

## Gestion des erreurs

Toute réponse sans ressource ayant désormais la forme `{ succes, message }`, `extractErrorMessage`
la traite déjà : sa branche `body.message` couvre l'ensemble des endpoints. Les branches « corps
texte » et « statut 0 » sont conservées — la première comme filet si un endpoint échappait à
l'uniformisation, la seconde parce qu'un backend injoignable ne renvoie aucun corps.

Le cas spécial `401` sur `/auth/login` (`http-error.interceptor.ts:56-58`), qui remplaçait la
réponse serveur par un message codé en dur, est **supprimé** : le backend fournit maintenant son
propre message, déjà neutre vis-à-vis de l'énumération de comptes. La liste `PUBLIC_ENDPOINTS` et
le traitement du 401 sur endpoint protégé restent inchangés.

Trois `400` du contrat sont désormais prévenus côté client plutôt que subis :

- `Un entretien doit compter au moins un évaluateur.` → validateur `auMoinsUnEvaluateur` ;
- `Seul un évaluateur présent à l'entretien peut saisir un compte-rendu.` → `peutSaisirCompteRendu` ;
- `La note doit être comprise entre 0 et 5.` → validateurs déjà en place.

Les autres (`Le créneau n'est plus disponible.`, `Demande annulée.`, évaluateur introuvable)
dépendent d'un état serveur que le front ne peut pas anticiper : le message backend est affiché tel
quel et la modale reste ouverte pour permettre une correction.

## 6. Tests

Vitest + `HttpTestingController`, dans la continuité des specs existantes.

| Fichier | Cas |
|---|---|
| `core/auth/auth.service.spec.ts` *(étendu)* | `personneId`, `nom` et `email` sont lus dans la **réponse** de login puis persistés et relus ; une session stockée sans `personneId` est rejetée et purgée au démarrage |
| `core/http-error.interceptor.spec.ts` *(étendu)* | un 401 sur `/auth/login` affiche le `message` du corps et ne déconnecte pas |
| `features/demandes/demande-detail.spec.ts` *(nouveau)* | plusieurs entretiens d'une même demande sont listés et triés par `dateHeure` ; ceux d'une autre demande sont exclus ; la planification poste `typeEntretien` et `evaluateurIds` ; un panel vide rend le formulaire invalide et n'émet aucune requête ; après un succès on reste sur `/demandes/:id` et le nouveau tour apparaît |
| `features/entretiens/entretien-detail.spec.ts` *(nouveau)* | le bouton est masqué hors `evaluateurIds` ; masqué si l'utilisateur a déjà un feedback ; visible sinon, et le payload porte `auteurId = personneId()` |
| `features/demandes/demandes-page.spec.ts` *(nouveau)* | le payload de création porte l'id du connecté en `recruteurId` et pas de `typeEntretien` |
| `features/creneaux/creneaux-page.spec.ts` *(nouveau)* | le payload de création porte l'id du connecté en `recruteurId` |
| `core/services/demande.service.spec.ts` *(mis à jour)* | payload sans `typeEntretien` |

## Ordre d'implémentation

Trois phases, chacune laissant la suite de tests verte :

1. **Session et modèles** — `LoginResponse`, `AuthSession`, `personneId`/`nom`, purge des sessions
   incomplètes, suppression du cas spécial 401, mise à jour des modèles `Demande` et `Entretien`.
   Casse volontairement la compilation des écrans, réparée en phase 2.
2. **Parcours et planification** — timeline des tours, formulaire de planification avec
   `typeEntretien` et panel, formulaires de création allégés.
3. **Compte-rendu** — `peutSaisirCompteRendu`, suppression du menu auteur, affichage du panel et de
   l'organisateur.

## Hors périmètre (YAGNI)

Synthèse ou moyenne des notes au niveau de la demande, réordonnancement ou suppression d'un tour,
refonte visuelle de l'application, notifications de rappel automatiques, gestion des rôles au-delà
des gardes existantes.
