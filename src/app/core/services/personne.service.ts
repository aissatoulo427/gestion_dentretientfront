import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  Candidat,
  CreateCandidat,
  CreateRecruteurManager,
  Personne,
  RecruteurManager,
} from '../models';

@Injectable({ providedIn: 'root' })
export class PersonneService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/personnes';

  getCandidats(): Observable<Candidat[]> {
    return this.http.get<Candidat[]>(`${this.base}/candidats`);
  }

  createCandidat(payload: CreateCandidat): Observable<Candidat> {
    return this.http.post<Candidat>(`${this.base}/candidats`, payload);
  }

  getRecruteurs(): Observable<RecruteurManager[]> {
    return this.http.get<RecruteurManager[]>(`${this.base}/recruteurs`);
  }

  createRecruteur(payload: CreateRecruteurManager): Observable<RecruteurManager> {
    return this.http.post<RecruteurManager>(`${this.base}/recruteurs`, payload);
  }

  getManagers(): Observable<RecruteurManager[]> {
    return this.http.get<RecruteurManager[]>(`${this.base}/managers`);
  }

  createManager(payload: CreateRecruteurManager): Observable<RecruteurManager> {
    return this.http.post<RecruteurManager>(`${this.base}/managers`, payload);
  }

  getPersonne(id: number): Observable<Personne> {
    return this.http.get<Personne>(`${this.base}/${id}`);
  }
}
