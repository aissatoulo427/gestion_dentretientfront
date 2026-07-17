import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Role } from '../core/models';

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

  readonly role = this.auth.role;
  readonly email = this.auth.email;

  private readonly allNav: NavItem[] = [
    { path: '/dashboard', label: 'Tableau de bord', icon: 'dashboard' },
    { path: '/personnes', label: 'Personnes', icon: 'personnes', roles: ['Recruteur'] },
    { path: '/demandes', label: 'Demandes', icon: 'demandes', roles: ['Recruteur'] },
    { path: '/creneaux', label: 'Créneaux', icon: 'creneaux', roles: ['Recruteur'] },
    { path: '/entretiens', label: 'Entretiens', icon: 'entretiens' },
  ];

  /** Navigation filtrée selon le rôle connecté (Manager = validation uniquement). */
  readonly nav = computed(() => {
    const role = this.role();
    return this.allNav.filter((item) => !item.roles || (role && item.roles.includes(role)));
  });

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
