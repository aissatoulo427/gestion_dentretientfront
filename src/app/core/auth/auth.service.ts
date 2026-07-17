import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AuthSession,
  CreateRecruteurManager,
  LoginRequest,
  LoginResponse,
  RecruteurManager,
  Role,
} from '../models';

const STORAGE_KEY = 'ge_auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private readonly _session = signal<AuthSession | null>(this.read());
  readonly session = this._session.asReadonly();

  readonly isAuthenticated = computed(() => {
    const s = this._session();
    if (!s) return false;
    return new Date(s.expiration).getTime() > Date.now();
  });

  readonly role = computed<Role | null>(() => this._session()?.role ?? null);
  readonly email = computed(() => this._session()?.email ?? null);

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.base}/auth/login`, payload)
      .pipe(
        tap((res) =>
          this.setSession({
            token: res.token,
            expiration: res.expiration,
            role: res.role,
            email: payload.email,
          }),
        ),
      );
  }

  /** Inscription d'un compte staff (endpoint public). */
  registerRecruteur(payload: CreateRecruteurManager): Observable<RecruteurManager> {
    return this.http.post<RecruteurManager>(`${this.base}/personnes/recruteurs`, payload);
  }

  registerManager(payload: CreateRecruteurManager): Observable<RecruteurManager> {
    return this.http.post<RecruteurManager>(`${this.base}/personnes/managers`, payload);
  }

  logout(): void {
    this._session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  getToken(): string | null {
    return this.isAuthenticated() ? this._session()!.token : null;
  }

  private setSession(session: AuthSession): void {
    this._session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* mode privé / quota : session en mémoire seulement */
    }
  }

  private read(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  }
}
