import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import {
  Creneau,
  Demande,
  Entretien,
  Modalite,
  MODALITE_VALUES,
  RoleEmploye,
  ROLE_LABEL,
  ROLES_EMPLOYES,
  TYPE_ENTRETIEN_VALUES,
  TypeEntretien,
} from '../../core/models';
import { DirectoryService } from '../../core/directory.service';
import { NotificationService } from '../../core/notification.service';
import { CreneauService } from '../../core/services/creneau.service';
import { DemandeService } from '../../core/services/demande.service';
import { EntretienService } from '../../core/services/entretien.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { PersonneService } from '../../core/services/personne.service';
import { auMoinsUnEvaluateur } from './au-moins-un-evaluateur';
import { panelCompletPourLeTour } from './panel-complet-pour-le-tour';
import { formatDate, formatDateTime, toApiDateTime } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';
import { StatusBadge } from '../../shared/ui/status-badge';

interface Evaluateur {
  id: number;
  nom: string;
  role: RoleEmploye;
}

@Component({
  selector: 'app-demande-detail',
  imports: [ReactiveFormsModule, RouterLink, Spinner, EmptyState, Modal, StatusBadge],
  templateUrl: './demande-detail.html',
})
export class DemandeDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly demandes = inject(DemandeService);
  private readonly creneaux = inject(CreneauService);
  private readonly entretiens = inject(EntretienService);
  private readonly personnes = inject(PersonneService);
  private readonly feedbacks = inject(FeedbackService);
  private readonly notify = inject(NotificationService);
  readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly modaliteValues = MODALITE_VALUES;
  readonly typeValues = TYPE_ENTRETIEN_VALUES;
  readonly roleValues = ROLES_EMPLOYES;
  readonly roleLabel = ROLE_LABEL;
  readonly evaluateursDispo = signal<Evaluateur[]>([]);
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;

  readonly loading = signal(true);
  readonly demande = signal<Demande | null>(null);
  readonly creneauxDispo = signal<Creneau[]>([]);
  readonly tours = signal<Entretien[]>([]);
  readonly comptesRendus = signal<Map<number, number>>(new Map());

  readonly proposeOpen = signal(false);
  readonly planOpen = signal(false);
  readonly editPosteOpen = signal(false);
  readonly busy = signal(false);

  readonly canModify = computed(() => {
    const d = this.demande();
    return !!d && d.statut !== 'Annulee' && d.statut !== 'Terminee';
  });

  /**
   * Prochain maillon de la chaîne RH → Technique → Managerial : le premier type
   * pas encore planifié. Simple suggestion — l'API laisse le type libre à chaque
   * tour, et un recrutement réel saute parfois une étape ou en double une.
   */
  readonly prochainTypeSuggere = computed<TypeEntretien>(() => {
    const dejaFaits = new Set(this.tours().map((t) => t.typeEntretien));
    return TYPE_ENTRETIEN_VALUES.find((t) => !dejaFaits.has(t)) ?? 'Managerial';
  });

  readonly proposeForm = this.fb.nonNullable.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
  });

  readonly editPosteForm = this.fb.nonNullable.group({
    poste: ['', Validators.required],
  });

  readonly planForm = this.fb.nonNullable.group(
    {
      creneauId: [null as number | null, Validators.required],
      modalite: ['Presentiel' as Modalite, Validators.required],
      lieuOuLien: ['', Validators.required],
      typeEntretien: ['RH' as TypeEntretien, Validators.required],
      evaluateurIds: [[] as number[], auMoinsUnEvaluateur()],
    },
    {
      validators: panelCompletPourLeTour(
        (id) => this.evaluateursDispo().find((e) => e.id === id)?.role,
      ),
    },
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.load(id);
    });

    // Les trois rôles peuvent siéger à un panel : chacun alimente le sélecteur.
    forkJoin(ROLES_EMPLOYES.map((role) => this.personnes.getEmployes(role))).subscribe(
      (listes) => {
        this.evaluateursDispo.set(
          listes.flatMap((employes, i) =>
            employes.map((e) => ({ id: e.id, nom: e.nom, role: ROLES_EMPLOYES[i] })),
          ),
        );
      },
    );
  }

  /** Point d'entrée de test : déclenche le chargement sans passer par le routeur. */
  chargerPourTest(id: number): void {
    this.load(id);
  }

  private load(id: number): void {
    this.loading.set(true);
    this.demandes.get(id).subscribe({
      next: (d) => {
        this.demande.set(d);
        this.loadCreneaux(id);
        this.loadTours(id);
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

  /** Tous les tours de la demande, du plus ancien au plus récent. */
  private loadTours(demandeId: number): void {
    this.entretiens.getAll().subscribe({
      next: (list) => {
        const tours = list
          .filter((e) => e.demandeEntretienId === demandeId)
          .sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
        this.tours.set(tours);
        this.loadCompteurs(tours);
      },
    });
  }

  /** Avancement des comptes-rendus, tour par tour. Un échec laisse les compteurs vides. */
  private loadCompteurs(tours: Entretien[]): void {
    if (tours.length === 0) {
      this.comptesRendus.set(new Map());
      return;
    }
    forkJoin(tours.map((t) => this.feedbacks.getByEntretien(t.id))).subscribe({
      next: (listes) =>
        this.comptesRendus.set(new Map(tours.map((t, i) => [t.id, listes[i].length]))),
      error: () => this.comptesRendus.set(new Map()),
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
        dateDebut: toApiDateTime(dateDebut),
        dateFin: toApiDateTime(dateFin),
      })
      .pipe(switchMap((creneau) => this.creneaux.proposer(creneau.id, d.id)))
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.proposeOpen.set(false);
          this.notify.success(res.message);
          this.loadCreneaux(d.id);
        },
        error: () => this.busy.set(false),
      });
  }

  // --- Planifier l'entretien ---
  openPlan(creneau?: Creneau): void {
    // Le RH organisateur est pré-coché : il siège au panel dans la quasi-totalité des cas.
    const organisateur = this.demande()?.rhId;
    this.planForm.reset({
      creneauId: creneau?.id ?? null,
      modalite: 'Presentiel',
      lieuOuLien: '',
      typeEntretien: this.prochainTypeSuggere(),
      evaluateurIds: organisateur ? [organisateur] : [],
    });
    this.planOpen.set(true);
  }

  toggleEvaluateur(id: number, coche: boolean): void {
    const control = this.planForm.controls.evaluateurIds;
    const actuels = control.value;
    control.setValue(coche ? [...actuels, id] : actuels.filter((x) => x !== id));
    control.markAsTouched();
  }

  estEvaluateurCoche(id: number): boolean {
    return this.planForm.controls.evaluateurIds.value.includes(id);
  }

  /** Libellé du rôle exigé par le tour et absent du panel, sinon `null`. */
  libelleRoleManquant(): string | null {
    const role = this.planForm.getError('roleManquantAuPanel') as
      | RoleEmploye
      | undefined;
    return role ? ROLE_LABEL[role] : null;
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
        modalite: v.modalite,
        lieuOuLien: v.lieuOuLien,
        typeEntretien: v.typeEntretien,
        evaluateurIds: v.evaluateurIds,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.planOpen.set(false);
          this.notify.success('Tour planifié, invitation envoyée.');
          // On reste sur la demande : le nouveau tour rejoint la timeline.
          this.loadTours(d.id);
          this.loadCreneaux(d.id);
        },
        error: () => this.busy.set(false),
      });
  }

  annuler(): void {
    const d = this.demande();
    if (!d) return;
    this.busy.set(true);
    this.demandes.annuler(d.id).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify.success(res.message);
        this.load(d.id);
      },
      error: () => this.busy.set(false),
    });
  }

  openEditPoste(): void {
    const d = this.demande();
    if (!d) return;
    this.editPosteForm.reset({ poste: d.poste });
    this.editPosteOpen.set(true);
  }

  submitEditPoste(): void {
    const d = this.demande();
    if (!d || this.editPosteForm.invalid) {
      this.editPosteForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.demandes.updatePoste(d.id, this.editPosteForm.getRawValue()).subscribe({
      next: (updated) => {
        this.demande.set(updated);
        this.busy.set(false);
        this.editPosteOpen.set(false);
        this.notify.success('Poste mis à jour.');
      },
      error: () => this.busy.set(false),
    });
  }
}
