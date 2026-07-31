import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '../core/api.config';
import { AuthService } from '../core/auth/auth.service';
import { NotificationService } from '../core/notification.service';
import { Shell } from './shell';

describe('Shell — expiration de session', () => {
  const base = 'http://test/api';
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: API_BASE_URL, useValue: base },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("prévient et redirige vers /login lorsque le token arrive à échéance", () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();

    const auth = TestBed.inject(AuthService);
    const notify = TestBed.inject(NotificationService);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 60_000).toISOString(),
      role: 'RH',
    });
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_001);
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/login']);
    expect(notify.toasts().some((t) => t.type === 'error')).toBe(true);
  });

  it('ne redirige pas tant que la session est valide', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();

    const auth = TestBed.inject(AuthService);
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);

    auth.login({ email: 'a@b.c', motDePasse: 'x' }).subscribe();
    httpMock.expectOne(`${base}/auth/login`).flush({
      token: 'jwt',
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      role: 'RH',
    });

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
  });
});
