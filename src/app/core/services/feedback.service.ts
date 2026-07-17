import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import { CreateFeedback, Feedback } from '../models';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL) + '/feedbacks';

  getByEntretien(entretienId: number): Observable<Feedback[]> {
    const params = new HttpParams().set('entretienId', entretienId);
    return this.http.get<Feedback[]>(this.base, { params });
  }

  create(payload: CreateFeedback): Observable<Feedback> {
    return this.http.post<Feedback>(this.base, payload);
  }
}
