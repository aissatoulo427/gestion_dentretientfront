import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { ApiMessage, CreateEntretien, Entretien, ReprogrammerEntretien } from '../models';

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

  confirmer(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/${id}/confirmer`, {});
  }

  reprogrammer(id: number, payload: ReprogrammerEntretien): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/${id}/reprogrammer`, payload);
  }

  rappel(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/${id}/rappel`, {});
  }
}
