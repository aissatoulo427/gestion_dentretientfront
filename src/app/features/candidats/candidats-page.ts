import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DirectoryService } from '../../core/directory.service';
import { Candidat } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { PersonneService } from '../../core/services/personne.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';

/** Les candidats du recrutement, pilotés par le RH. Les comptes employés vivent sur /comptes. */
@Component({
  selector: 'app-candidats-page',
  imports: [ReactiveFormsModule, Spinner, EmptyState, Modal],
  templateUrl: './candidats-page.html',
})
export class CandidatsPage {
  private readonly personnes = inject(PersonneService);
  private readonly notify = inject(NotificationService);
  private readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(false);
  readonly candidats = signal<Candidat[]>([]);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);
  readonly editTarget = signal<Candidat | null>(null);

  readonly form = this.fb.nonNullable.group({
    nom: ['', Validators.required],
    prenom: [''],
    email: ['', [Validators.required, Validators.email]],
    telephone: [''],
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    const done = () => this.loading.set(false);
    this.personnes.getCandidats().subscribe({
      next: (v) => this.candidats.set(v),
      error: done,
      complete: done,
    });
  }

  openModal(candidat?: Candidat): void {
    this.editTarget.set(candidat ?? null);
    this.form.reset(candidat ?? { nom: '', prenom: '', email: '', telephone: '' });
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
    const target = this.editTarget();
    this.saving.set(true);
    const req = target
      ? this.personnes.updateCandidat(target.id, this.form.getRawValue())
      : this.personnes.createCandidat(this.form.getRawValue());
    req.subscribe({
      next: (c) => {
        this.candidats.update((list) =>
          target ? list.map((x) => (x.id === c.id ? c : x)) : [...list, c],
        );
        this.saving.set(false);
        this.modalOpen.set(false);
        this.notify.success(target ? 'Candidat modifié.' : 'Candidat créé.');
        this.directory.load();
      },
      error: () => this.saving.set(false),
    });
  }

  supprimer(candidat: Candidat): void {
    if (!confirm(`Supprimer ${candidat.prenom} ${candidat.nom} ?`)) return;
    this.personnes.deleteCandidat(candidat.id).subscribe({
      next: () => {
        this.candidats.update((list) => list.filter((c) => c.id !== candidat.id));
        this.notify.success('Candidat supprimé.');
        this.directory.load();
      },
    });
  }
}
