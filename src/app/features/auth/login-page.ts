import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/notification.service';
import { AuthLayout } from './auth-layout';

/**
 * Connexion seule : l'inscription publique n'existe plus. Les comptes sont créés
 * par un administrateur, et leur titulaire choisit son mot de passe via /activer.
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly busy = signal(false);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    motDePasse: ['', Validators.required],
  });

  constructor() {
    // Déjà connecté : rediriger directement.
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
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
        this.notify.success(`Bienvenue ${res.nom}.`);
        const redirectTo =
          this.route.snapshot.queryParamMap.get('redirectTo') || '/dashboard';
        this.router.navigateByUrl(redirectTo);
      },
      error: () => this.busy.set(false),
    });
  }
}
