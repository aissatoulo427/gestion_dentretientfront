import { Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  template: `<div class="flex items-center justify-center gap-2 py-12 text-navy-400">
    <svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
      <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
    </svg>
    <span class="text-sm font-medium">{{ label() }}</span>
  </div>`,
})
export class Spinner {
  readonly label = input('Chargement…');
}
