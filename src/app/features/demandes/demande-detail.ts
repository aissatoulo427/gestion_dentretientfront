import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  Creneau,
  Demande,
  Entretien,
  MODALITE_VALUES,
} from '../../core/models';
import { DirectoryService } from '../../core/directory.service';
import { NotificationService } from '../../core/notification.service';
import { CreneauService } from '../../core/services/creneau.service';
import { DemandeService } from '../../core/services/demande.service';
import { EntretienService } from '../../core/services/entretien.service';
import { formatDate, formatDateTime, toApiDateTime } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

@Component({
  selector: 'app-demande-detail',
  imports: [ReactiveFormsModule, RouterLink, Spinner, EmptyState, Modal, StatusBadge],
  templateUrl: './demande-detail.html',
})
export class DemandeDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly demandes = inject(DemandeService);
  private readonly creneaux = inject(CreneauService);
  private readonly entretiens = inject(EntretienService);
  private readonly notify = inject(NotificationService);
  readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly modaliteValues = MODALITE_VALUES;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;

  readonly loading = signal(true);
  readonly demande = signal<Demande | null>(null);
  readonly creneauxDispo = signal<Creneau[]>([]);
  readonly entretien = signal<Entretien | null>(null);

  readonly proposeOpen = signal(false);
  readonly planOpen = signal(false);
  readonly busy = signal(false);

  readonly canModify = computed(() => {
    const d = this.demande();
    return !!d && d.statut !== 'Annulee' && d.statut !== 'Terminee';
  });

  /** Étapes du workflow (fil d'étapes visuel). */
  readonly steps = computed(() => {
    const hasCreneaux = this.creneauxDispo().length > 0;
    const hasEntretien = !!this.entretien();
    return [
      { label: 'Demande créée', done: true, current: false },
      {
        label: 'Créneau proposé',
        done: hasCreneaux || hasEntretien,
        current: !hasCreneaux && !hasEntretien,
      },
      {
        label: 'Entretien planifié',
        done: hasEntretien,
        current: hasCreneaux && !hasEntretien,
      },
    ];
  });

  readonly proposeForm = this.fb.nonNullable.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
  });

  readonly planForm = this.fb.nonNullable.group({
    creneauId: [null as number | null, Validators.required],
    dateHeure: ['', Validators.required],
    modalite: ['Presentiel' as const, Validators.required],
    lieuOuLien: ['', Validators.required],
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.demandes.get(id).subscribe({
      next: (d) => {
        this.demande.set(d);
        this.loadCreneaux(id);
        this.loadEntretien(id);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadCreneaux(id: number): void {
    this.demandes.getCreneauxDisponibles(id).subscribe({
      next: (c) => this.creneauxDispo.set(c),
    });
  }

  private loadEntretien(demandeId: number): void {
    this.entretiens.getAll().subscribe({
      next: (list) =>
        this.entretien.set(list.find((e) => e.demandeEntretienId === demandeId) ?? null),
    });
  }

  // --- Proposer un créneau (créer puis rattacher) ---
  openPropose(): void {
    this.proposeForm.reset({ dateDebut: '', dateFin: '' });
    this.proposeOpen.set(true);
  }

  submitPropose(): void {
    const d = this.demande();
    if (!d || this.proposeForm.invalid) {
      this.proposeForm.markAllAsTouched();
      return;
    }
    const { dateDebut, dateFin } = this.proposeForm.getRawValue();
    this.busy.set(true);
    this.creneaux
      .create({
        recruteurId: d.recruteurId,
        dateDebut: toApiDateTime(dateDebut),
        dateFin: toApiDateTime(dateFin),
      })
      .pipe(switchMap((creneau) => this.creneaux.proposer(creneau.id, d.id)))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.proposeOpen.set(false);
          this.notify.success('Créneau proposé.');
          this.loadCreneaux(d.id);
        },
        error: () => this.busy.set(false),
      });
  }

  // --- Planifier l'entretien ---
  openPlan(creneau?: Creneau): void {
    this.planForm.reset({
      creneauId: creneau?.id ?? null,
      dateHeure: creneau ? creneau.dateDebut.slice(0, 16) : '',
      modalite: 'Presentiel',
      lieuOuLien: '',
    });
    this.planOpen.set(true);
  }

  submitPlan(): void {
    const d = this.demande();
    if (!d || this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    const v = this.planForm.getRawValue();
    this.busy.set(true);
    this.entretiens
      .planifier({
        demandeId: d.id,
        creneauId: v.creneauId!,
        dateHeure: toApiDateTime(v.dateHeure),
        modalite: v.modalite,
        lieuOuLien: v.lieuOuLien,
      })
      .subscribe({
        next: (entretien) => {
          this.busy.set(false);
          this.planOpen.set(false);
          this.notify.success('Entretien planifié, invitation envoyée.');
          this.router.navigate(['/entretiens', entretien.id]);
        },
        error: () => this.busy.set(false),
      });
  }

  annuler(): void {
    const d = this.demande();
    if (!d) return;
    this.busy.set(true);
    this.demandes.annuler(d.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Demande annulée.');
        this.load(d.id);
      },
      error: () => this.busy.set(false),
    });
  }
}
