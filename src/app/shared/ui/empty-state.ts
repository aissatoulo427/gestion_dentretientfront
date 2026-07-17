import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `<div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 text-navy-300">
      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7.5 12 11m0 0 8-3.5M12 11v9" />
      </svg>
    </div>
    <p class="mt-4 text-sm font-semibold text-navy-800">{{ title() }}</p>
    @if (hint()) {
      <p class="mt-1 max-w-sm text-xs text-navy-400">{{ hint() }}</p>
    }
  </div>`,
})
export class EmptyState {
  readonly title = input('Aucune donnée');
  readonly hint = input<string>('');
}
