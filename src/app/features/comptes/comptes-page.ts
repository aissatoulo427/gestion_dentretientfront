import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Employe, RoleEmploye, ROLE_LABEL, ROLES_EMPLOYES } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { PersonneService } from '../../core/services/personne.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';

/**
 * Gestion des comptes employés, réservée à l'administrateur.
 * Aucun mot de passe n'est saisi ici : le titulaire reçoit un code d'activation
 * et choisit le sien. Il n'existe pas d'écran pour créer un admin — le premier
 * naît de la configuration du backend.
 */
@Component({
  selector: 'app-comptes-page',
  imports: [ReactiveFormsModule, Spinner, EmptyState, Modal],
  templateUrl: './comptes-page.html',
})
export class ComptesPage {
  private readonly personnes = inject(PersonneService);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly roles = ROLES_EMPLOYES;
  readonly roleLabel = ROLE_LABEL;

  readonly activeRole = signal<RoleEmploye>('RH');
  readonly loading = signal(false);
  readonly comptes = signal<Record<RoleEmploye, Employe[]>>({
    RH: [],
    EvaluateurTechnique: [],
    Manager: [],
  });

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly comptesAffiches = computed(() => this.comptes()[this.activeRole()]);

  readonly form = this.fb.nonNullable.group({
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.reload();
  }

  selectRole(role: RoleEmploye): void {
    this.activeRole.set(role);
    if (this.comptes()[role].length === 0) this.reload();
  }

  reload(): void {
    const role = this.activeRole();
    this.loading.set(true);
    const done = () => this.loading.set(false);
    this.personnes.getEmployes(role).subscribe({
      next: (v) => this.comptes.update((map) => ({ ...map, [role]: v })),
      error: done,
      complete: done,
    });
  }

  openModal(): void {
    this.form.reset({ nom: '', email: '' });
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
    const role = this.activeRole();
    this.saving.set(true);
    this.personnes.createEmploye(role, this.form.getRawValue()).subscribe({
      next: (compte) => {
        this.comptes.update((map) => ({ ...map, [role]: [...map[role], compte] }));
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notify.success(
          `${ROLE_LABEL[role]} créé. Un code d'activation vient de lui être envoyé.`,
        );
      },
      error: () => this.saving.set(false),
    });
  }
}
