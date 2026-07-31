import { Routes } from '@angular/router';
import { adminGuard, authGuard, employeGuard, rhGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'mot-de-passe-oublie',
    data: { mode: 'reinitialisation' },
    loadComponent: () =>
      import('./features/auth/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    // Premier accès : le compte existe, son titulaire choisit son mot de passe.
    path: 'activer',
    data: { mode: 'activation' },
    loadComponent: () =>
      import('./features/auth/forgot-password-page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'comptes',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/comptes/comptes-page').then((m) => m.ComptesPage),
      },
      {
        path: 'candidats',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/candidats/candidats-page').then((m) => m.CandidatsPage),
      },
      {
        path: 'demandes',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/demandes/demandes-page').then((m) => m.DemandesPage),
      },
      {
        path: 'demandes/:id',
        canActivate: [rhGuard],
        loadComponent: () =>
          import('./features/demandes/demande-detail').then((m) => m.DemandeDetail),
      },
      {
        // Chacun pose ses disponibilités, sauf l'admin qui ne fait pas passer d'entretien.
        path: 'creneaux',
        canActivate: [employeGuard],
        loadComponent: () =>
          import('./features/creneaux/creneaux-page').then((m) => m.CreneauxPage),
      },
      {
        path: 'entretiens',
        canActivate: [employeGuard],
        loadComponent: () =>
          import('./features/entretiens/entretiens-page').then((m) => m.EntretiensPage),
      },
      {
        path: 'entretiens/:id',
        canActivate: [employeGuard],
        loadComponent: () =>
          import('./features/entretiens/entretien-detail').then((m) => m.EntretienDetail),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
