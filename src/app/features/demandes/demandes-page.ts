import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Candidat,
  Demande,
  RecruteurManager,
  TYPE_ENTRETIEN_VALUES,
} from '../../core/models';
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

  readonly typeValues = TYPE_ENTRETIEN_VALUES;
  readonly formatDate = formatDate;

  readonly loading = signal(true);
  readonly items = signal<Demande[]>([]);
  readonly recruteurs = signal<RecruteurManager[]>([]);
  readonly candidats = signal<Candidat[]>([]);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    recruteurId: [null as number | null, Validators.required],
    candidatId: [null as number | null, Validators.required],
    poste: ['', Validators.required],
    typeEntretien: ['RH' as const, Validators.required],
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
    this.form.reset({ recruteurId: null, candidatId: null, poste: '', typeEntretien: 'RH' });
    forkJoin({
      recruteurs: this.personnes.getRecruteurs(),
      candidats: this.personnes.getCandidats(),
    }).subscribe(({ recruteurs, candidats }) => {
      this.recruteurs.set(recruteurs);
      this.candidats.set(candidats);
    });
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
      .create({
        recruteurId: v.recruteurId!,
        candidatId: v.candidatId!,
        poste: v.poste,
        typeEntretien: v.typeEntretien,
      })
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
