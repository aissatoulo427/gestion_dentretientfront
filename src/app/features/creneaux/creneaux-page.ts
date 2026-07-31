import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DirectoryService } from '../../core/directory.service';
import { Creneau } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { CreneauService } from '../../core/services/creneau.service';
import { formatDateTime, toApiDateTime } from '../../shared/format';
import { EmptyState } from '../../shared/ui/empty-state';
import { Modal } from '../../shared/ui/modal';
import { Spinner } from '../../shared/ui/spinner';

@Component({
  selector: 'app-creneaux-page',
  imports: [ReactiveFormsModule, EmptyState, Modal, Spinner],
  templateUrl: './creneaux-page.html',
})
export class CreneauxPage {
  private readonly creneaux = inject(CreneauService);
  private readonly notify = inject(NotificationService);
  readonly directory = inject(DirectoryService);
  private readonly fb = inject(FormBuilder);

  readonly formatDateTime = formatDateTime;
  readonly loading = signal(true);
  readonly items = signal<Creneau[]>([]);
  readonly modalOpen = signal(false);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    dateDebut: ['', Validators.required],
    dateFin: ['', Validators.required],
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.creneaux.getAll().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openModal(): void {
    this.form.reset({ dateDebut: '', dateFin: '' });
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
    this.creneaux
      .create({
        dateDebut: toApiDateTime(v.dateDebut),
        dateFin: toApiDateTime(v.dateFin),
      })
      .subscribe({
        next: (c) => {
          this.items.update((list) => [c, ...list]);
          this.saving.set(false);
          this.modalOpen.set(false);
          this.notify.success('Créneau créé.');
        },
        error: () => this.saving.set(false),
      });
  }
}
