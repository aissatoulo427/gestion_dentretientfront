import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Candidat, Demande, RecruteurManager } from './models';
import { DemandeService } from './services/demande.service';
import { PersonneService } from './services/personne.service';

/**
 * Annuaire en cache : résout les identifiants (candidatId, recruteurId…) en libellés
 * lisibles (noms) pour éviter d'afficher des « #3 » bruts dans l'interface.
 * Les données sont chargées une fois et mises à jour à la demande.
 */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly personnes = inject(PersonneService);
  private readonly demandes = inject(DemandeService);

  private readonly candidatsMap = signal<Map<number, Candidat>>(new Map());
  private readonly recruteursMap = signal<Map<number, RecruteurManager>>(new Map());
  private readonly managersMap = signal<Map<number, RecruteurManager>>(new Map());
  private readonly demandesMap = signal<Map<number, Demande>>(new Map());
  private loaded = false;

  constructor() {
    this.load();
  }

  /** Charge (ou recharge) les annuaires. */
  load(): void {
    forkJoin({
      candidats: this.personnes.getCandidats(),
      recruteurs: this.personnes.getRecruteurs(),
      managers: this.personnes.getManagers(),
    }).subscribe(({ candidats, recruteurs, managers }) => {
      this.candidatsMap.set(new Map(candidats.map((c) => [c.id, c])));
      this.recruteursMap.set(new Map(recruteurs.map((r) => [r.id, r])));
      this.managersMap.set(new Map(managers.map((m) => [m.id, m])));
      this.loaded = true;
    });
    // Demandes chargées à part : une erreur ici ne doit pas casser la résolution des noms.
    this.demandes.getAll().subscribe({
      next: (demandes) => this.demandesMap.set(new Map(demandes.map((d) => [d.id, d]))),
      error: () => {},
    });
  }

  ensureLoaded(): void {
    if (!this.loaded) this.load();
  }

  candidat(id: number): Candidat | undefined {
    return this.candidatsMap().get(id);
  }

  candidatLabel(id: number): string {
    const c = this.candidatsMap().get(id);
    return c ? `${c.prenom} ${c.nom}`.trim() : `Candidat #${id}`;
  }

  recruteur(id: number): RecruteurManager | undefined {
    return this.recruteursMap().get(id);
  }

  recruteurLabel(id: number): string {
    const r = this.recruteursMap().get(id);
    return r ? r.nom : `Recruteur #${id}`;
  }

  demandeLabel(id: number): string {
    const d = this.demandesMap().get(id);
    return d ? d.poste : `Demande #${id}`;
  }

  /** Un auteur de feedback est un recruteur OU un manager. */
  auteurLabel(id: number): string {
    const r = this.recruteursMap().get(id);
    if (r) return `${r.nom} · Recruteur`;
    const m = this.managersMap().get(id);
    if (m) return `${m.nom} · Manager`;
    return `Auteur #${id}`;
  }
}
