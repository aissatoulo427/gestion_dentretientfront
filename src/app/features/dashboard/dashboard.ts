import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DirectoryService } from '../../core/directory.service';
import { Entretien } from '../../core/models';
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

  readonly isRecruteur = computed(() => this.auth.role() === 'Recruteur');

  readonly loading = signal(true);
  readonly nbCandidats = signal(0);
  readonly nbRecruteurs = signal(0);
  readonly nbManagers = signal(0);
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

    // Le manager ne pilote pas les personnes : on ne charge que les entretiens à valider.
    if (!this.isRecruteur()) {
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
      recruteurs: this.personnes.getRecruteurs(),
      managers: this.personnes.getManagers(),
      entretiens: this.entretiens.getAll(),
    }).subscribe({
      next: ({ candidats, recruteurs, managers, entretiens }) => {
        this.nbCandidats.set(candidats.length);
        this.nbRecruteurs.set(recruteurs.length);
        this.nbManagers.set(managers.length);
        this.allEntretiens.set(entretiens);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
