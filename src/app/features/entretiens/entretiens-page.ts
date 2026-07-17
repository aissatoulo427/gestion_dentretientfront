import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DirectoryService } from '../../core/directory.service';
import { Entretien } from '../../core/models';
import { EntretienService } from '../../core/services/entretien.service';
import { formatDateTime, MODALITE_LABEL } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-entretiens-page',
  imports: [RouterLink, Spinner, EmptyState, StatusBadge],
  templateUrl: './entretiens-page.html',
})
export class EntretiensPage {
  private readonly entretiens = inject(EntretienService);
  readonly directory = inject(DirectoryService);

  readonly formatDateTime = formatDateTime;
  readonly modaliteLabel = MODALITE_LABEL;
  readonly loading = signal(true);
  readonly items = signal<Entretien[]>([]);

  constructor() {
    this.entretiens.getAll().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
