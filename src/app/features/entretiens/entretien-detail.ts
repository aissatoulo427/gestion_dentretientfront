import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Creneau,
  DECISION_VALUES,
  Demande,
  Entretien,
  Feedback,
} from '../../core/models';
import { DirectoryService } from '../../core/directory.service';
import { NotificationService } from '../../core/notification.service';
import { DemandeService } from '../../core/services/demande.service';
import { EntretienService } from '../../core/services/entretien.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AuthService } from '../../core/auth/auth.service';
import { DECISION_LABEL, formatDateTime, MODALITE_LABEL } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

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
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly decisionValues = DECISION_VALUES;
  readonly decisionLabel = DECISION_LABEL;
  readonly modaliteLabel = MODALITE_LABEL;
  readonly formatDateTime = formatDateTime;

  readonly loading = signal(true);
  readonly entretien = signal<Entretien | null>(null);
  readonly demande = signal<Demande | null>(null);
  readonly feedbackList = signal<Feedback[]>([]);
  readonly creneauxDispo = signal<Creneau[]>([]);

  readonly reprogOpen = signal(false);
  readonly feedbackOpen = signal(false);
  readonly busy = signal(false);

  /** Le RH qui a créé la demande est le seul à piloter ses entretiens. */
  readonly estOrganisateur = computed(() => {
    const d = this.demande();
    const moi = this.auth.personneId();
    return d !== null && moi !== null && d.rhId === moi;
  });

  readonly canAct = computed(() => this.raisonActionsIndisponibles() === null);

  readonly raisonActionsIndisponibles = computed<string | null>(() => {
    const e = this.entretien();
    if (!e) return 'Entretien introuvable.';
    if (e.statut === 'Annule' || e.statut === 'Termine') {
      return 'Aucune action disponible pour ce statut.';
    }
    if (!this.estOrganisateur()) {
      return "Seul le RH qui a créé la demande peut confirmer, reprogrammer ou relancer.";
    }
    return null;
  });

  /** Seul un évaluateur du panel, qui n'a pas encore déposé, peut saisir son compte-rendu. */
  readonly peutSaisirCompteRendu = computed(() => this.raisonBlocage() === null);

  readonly raisonBlocage = computed<string | null>(() => {
    const e = this.entretien();
    const moi = this.auth.personneId();
    if (!e || moi === null) return "Votre session ne permet pas d'identifier l'auteur.";
    if (!e.evaluateurIds.includes(moi)) {
      return 'Vous ne faites pas partie du panel de cet entretien.';
    }
    if (this.feedbackList().some((f) => f.auteurId === moi)) {
      return 'Vous avez déjà saisi votre compte-rendu pour ce tour.';
    }
    return null;
  });

  readonly reprogForm = this.fb.nonNullable.group({
    nouveauCreneauId: [null as number | null, Validators.required],
  });

  readonly feedbackForm = this.fb.nonNullable.group({
    note: [3, [Validators.required, Validators.min(0), Validators.max(5)]],
    decision: ['Favorable' as const, Validators.required],
    commentaire: ['', Validators.required],
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.load(id);
    });
  }

  /** Point d'entrée de test : déclenche le chargement sans passer par le routeur. */
  chargerPourTest(id: number): void {
    this.load(id);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.entretiens.get(id).subscribe({
      next: (e) => {
        this.entretien.set(e);
        this.loadFeedbacks(id);
        // L'organisateur n'est plus porté par l'entretien : il se lit sur la demande.
        this.demandes
          .get(e.demandeEntretienId)
          .subscribe({ next: (d) => this.demande.set(d) });
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
      next: (res) => {
        this.busy.set(false);
        this.notify.success(res.message);
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
    this.reprogForm.reset({ nouveauCreneauId: null });
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
      .reprogrammer(e.id, { nouveauCreneauId: v.nouveauCreneauId! })
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
    this.feedbackForm.reset({ note: 3, decision: 'Favorable', commentaire: '' });
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
