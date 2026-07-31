import { Component } from '@angular/core';

/**
 * Habillage commun aux écrans publics (connexion, mot de passe oublié) :
 * colonne de marque à gauche, contenu projeté à droite.
 */
@Component({
  selector: 'app-auth-layout',
  template: `
    <div class="flex min-h-screen">
      <!-- Colonne de marque -->
      <div
        class="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-navy-800 to-navy-950 p-12 lg:flex"
      >
        <div class="flex items-center gap-3">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-sm font-bold text-white shadow-lg shadow-accent-500/30"
            >GE</span
          >
          <span class="text-lg font-semibold text-white">Gestion Entretiens</span>
        </div>
        <div>
          <h1 class="text-3xl font-bold leading-tight text-white">
            Pilotez vos entretiens<br />de recrutement.
          </h1>
          <p class="mt-4 max-w-md text-sm text-navy-200">
            Demandes, créneaux, planification, feedbacks — tout le processus dans un seul
            espace, du candidat à la décision finale.
          </p>
          <ul class="mt-8 space-y-3 text-sm text-navy-100">
            <li class="flex items-center gap-2">
              <span class="text-accent-400">✓</span> Suivi complet des demandes
            </li>
            <li class="flex items-center gap-2">
              <span class="text-accent-400">✓</span> Planification sur créneaux
            </li>
            <li class="flex items-center gap-2">
              <span class="text-accent-400">✓</span> Feedbacks &amp; décisions
            </li>
          </ul>
        </div>
        <p class="text-xs text-navy-400">© 2026 Gestion des entretiens</p>
      </div>

      <!-- Colonne contenu -->
      <div class="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div class="w-full max-w-sm">
          <div class="mb-6 flex items-center gap-2 lg:hidden">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-sm font-bold text-white"
              >GE</span
            >
            <span class="text-base font-semibold text-navy-900">Gestion Entretiens</span>
          </div>
          <ng-content />
        </div>
      </div>
    </div>
  `,
})
export class AuthLayout {}
