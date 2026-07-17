import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CreateCreneau, Creneau } from '../models';

@Injectable({ providedIn: 'root' })
export class CreneauService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/creneaux';

  getAll(): Observable<Creneau[]> {
    return this.http.get<Creneau[]>(this.base);
  }

  create(payload: CreateCreneau): Observable<Creneau> {
    return this.http.post<Creneau>(this.base, payload);
  }

  /** Rattache le créneau à une demande. POST /creneaux/{id}/proposer?demandeId={demandeId} -> 204 */
  proposer(id: number, demandeId: number): Observable<void> {
    const params = new HttpParams().set('demandeId', demandeId);
    return this.http.post<void>(`${this.base}/${id}/proposer`, {}, { params });
  }
}
