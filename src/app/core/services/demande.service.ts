import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiMessage, CreateDemande, Creneau, Demande, UpdateDemande } from '../models';

@Injectable({ providedIn: 'root' })
export class DemandeService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/demandes';

  getAll(): Observable<Demande[]> {
    return this.http.get<Demande[]>(this.base);
  }

  create(payload: CreateDemande): Observable<Demande> {
    return this.http.post<Demande>(this.base, payload);
  }

  get(id: number): Observable<Demande> {
    return this.http.get<Demande>(`${this.base}/${id}`);
  }

  getCreneauxDisponibles(id: number): Observable<Creneau[]> {
    return this.http.get<Creneau[]>(`${this.base}/${id}/creneaux-disponibles`);
  }

  /** Corrige le poste. Le candidat n'est pas modifiable côté API. */
  updatePoste(id: number, payload: UpdateDemande): Observable<Demande> {
    return this.http.put<Demande>(`${this.base}/${id}`, payload);
  }

  annuler(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/${id}/annuler`, {});
  }
}
