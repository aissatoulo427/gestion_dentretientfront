import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div
      class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4 backdrop-blur-sm sm:p-8"
      (click)="close.emit()"
    >
      <div
        class="animate-[modalIn_0.15s_ease-out] mt-6 w-full max-w-lg rounded-[var(--radius-xl2)] bg-white shadow-2xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center justify-between border-b border-navy-100 px-6 py-4">
          <h2 class="text-base font-semibold text-navy-950">{{ title() }}</h2>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-navy-700"
            (click)="close.emit()"
            aria-label="Fermer"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div class="px-6 py-5">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      @keyframes modalIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class Modal {
  readonly title = input('');
  readonly close = output<void>();
}
