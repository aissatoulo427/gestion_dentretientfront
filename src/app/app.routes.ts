import { Routes } from '@angular/router';
import { authGuard, recruteurGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-page').then((m) => m.LoginPage),
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
        path: 'personnes',
        canActivate: [recruteurGuard],
        loadComponent: () =>
          import('./features/personnes/personnes-page').then((m) => m.PersonnesPage),
      },
      {
        path: 'demandes',
        canActivate: [recruteurGuard],
        loadComponent: () =>
          import('./features/demandes/demandes-page').then((m) => m.DemandesPage),
      },
      {
        path: 'demandes/:id',
        canActivate: [recruteurGuard],
        loadComponent: () =>
          import('./features/demandes/demande-detail').then((m) => m.DemandeDetail),
      },
      {
        path: 'creneaux',
        canActivate: [recruteurGuard],
        loadComponent: () =>
          import('./features/creneaux/creneaux-page').then((m) => m.CreneauxPage),
      },
      {
        path: 'entretiens',
        loadComponent: () =>
          import('./features/entretiens/entretiens-page').then((m) => m.EntretiensPage),
      },
      {
        path: 'entretiens/:id',
        loadComponent: () =>
          import('./features/entretiens/entretien-detail').then((m) => m.EntretienDetail),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
