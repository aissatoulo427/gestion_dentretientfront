import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DirectoryService } from '../../core/directory.service';
import { Candidat, RecruteurManager } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { PersonneService } from '../../core/services/personne.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';

type Tab = 'candidats' | 'recruteurs' | 'managers';

@Component({
  selector: 'app-personnes-page',
  imports: [ReactiveFormsModule, Spinner, EmptyState, Modal],
  templateUrl: './personnes-page.html',
})
export class PersonnesPage {
  private readonly personnes = inject(PersonneService);
  private readonly notify = inject(NotificationService);
  private readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'candidats', label: 'Candidats' },
    { key: 'recruteurs', label: 'Recruteurs' },
    { key: 'managers', label: 'Managers' },
  ];

  readonly activeTab = signal<Tab>('candidats');
  readonly loading = signal(false);
  readonly candidats = signal<Candidat[]>([]);
  readonly recruteurs = signal<RecruteurManager[]>([]);
  readonly managers = signal<RecruteurManager[]>([]);

  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly isCandidat = computed(() => this.activeTab() === 'candidats');
  readonly singular = computed(() =>
    this.activeTab() === 'candidats'
      ? 'candidat'
      : this.activeTab() === 'recruteurs'
        ? 'recruteur'
        : 'manager',
  );

  readonly form = this.fb.nonNullable.group({
    nom: ['', Validators.required],
    prenom: [''],
    email: ['', [Validators.required, Validators.email]],
    telephone: [''],
    motDePasse: [''],
  });

  constructor() {
    this.reload();
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (!this.hasData(tab)) this.reload();
  }

  private hasData(tab: Tab): boolean {
    if (tab === 'candidats') return this.candidats().length > 0;
    if (tab === 'recruteurs') return this.recruteurs().length > 0;
    return this.managers().length > 0;
  }

  reload(): void {
    const tab = this.activeTab();
    this.loading.set(true);
    const done = () => this.loading.set(false);
    if (tab === 'candidats') {
      this.personnes.getCandidats().subscribe({ next: (v) => this.candidats.set(v), error: done, complete: done });
    } else if (tab === 'recruteurs') {
      this.personnes.getRecruteurs().subscribe({ next: (v) => this.recruteurs.set(v), error: done, complete: done });
    } else {
      this.personnes.getManagers().subscribe({ next: (v) => this.managers.set(v), error: done, complete: done });
    }
  }

  openModal(): void {
    this.form.reset({ nom: '', prenom: '', email: '', telephone: '', motDePasse: '' });
    // Le mot de passe est requis pour les comptes staff (recruteur/manager), pas pour un candidat.
    const pwd = this.form.controls.motDePasse;
    if (this.activeTab() === 'candidats') {
      pwd.clearValidators();
    } else {
      pwd.setValidators([Validators.required, Validators.minLength(6)]);
    }
    pwd.updateValueAndValidity();
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
    const { nom, prenom, email, telephone, motDePasse } = this.form.getRawValue();
    this.saving.set(true);
    const tab = this.activeTab();

    if (tab === 'candidats') {
      this.personnes
        .createCandidat({ nom, prenom, email, telephone })
        .subscribe({
          next: (c) => {
            this.candidats.update((list) => [...list, c]);
            this.afterSave('Candidat créé.');
          },
          error: () => this.saving.set(false),
        });
    } else {
      const create =
        tab === 'recruteurs'
          ? this.personnes.createRecruteur({ nom, email, motDePasse })
          : this.personnes.createManager({ nom, email, motDePasse });
      create.subscribe({
        next: (p) => {
          if (tab === 'recruteurs') this.recruteurs.update((l) => [...l, p]);
          else this.managers.update((l) => [...l, p]);
          this.afterSave(tab === 'recruteurs' ? 'Recruteur créé.' : 'Manager créé.');
        },
        error: () => this.saving.set(false),
      });
    }
  }

  private afterSave(message: string): void {
    this.saving.set(false);
    this.modalOpen.set(false);
    this.notify.success(message);
    this.directory.load();
  }
}
