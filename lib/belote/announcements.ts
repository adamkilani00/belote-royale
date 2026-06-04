// Annonces avancées : Tierce, Cinquante, Cent, Carré
import type { Card, Suit, Rank } from './types';

export type AnnouncementType = 'tierce' | 'cinquante' | 'cent' | 'carre';

export interface Announcement {
  type: AnnouncementType;
  cards: Card[];
  points: number;
  playerIndex: number;
  suit?: Suit;
}

const RANK_ORDER: Rank[] = ['7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];

function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** Détecte toutes les annonces possibles dans une main */
export function detectAnnouncements(hand: Card[], playerIndex: number, trumpSuit: Suit): Announcement[] {
  const announcements: Announcement[] = [];

  // 1. Carrés (4 cartes du même rang) — sauf les 7 et 8
  const rankGroups = new Map<Rank, Card[]>();
  for (const card of hand) {
    const group = rankGroups.get(card.rank) || [];
    group.push(card);
    rankGroups.set(card.rank, group);
  }
  
  for (const [rank, cards] of rankGroups) {
    if (cards.length === 4) {
      let points = 0;
      if (rank === 'jack') points = 200;
      else if (rank === '9') points = 150;
      else if (rank === 'ace' || rank === '10' || rank === 'king' || rank === 'queen') points = 100;
      // Les carrés de 7 et 8 ne comptent pas
      if (points > 0) {
        announcements.push({ type: 'carre', cards, points, playerIndex });
      }
    }
  }

  // 2. Suites (tierce=20, cinquante=50, cent=100)
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  for (const suit of suits) {
    const suitCards = hand.filter(c => c.suit === suit).sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));
    if (suitCards.length < 3) continue;

    // Trouver les suites consécutives
    let streakStart = 0;
    for (let i = 1; i <= suitCards.length; i++) {
      if (i === suitCards.length || rankIndex(suitCards[i].rank) !== rankIndex(suitCards[i - 1].rank) + 1) {
        const streakLength = i - streakStart;
        if (streakLength >= 3) {
          const streakCards = suitCards.slice(streakStart, i);
          let type: AnnouncementType;
          let points: number;

          if (streakLength >= 5) { type = 'cent'; points = 100; }
          else if (streakLength === 4) { type = 'cinquante'; points = 50; }
          else { type = 'tierce'; points = 20; }

          announcements.push({ type, cards: streakCards, points, playerIndex, suit });
        }
        streakStart = i;
      }
    }
  }

  return announcements;
}

/** Compare les annonces de deux équipes pour déterminer le gagnant */
export function resolveAnnouncements(
  team0Annonces: Announcement[],
  team1Annonces: Announcement[]
): { winningTeam: 0 | 1 | null; totalPoints: [number, number] } {
  // L'équipe avec la meilleure annonce remporte TOUTES ses annonces
  const best0 = getBestAnnouncement(team0Annonces);
  const best1 = getBestAnnouncement(team1Annonces);

  if (!best0 && !best1) return { winningTeam: null, totalPoints: [0, 0] };
  if (!best1) return { winningTeam: 0, totalPoints: [sumPoints(team0Annonces), 0] };
  if (!best0) return { winningTeam: 1, totalPoints: [0, sumPoints(team1Annonces)] };

  const compare = compareAnnouncements(best0, best1);
  if (compare > 0) return { winningTeam: 0, totalPoints: [sumPoints(team0Annonces), 0] };
  if (compare < 0) return { winningTeam: 1, totalPoints: [0, sumPoints(team1Annonces)] };

  // Égalité : l'équipe avec l'annonce dans la couleur d'atout gagne
  return { winningTeam: null, totalPoints: [0, 0] };
}

function getBestAnnouncement(annonces: Announcement[]): Announcement | null {
  if (annonces.length === 0) return null;
  return annonces.reduce((best, a) => a.points > best.points ? a : best, annonces[0]);
}

function compareAnnouncements(a: Announcement, b: Announcement): number {
  // Carré > suite
  if (a.type === 'carre' && b.type !== 'carre') return 1;
  if (b.type === 'carre' && a.type !== 'carre') return -1;
  // Plus de points gagne
  if (a.points !== b.points) return a.points - b.points;
  // À points égaux, la carte la plus haute gagne
  const highA = Math.max(...a.cards.map(c => rankIndex(c.rank)));
  const highB = Math.max(...b.cards.map(c => rankIndex(c.rank)));
  return highA - highB;
}

function sumPoints(annonces: Announcement[]): number {
  return annonces.reduce((sum, a) => sum + a.points, 0);
}
