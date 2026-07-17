import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  Creneau,
  DECISION_VALUES,
  Entretien,
  Feedback,
} from '../../core/models';
import { DirectoryService } from '../../core/directory.service';
import { NotificationService } from '../../core/notification.service';
import { DemandeService } from '../../core/services/demande.service';
import { EntretienService } from '../../core/services/entretien.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PersonneService } from '../../core/services/personne.service';
import {
  DECISION_LABEL,
  formatDateTime,
  MODALITE_LABEL,
  toApiDateTime,
} from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

interface Auteur {
  id: number;
  nom: string;
  role: 'Recruteur' | 'Manager';
}

@Component({
  selector: 'app-entretien-detail',
  imports: [ReactiveFormsModule, RouterLink, Spinner, EmptyState, Modal, StatusBadge],
  templateUrl: './entretien-detail.html',
})
export class EntretienDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly entretiens = inject(EntretienService);
  private readonly feedbacks = inject(FeedbackService);
  private readonly demandes = inject(DemandeService);
  private readonly personnes = inject(PersonneService);
  private readonly notify = inject(NotificationService);
  readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly decisionValues = DECISION_VALUES;
  readonly decisionLabel = DECISION_LABEL;
  readonly modaliteLabel = MODALITE_LABEL;
  readonly formatDateTime = formatDateTime;

  readonly loading = signal(true);
  readonly entretien = signal<Entretien | null>(null);
  readonly feedbackList = signal<Feedback[]>([]);
  readonly creneauxDispo = signal<Creneau[]>([]);
  readonly auteurs = signal<Auteur[]>([]);

  readonly reprogOpen = signal(false);
  readonly feedbackOpen = signal(false);
  readonly busy = signal(false);

  readonly canAct = computed(() => {
    const e = this.entretien();
    return !!e && e.statut !== 'Annule' && e.statut !== 'Termine';
  });

  readonly reprogForm = this.fb.nonNullable.group({
    nouveauCreneauId: [null as number | null, Validators.required],
    nouvelleDateHeure: ['', Validators.required],
  });

  readonly feedbackForm = this.fb.nonNullable.group({
    auteurId: [null as number | null, Validators.required],
    note: [3, [Validators.required, Validators.min(0), Validators.max(5)]],
    decision: ['Favorable' as const, Validators.required],
    commentaire: ['', Validators.required],
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.load(id);
    });
    forkJoin({
      recruteurs: this.personnes.getRecruteurs(),
      managers: this.personnes.getManagers(),
    }).subscribe(({ recruteurs, managers }) => {
      this.auteurs.set([
        ...recruteurs.map((r) => ({ id: r.id, nom: r.nom, role: 'Recruteur' as const })),
        ...managers.map((m) => ({ id: m.id, nom: m.nom, role: 'Manager' as const })),
      ]);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.entretiens.get(id).subscribe({
      next: (e) => {
        this.entretien.set(e);
        this.loadFeedbacks(id);
        this.demandes
          .getCreneauxDisponibles(e.demandeEntretienId)
          .subscribe({ next: (c) => this.creneauxDispo.set(c) });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadFeedbacks(entretienId: number): void {
    this.feedbacks
      .getByEntretien(entretienId)
      .subscribe({ next: (f) => this.feedbackList.set(f) });
  }

  confirmer(): void {
    const e = this.entretien();
    if (!e) return;
    this.busy.set(true);
    this.entretiens.confirmer(e.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Entretien confirmé.');
        this.load(e.id);
      },
      error: () => this.busy.set(false),
    });
  }

  rappel(): void {
    const e = this.entretien();
    if (!e) return;
    this.busy.set(true);
    this.entretiens.rappel(e.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Rappel envoyé au candidat.');
      },
      error: () => this.busy.set(false),
    });
  }

  openReprog(): void {
    this.reprogForm.reset({ nouveauCreneauId: null, nouvelleDateHeure: '' });
    this.reprogOpen.set(true);
  }

  submitReprog(): void {
    const e = this.entretien();
    if (!e || this.reprogForm.invalid) {
      this.reprogForm.markAllAsTouched();
      return;
    }
    const v = this.reprogForm.getRawValue();
    this.busy.set(true);
    this.entretiens
      .reprogrammer(e.id, {
        nouveauCreneauId: v.nouveauCreneauId!,
        nouvelleDateHeure: toApiDateTime(v.nouvelleDateHeure),
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.reprogOpen.set(false);
          this.notify.success('Entretien reprogrammé.');
          this.load(e.id);
        },
        error: () => this.busy.set(false),
      });
  }

  openFeedback(): void {
    this.feedbackForm.reset({ auteurId: null, note: 3, decision: 'Favorable', commentaire: '' });
    this.feedbackOpen.set(true);
  }

  submitFeedback(): void {
    const e = this.entretien();
    if (!e || this.feedbackForm.invalid) {
      this.feedbackForm.markAllAsTouched();
      return;
    }
    const v = this.feedbackForm.getRawValue();
    this.busy.set(true);
    this.feedbacks
      .create({
        entretienId: e.id,
        auteurId: v.auteurId!,
        note: v.note,
        commentaire: v.commentaire,
        decision: v.decision,
      })
      .subscribe({
        next: (f) => {
          this.feedbackList.update((list) => [...list, f]);
          this.busy.set(false);
          this.feedbackOpen.set(false);
          this.notify.success('Feedback enregistré.');
        },
        error: () => this.busy.set(false),
      });
  }
}
