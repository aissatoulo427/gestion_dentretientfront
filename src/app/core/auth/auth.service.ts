import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  ApiMessage,
  AuthSession,
  LoginRequest,
  LoginResponse,
  MotDePasseOublieRequest,
  MotDePasseOublieResponse,
  ReinitialiserRequest,
  ReinitialiserResponse,
  Role,
  VerifierCodeRequest,
} from '../models';

const STORAGE_KEY = 'ge_auth';

/** Plafond de `setTimeout` (2^31-1 ms, ~24,8 jours) : au-delà, le délai déborde. */
const DELAI_TIMER_MAX = 2_147_483_647;


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _session = signal<AuthSession | null>(this.read());
  readonly session = this._session.asReadonly();

  private readonly _sessionExpiree = signal(false);
  /**
   * Passe à `true` quand le token arrive à échéance pendant que l'utilisateur
   * navigue. L'UI (cf. `Shell`) y réagit ; le service reste sans dépendance
   * au routeur ni aux notifications.
   */
  readonly sessionExpiree = this._sessionExpiree.asReadonly();

  private timerExpiration: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const restauree = this._session();
    if (restauree) this.armerExpiration(restauree);
  }

  /**
   * Vrai si une session existe et n'est pas expirée.
   * Méthode et non `computed` : l'horloge n'est pas un signal, un `computed`
   * resterait mémoïsé sur sa dernière valeur et ne verrait jamais l'expiration.
   */
  isAuthenticated(): boolean {
    const s = this._session();
    return s !== null && !this.estExpiree(s);
  }

  private estExpiree(session: AuthSession): boolean {
    return new Date(session.expiration).getTime() <= Date.now();
  }

  /** Programme la déconnexion automatique à l'échéance du token. */
  private armerExpiration(session: AuthSession): void {
    this.desarmerExpiration();
    const restant = new Date(session.expiration).getTime() - Date.now();
    const delai = Math.min(Math.max(restant, 0), DELAI_TIMER_MAX);

    this.timerExpiration = setTimeout(() => {
      // Le délai a pu être borné par le plafond : ré-armer si le token court encore.
      if (!this.estExpiree(session)) {
        this.armerExpiration(session);
        return;
      }
      this.logout();
      this._sessionExpiree.set(true);
    }, delai);
  }

  private desarmerExpiration(): void {
    if (this.timerExpiration === null) return;
    clearTimeout(this.timerExpiration);
    this.timerExpiration = null;
  }

  readonly role = computed<Role | null>(() => this._session()?.role ?? null);
  readonly email = computed(() => this._session()?.email ?? null);
  readonly personneId = computed<number | null>(() => this._session()?.personneId ?? null);
  readonly nom = computed(() => this._session()?.nom ?? null);

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, payload)
      .pipe(
        tap((res) =>
          this.setSession({
            token: res.token,
            expiration: res.expiration,
            role: res.role,
            personneId: res.id,
            nom: res.nom,
            email: res.email,
          }),
        ),
      );
  }

  /**
   * Premier accès : le compte a été créé par l'admin, son titulaire choisit son
   * mot de passe. Même corps que la réinitialisation, code valable 7 jours.
   */
  activerCompte(payload: ReinitialiserRequest): Observable<ReinitialiserResponse> {
    return this.http.post<ReinitialiserResponse>(`${this.base}/auth/activer`, payload);
  }

  /**
   * Demande l'envoi d'un code de réinitialisation par email.
   * Endpoint public : n'ouvre aucune session et répond toujours 200.
   */
  demanderCodeReinitialisation(
    payload: MotDePasseOublieRequest,
  ): Observable<MotDePasseOublieResponse> {
    return this.http.post<MotDePasseOublieResponse>(
      `${this.base}/auth/mot-de-passe-oublie`,
      payload,
    );
  }

  /**
   * Vérifie le code seul, avant de faire choisir un mot de passe.
   * Ne le consomme pas : il reste valable pour l'envoi final.
   */
  verifierCode(payload: VerifierCodeRequest): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/auth/verifier-code`, payload);
  }

  /** Définit un nouveau mot de passe à partir du code reçu par email. */
  reinitialiserMotDePasse(
    payload: ReinitialiserRequest,
  ): Observable<ReinitialiserResponse> {
    return this.http.post<ReinitialiserResponse>(
      `${this.base}/auth/reinitialiser`,
      payload,
    );
  }

  logout(): void {
    this.desarmerExpiration();
    this._sessionExpiree.set(false);
    this._session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    return this.isAuthenticated() ? this._session()!.token : null;
  }

  private setSession(session: AuthSession): void {
    this._sessionExpiree.set(false);
    this._session.set(session);
    this.armerExpiration(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* mode privé / quota : session en mémoire seulement */
    }
  }

  private read(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as AuthSession;
      // Session écrite avant l'enrichissement du login : incomplète, on repart d'un login propre.
      if (this.estExpiree(session) || typeof session.personneId !== 'number') {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }
}
