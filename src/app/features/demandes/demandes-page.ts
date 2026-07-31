import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Candidat, Demande } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { DemandeService } from '../../core/services/demande.service';
import { PersonneService } from '../../core/services/personne.service';
import { formatDate } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-demandes-page',
  imports: [ReactiveFormsModule, RouterLink, EmptyState, Modal, Spinner, StatusBadge],
  templateUrl: './demandes-page.html',
})
export class DemandesPage {
  private readonly demandes = inject(DemandeService);
  private readonly personnes = inject(PersonneService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly formatDate = formatDate;

  readonly loading = signal(true);
  readonly items = signal<Demande[]>([]);
  readonly candidats = signal<Candidat[]>([]);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    candidatId: [null as number | null, Validators.required],
    poste: ['', Validators.required],
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.demandes.getAll().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openModal(): void {
    this.form.reset({ candidatId: null, poste: '' });
    this.personnes.getCandidats().subscribe((candidats) => this.candidats.set(candidats));
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.demandes
      .create({ candidatId: v.candidatId!, poste: v.poste })
      .subscribe({
        next: (demande) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.notify.success('Demande créée.');
          this.router.navigate(['/demandes', demande.id]);
        },
        error: () => this.saving.set(false),
      });
  }
}
