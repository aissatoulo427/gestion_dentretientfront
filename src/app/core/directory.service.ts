import { Injectable, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Candidat, Demande, Employe, Role, ROLE_LABEL } from './models';
import { DemandeService } from './services/demande.service';
import { PersonneService } from './services/personne.service';

/**
 * Annuaire en cache : résout les identifiants (candidatId, rhId…) en libellés
 * lisibles (noms) pour éviter d'afficher des « #3 » bruts dans l'interface.
 * Les données sont chargées une fois et mises à jour à la demande.
 */
@Injectable({ providedIn: 'root' })
export class DirectoryService {
  private readonly personnes = inject(PersonneService);
  private readonly demandes = inject(DemandeService);

  private readonly candidatsMap = signal<Map<number, Candidat>>(new Map());
  private readonly rhMap = signal<Map<number, Employe>>(new Map());
  private readonly evaluateursTechniquesMap = signal<Map<number, Employe>>(new Map());
  private readonly managersMap = signal<Map<number, Employe>>(new Map());
  private readonly demandesMap = signal<Map<number, Demande>>(new Map());
  private loaded = false;

  constructor() {
    this.load();
  }

  /** Charge (ou recharge) les annuaires. */
  load(): void {
    forkJoin({
      candidats: this.personnes.getCandidats(),
      rh: this.personnes.getRh(),
      evaluateursTechniques: this.personnes.getEvaluateursTechniques(),
      managers: this.personnes.getManagers(),
    }).subscribe(({ candidats, rh, evaluateursTechniques, managers }) => {
      this.candidatsMap.set(new Map(candidats.map((c) => [c.id, c])));
      this.rhMap.set(new Map(rh.map((r) => [r.id, r])));
      this.evaluateursTechniquesMap.set(
        new Map(evaluateursTechniques.map((e) => [e.id, e])),
      );
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

  rh(id: number): Employe | undefined {
    return this.rhMap().get(id);
  }

  rhLabel(id: number): string {
    const r = this.rhMap().get(id);
    return r ? r.nom : `RH #${id}`;
  }

  /** Retrouve un employé quel que soit son rôle, et dit lequel. */
  employe(id: number): { employe: Employe; role: Role } | undefined {
    const rh = this.rhMap().get(id);
    if (rh) return { employe: rh, role: 'RH' };

    const technique = this.evaluateursTechniquesMap().get(id);
    if (technique) return { employe: technique, role: 'EvaluateurTechnique' };

    const manager = this.managersMap().get(id);
    if (manager) return { employe: manager, role: 'Manager' };

    return undefined;
  }

  demandeLabel(id: number): string {
    const d = this.demandesMap().get(id);
    return d ? d.poste : `Demande #${id}`;
  }

  /**
   * « Nom · Rôle » — pour les panels d'évaluateurs et les auteurs de comptes-rendus.
   * Le rôle est indispensable : sans lui, impossible de composer un panel valide.
   */
  employeLabel(id: number): string {
    const trouve = this.employe(id);
    return trouve ? `${trouve.employe.nom} · ${ROLE_LABEL[trouve.role]}` : `Employé #${id}`;
  }
}
