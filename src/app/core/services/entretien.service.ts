import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CreateEntretien, Entretien, ReprogrammerEntretien } from '../models';

@Injectable({ providedIn: 'root' })
export class EntretienService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/entretiens';

  getAll(): Observable<Entretien[]> {
    return this.http.get<Entretien[]>(this.base);
  }

  get(id: number): Observable<Entretien> {
    return this.http.get<Entretien>(`${this.base}/${id}`);
  }

  planifier(payload: CreateEntretien): Observable<Entretien> {
    return this.http.post<Entretien>(this.base, payload);
  }

  confirmer(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/confirmer`, {});
  }

  reprogrammer(id: number, payload: ReprogrammerEntretien): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/reprogrammer`, payload);
  }

  rappel(id: number): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/rappel`, {});
  }
}
