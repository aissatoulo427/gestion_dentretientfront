import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CreateDemande, Creneau, Demande } from '../models';

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

  annuler(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/annuler`, {});
  }
}
