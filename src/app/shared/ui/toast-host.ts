import { Component, inject } from '@angular/core';
import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="pointer-events-none fixed right-4 top-4 z-50 flex w-80 flex-col gap-2.5">
      @for (toast of notifications.toasts(); track toast.id) {
        <div
          class="animate-[toastIn_0.2s_ease-out] pointer-events-auto flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-lg shadow-navy-900/5"
          [class]="border(toast.type)"
          role="alert"
        >
          <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" [class]="dot(toast.type)">
            @switch (toast.type) {
              @case ('success') { <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> }
              @case ('error') { <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg> }
              @default { <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" d="M12 8h.01M11 12h1v4h1"/></svg> }
            }
          </span>
          <span class="flex-1 text-sm text-navy-800">{{ toast.message }}</span>
          <button
            type="button"
            class="text-navy-300 transition hover:text-navy-600"
            (click)="notifications.dismiss(toast.id)"
            aria-label="Fermer"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @keyframes toastIn {
        from {
          opacity: 0;
          transform: translateX(16px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `,
  ],
})
export class ToastHost {
  readonly notifications = inject(NotificationService);

  border(type: string): string {
    switch (type) {
      case 'success':
        return 'border-emerald-100';
      case 'error':
        return 'border-red-100';
      default:
        return 'border-navy-100';
    }
  }

  dot(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-accent-500';
    }
  }
}
