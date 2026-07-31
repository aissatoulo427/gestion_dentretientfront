import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DirectoryService } from '../../core/directory.service';
import { Entretien, RoleEmploye, ROLE_LABEL, ROLES_EMPLOYES } from '../../core/models';
import { EntretienService } from '../../core/services/entretien.service';
import { PersonneService } from '../../core/services/personne.service';
import { formatDateTime, MODALITE_LABEL } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Spinner, EmptyState, StatusBadge],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly personnes = inject(PersonneService);
  private readonly entretiens = inject(EntretienService);
  private readonly auth = inject(AuthService);
  readonly directory = inject(DirectoryService);

  readonly isRh = computed(() => this.auth.role() === 'RH');
  readonly isAdmin = computed(() => this.auth.role() === 'Admin');

  readonly roleLabel = ROLE_LABEL;
  readonly rolesEmployes = ROLES_EMPLOYES;

  readonly loading = signal(true);
  readonly nbCandidats = signal(0);
  readonly nbEmployes = signal(0);
  /** Comptes par rôle — le seul chiffre qui parle à l'administrateur. */
  readonly nbParRole = signal<Record<RoleEmploye, number>>({
    RH: 0,
    EvaluateurTechnique: 0,
    Manager: 0,
  });
  readonly allEntretiens = signal<Entretien[]>([]);

  readonly formatDateTime = formatDateTime;
  readonly modaliteLabel = MODALITE_LABEL;

  readonly nbEntretiens = computed(() => this.allEntretiens().length);

  readonly nbAVenir = computed(() => this.aVenir().length);

  readonly aVenir = computed(() => {
    const now = Date.now();
    return this.allEntretiens()
      .filter(
        (e) =>
          e.statut !== 'Annule' &&
          e.statut !== 'Termine' &&
          new Date(e.dateHeure).getTime() >= now,
      )
      .sort(
        (a, b) => new Date(a.dateHeure).getTime() - new Date(b.dateHeure).getTime(),
      )
      .slice(0, 8);
  });

  readonly parStatut = computed(() => {
    const counts: Record<string, number> = {};
    for (const e of this.allEntretiens()) {
      counts[e.statut] = (counts[e.statut] ?? 0) + 1;
    }
    return Object.entries(counts).map(([statut, count]) => ({ statut, count }));
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    // L'admin ne recrute pas : ni entretiens ni candidats, seulement les comptes.
    if (this.isAdmin()) {
      forkJoin(ROLES_EMPLOYES.map((role) => this.personnes.getEmployes(role))).subscribe({
        next: (listes) => {
          this.nbParRole.set({
            RH: listes[0].length,
            EvaluateurTechnique: listes[1].length,
            Manager: listes[2].length,
          });
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    // Seul le RH pilote les personnes : les autres ne voient que leurs entretiens.
    if (!this.isRh()) {
      this.entretiens.getAll().subscribe({
        next: (entretiens) => {
          this.allEntretiens.set(entretiens);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    forkJoin({
      candidats: this.personnes.getCandidats(),
      rh: this.personnes.getRh(),
      evaluateursTechniques: this.personnes.getEvaluateursTechniques(),
      managers: this.personnes.getManagers(),
      entretiens: this.entretiens.getAll(),
    }).subscribe({
      next: ({ candidats, rh, evaluateursTechniques, managers, entretiens }) => {
        this.nbCandidats.set(candidats.length);
        this.nbEmployes.set(rh.length + evaluateursTechniques.length + managers.length);
        this.allEntretiens.set(entretiens);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
