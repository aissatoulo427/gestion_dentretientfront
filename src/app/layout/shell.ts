import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Role, ROLES_EMPLOYES } from '../core/models';
import { NotificationService } from '../core/notification.service';

interface NavItem {
  path: string;
  label: string;
  icon: 'dashboard' | 'personnes' | 'demandes' | 'creneaux' | 'entretiens';
  /** Rôles autorisés à voir l'entrée. Absent = tous. */
  roles?: Role[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly role = this.auth.role;
  readonly email = this.auth.email;
  readonly nom = this.auth.nom;

  constructor() {
    // Le token a expiré pendant la navigation : même traitement qu'un 401 sur
    // un endpoint protégé, pour que les deux chemins soient indiscernables.
    effect(() => {
      if (!this.auth.sessionExpiree()) return;
      this.notify.error('Session expirée, veuillez vous reconnecter.');
      this.router.navigate(['/login']);
    });
  }

  private readonly allNav: NavItem[] = [
    { path: '/dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/comptes', label: 'Comptes', icon: 'personnes', roles: ['Admin'] },
    { path: '/candidats', label: 'Candidats', icon: 'personnes', roles: ['RH'] },
    { path: '/demandes', label: 'Demandes', icon: 'demandes', roles: ['RH'] },
    { path: '/creneaux', label: 'Créneaux', icon: 'creneaux', roles: ROLES_EMPLOYES },
    { path: '/entretiens', label: 'Entretiens', icon: 'entretiens', roles: ROLES_EMPLOYES },
  ];

  /** Navigation filtrée selon le rôle connecté : seul le RH pilote le recrutement. */
  readonly nav = computed(() => {
    const role = this.role();
    return this.allNav.filter((item) => !item.roles || (role && item.roles.includes(role)));
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
