// Moteur du jeu de Belote - Logique des cartes et règles
import { Card, Suit, Rank, Trick } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];

/** Crée un jeu de 32 cartes */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}_${suit}`, suit, rank });
    }
  }
  return deck;
}

/** Mélange le jeu (Fisher-Yates) */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Distribue 8 cartes à chaque joueur */
export function dealCards(deck: Card[]): Card[][] {
  return [
    deck.slice(0, 8),
    deck.slice(8, 16),
    deck.slice(16, 24),
    deck.slice(24, 32),
  ];
}

/** Valeur en points d'une carte */
export function getCardValue(card: Card, trumpSuit: Suit | null): number {
  const isTrump = card.suit === trumpSuit;
  if (isTrump) {
    const trumpValues: Record<Rank, number> = {
      'jack': 20, '9': 14, 'ace': 11, '10': 10,
      'king': 4, 'queen': 3, '8': 0, '7': 0,
    };
    return trumpValues[card.rank];
  }
  const normalValues: Record<Rank, number> = {
    'ace': 11, '10': 10, 'king': 4, 'queen': 3,
    'jack': 2, '9': 0, '8': 0, '7': 0,
  };
  return normalValues[card.rank];
}

/** Force d'une carte pour déterminer le gagnant du pli */
export function getCardStrength(card: Card, trumpSuit: Suit | null, leadSuit: Suit): number {
  const trumpOrder: Rank[] = ['jack', '9', 'ace', '10', 'king', 'queen', '8', '7'];
  const normalOrder: Rank[] = ['ace', '10', 'king', 'queen', 'jack', '9', '8', '7'];

  if (card.suit === trumpSuit) {
    return 100 + (trumpOrder.length - trumpOrder.indexOf(card.rank));
  }
  if (card.suit === leadSuit) {
    return 50 + (normalOrder.length - normalOrder.indexOf(card.rank));
  }
  return 0;
}

/** Détermine le gagnant d'un pli */
export function determineTrickWinner(trick: Trick, trumpSuit: Suit): number {
  if (trick.cards.length === 0) return trick.leaderIndex;
  const leadSuit = trick.cards[0].card.suit;
  let maxStrength = 0;
  let winnerPlayerIndex = trick.cards[0].playerIndex;

  for (let i = 0; i < trick.cards.length; i++) {
    const strength = getCardStrength(trick.cards[i].card, trumpSuit, leadSuit);
    if (strength > maxStrength) {
      maxStrength = strength;
      winnerPlayerIndex = trick.cards[i].playerIndex;
    }
  }
  return winnerPlayerIndex;
}

/** Calcule les points d'une manche (avec 10-de-der) */
export function calculateRoundPoints(tricks: Trick[], trumpSuit: Suit): [number, number] {
  const points: [number, number] = [0, 0];

  for (let i = 0; i < tricks.length; i++) {
    const trick = tricks[i];
    const winnerIndex = determineTrickWinner(trick, trumpSuit);
    const team = (winnerIndex % 2) as 0 | 1;
    for (const play of trick.cards) {
      points[team] += getCardValue(play.card, trumpSuit);
    }
    // 10-de-der : bonus de 10 points pour le dernier pli
    if (i === tricks.length - 1) {
      points[team] += 10;
    }
  }
  return points;
}

/** Retourne les cartes jouables selon les règles */
export function getPlayableCards(
  hand: Card[],
  currentTrick: Trick,
  trumpSuit: Suit,
  playerIndex: number
): Card[] {
  // Premier joueur du pli : peut jouer n'importe quoi
  if (currentTrick.cards.length === 0) return hand;

  const leadSuit = currentTrick.cards[0].card.suit;
  const followCards = hand.filter(c => c.suit === leadSuit);
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const partnerWinning = isPartnerWinning(currentTrick, trumpSuit, playerIndex);

  // Peut suivre la couleur demandée
  if (followCards.length > 0) {
    if (leadSuit === trumpSuit) {
      const higherTrumps = getHigherTrumps(followCards, currentTrick, trumpSuit);
      return higherTrumps.length > 0 ? higherTrumps : followCards;
    }
    return followCards;
  }

  // Ne peut pas suivre — si le partenaire gagne, jouer n'importe quoi
  if (partnerWinning) return hand;

  // Doit couper (jouer atout) si possible
  if (trumpCards.length > 0) {
    const higherTrumps = getHigherTrumps(trumpCards, currentTrick, trumpSuit);
    return higherTrumps.length > 0 ? higherTrumps : trumpCards;
  }

  // Aucune contrainte
  return hand;
}

/** Vérifie si le partenaire gagne le pli en cours */
function isPartnerWinning(trick: Trick, trumpSuit: Suit, playerIndex: number): boolean {
  if (trick.cards.length === 0) return false;
  const leadSuit = trick.cards[0].card.suit;
  let maxStrength = 0;
  let currentWinnerIndex = trick.cards[0].playerIndex;

  for (const play of trick.cards) {
    const strength = getCardStrength(play.card, trumpSuit, leadSuit);
    if (strength > maxStrength) {
      maxStrength = strength;
      currentWinnerIndex = play.playerIndex;
    }
  }
  return (currentWinnerIndex % 2) === (playerIndex % 2);
}

/** Retourne les atouts plus forts que ceux déjà joués */
function getHigherTrumps(trumpCards: Card[], trick: Trick, trumpSuit: Suit): Card[] {
  const leadSuit = trick.cards[0].card.suit;
  let maxTrumpStrength = 0;
  for (const play of trick.cards) {
    if (play.card.suit === trumpSuit) {
      const strength = getCardStrength(play.card, trumpSuit, leadSuit);
      if (strength > maxTrumpStrength) maxTrumpStrength = strength;
    }
  }
  return trumpCards.filter(c =>
    getCardStrength(c, trumpSuit, trumpCards[0]?.suit || leadSuit) > maxTrumpStrength
  );
}

/** Vérifie si le joueur a la Belote-Rebelote (roi + dame d'atout) */
export function hasBeloteRebelote(hand: Card[], trumpSuit: Suit): boolean {
  const hasKing = hand.some(c => c.suit === trumpSuit && c.rank === 'king');
  const hasQueen = hand.some(c => c.suit === trumpSuit && c.rank === 'queen');
  return hasKing && hasQueen;
}
