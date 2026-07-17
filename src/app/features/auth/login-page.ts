import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models';
import { NotificationService } from '../../core/notification.service';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<Mode>('login');
  readonly busy = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    motDePasse: ['', Validators.required],
  });

  readonly registerForm = this.fb.nonNullable.group({
    role: ['Recruteur' as Role, Validators.required],
    nom: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    motDePasse: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    // Déjà connecté : rediriger directement.
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  submitLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.auth.login(this.loginForm.getRawValue()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.notify.success(`Bienvenue — connecté en tant que ${res.role}.`);
        const redirectTo =
          this.route.snapshot.queryParamMap.get('redirectTo') || '/dashboard';
        this.router.navigateByUrl(redirectTo);
      },
      error: () => this.busy.set(false),
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { role, nom, email, motDePasse } = this.registerForm.getRawValue();
    this.busy.set(true);
    const create =
      role === 'Recruteur'
        ? this.auth.registerRecruteur({ nom, email, motDePasse })
        : this.auth.registerManager({ nom, email, motDePasse });

    create.subscribe({
      next: () => {
        this.busy.set(false);
        this.notify.success('Compte créé. Vous pouvez vous connecter.');
        this.loginForm.patchValue({ email, motDePasse: '' });
        this.mode.set('login');
      },
      error: () => this.busy.set(false),
    });
  }
}
