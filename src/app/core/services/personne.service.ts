import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  ApiMessage,
  Candidat,
  CreateCandidat,
  CreateEmploye,
  Employe,
  Personne,
  RoleEmploye,
  SEGMENT_ROLE,
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

  /** Remplace les quatre champs : renvoyer aussi ceux qu'on ne modifie pas. */
  updateCandidat(id: number, payload: CreateCandidat): Observable<Candidat> {
    return this.http.put<Candidat>(`${this.base}/candidats/${id}`, payload);
  }

  /** Refusé par l'API si le candidat porte déjà des demandes ou des entretiens. */
  deleteCandidat(id: number): Observable<ApiMessage> {
    return this.http.delete<ApiMessage>(`${this.base}/candidats/${id}`);
  }

  getRh(): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.base}/rh`);
  }

  getEvaluateursTechniques(): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.base}/evaluateurs-techniques`);
  }

  getManagers(): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.base}/managers`);
  }

  /** Liste les employés d'un rôle donné. */
  getEmployes(role: RoleEmploye): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.base}/${SEGMENT_ROLE[role]}`);
  }

  createEmploye(role: RoleEmploye, payload: CreateEmploye): Observable<Employe> {
    return this.http.post<Employe>(`${this.base}/${SEGMENT_ROLE[role]}`, payload);
  }

  getPersonne(id: number): Observable<Personne> {
    return this.http.get<Personne>(`${this.base}/${id}`);
  }
}
