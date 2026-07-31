import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService } from '../../core/notification.service';
import { AuthLayout } from './auth-layout';
import { motsDePasseIdentiques } from './mots-de-passe-identiques';

/**
 * Parcours de réinitialisation en trois étapes sur une seule route :
 * demande du code, saisie du code, puis choix du nouveau mot de passe.
 *
 * L'étape 2 n'appelle pas l'API : `/auth/reinitialiser` attend email, code et
 * mot de passe d'un bloc, et aucun endpoint ne valide un code isolément.
 * Le code est donc conservé côté client jusqu'à l'envoi final.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, AuthLayout],
  templateUrl: './forgot-password-page.html',
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  /**
   * Activation d'un compte neuf plutôt que réinitialisation. Même parcours, même
   * corps de requête : seuls les textes et l'endpoint final changent.
   */
  readonly estActivation = this.route.snapshot.data['mode'] === 'activation';

  readonly step = signal<1 | 2 | 3>(1);
  readonly busy = signal(false);

  readonly demandeForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly codeForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    // Le code fait exactement 6 chiffres : une faute de frappe est rattrapée ici
    // plutôt qu'après la saisie du mot de passe. Sa validité, elle, ne peut être
    // vérifiée qu'à l'envoi final — aucun endpoint ne contrôle un code seul.
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly motDePasseForm = this.fb.nonNullable.group(
    {
      nouveauMotDePasse: ['', [Validators.required, Validators.minLength(6)]],
      confirmation: ['', Validators.required],
    },
    { validators: motsDePasseIdentiques('nouveauMotDePasse') },
  );

  /** Raccourci pour l'utilisateur revenu plus tard avec le code reçu par email. */
  allerAuCode(): void {
    this.codeForm.patchValue({ email: this.demandeForm.controls.email.value });
    this.step.set(2);
  }

  retour(): void {
    this.step.set(1);
  }

  /** Retour à la saisie du code, sans perdre ce qui a déjà été tapé. */
  retourAuCode(): void {
    this.step.set(2);
  }

  /**
   * Fait valider le code par l'API avant de laisser choisir un mot de passe :
   * l'utilisateur apprend qu'il est invalide ou expiré à ce moment-là, et non
   * après avoir tout saisi.
   */
  validerCode(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.auth.verifierCode(this.codeForm.getRawValue()).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.succes) {
          this.notify.error(res.message);
          return;
        }
        this.step.set(3);
      },
      // Le 400 est signalé par httpErrorInterceptor : on reste sur le code.
      error: () => this.busy.set(false),
    });
  }

  soumettreDemande(): void {
    if (this.demandeForm.invalid) {
      this.demandeForm.markAllAsTouched();
      return;
    }

    const { email } = this.demandeForm.getRawValue();
    this.busy.set(true);
    this.auth.demanderCodeReinitialisation({ email }).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.succes) {
          // Refus signalé dans le corps plutôt que par le code HTTP : on ne fait
          // pas saisir un code qui n'arrivera jamais.
          this.notify.error(res.message);
          return;
        }
        this.notify.success(res.message);
        this.codeForm.patchValue({ email });
        this.step.set(2);
      },
      error: () => this.busy.set(false),
    });
  }

  soumettreReset(): void {
    if (this.motDePasseForm.invalid) {
      this.motDePasseForm.markAllAsTouched();
      return;
    }

    const { email, code } = this.codeForm.getRawValue();
    const { nouveauMotDePasse } = this.motDePasseForm.getRawValue();
    const payload = { email, code, nouveauMotDePasse };
    this.busy.set(true);

    const envoi = this.estActivation
      ? this.auth.activerCompte(payload)
      : this.auth.reinitialiserMotDePasse(payload);

    envoi.subscribe({
      next: (res) => {
        this.busy.set(false);
        if (!res.succes) {
          // Le code est le seul champ que l'utilisateur puisse corriger : on l'y ramène.
          this.notify.error(res.message);
          this.step.set(2);
          return;
        }
        this.notify.success(res.message);
        this.router.navigate(['/login']);
      },
      // Le 400 est signalé par httpErrorInterceptor ; on ramène aussi au code.
      error: () => {
        this.busy.set(false);
        this.step.set(2);
      },
    });
  }
}
