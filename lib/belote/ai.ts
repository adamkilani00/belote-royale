// IA experte pour la Belote — Mémoire des cartes jouées et stratégie avancée
import type { Card, Suit, Trick, GameState } from './types';
import { getPlayableCards, getCardValue, getCardStrength, hasBeloteRebelote } from './engine';

/** Mémoire de l'IA : cartes jouées, déductions */
interface AIMemory {
  playedCards: Set<string>;
  knownVoids: Map<number, Set<Suit>>; // joueur -> couleurs qu'il n'a plus
  partnerHasShown: Map<Suit, boolean>;
  trumpsPlayed: Card[];
  pointsPerTeam: [number, number];
}

export function createAIMemory(): AIMemory {
  return {
    playedCards: new Set(),
    knownVoids: new Map([
      [0, new Set()], [1, new Set()], [2, new Set()], [3, new Set()],
    ]),
    partnerHasShown: new Map(),
    trumpsPlayed: [],
    pointsPerTeam: [0, 0],
  };
}

/** Met à jour la mémoire après un pli */
export function updateMemory(memory: AIMemory, trick: Trick, trumpSuit: Suit): void {
  const leadSuit = trick.cards[0]?.card.suit;

  for (const play of trick.cards) {
    memory.playedCards.add(play.card.id);
    if (play.card.suit === trumpSuit) {
      memory.trumpsPlayed.push(play.card);
    }
    // Déduction : si le joueur n'a pas suivi la couleur demandée
    if (leadSuit && play.card.suit !== leadSuit) {
      memory.knownVoids.get(play.playerIndex)?.add(leadSuit);
    }
  }
}

/** Choix de l'IA pour jouer une carte (stratégie experte) */
export function aiChooseCard(
  hand: Card[],
  currentTrick: Trick,
  trumpSuit: Suit,
  playerIndex: number,
  memory: AIMemory,
  gameState: GameState
): Card {
  const playable = getPlayableCards(hand, currentTrick, trumpSuit, playerIndex);
  if (playable.length === 1) return playable[0];

  const partner = (playerIndex + 2) % 4;
  const isLeading = currentTrick.cards.length === 0;
  const isLast = currentTrick.cards.length === 3;

  // Stratégie quand on mène le pli
  if (isLeading) {
    return aiLeadStrategy(playable, trumpSuit, memory, playerIndex);
  }

  // Stratégie quand on est le dernier à jouer
  if (isLast) {
    return aiLastStrategy(playable, currentTrick, trumpSuit, playerIndex, partner);
  }

  // Stratégie intermédiaire
  return aiMiddleStrategy(playable, currentTrick, trumpSuit, playerIndex, partner, memory);
}

/** Stratégie pour mener le pli */
function aiLeadStrategy(
  playable: Card[],
  trumpSuit: Suit,
  memory: AIMemory,
  _playerIndex: number
): Card {
  // Préférer jouer les as maîtres (couleurs non-atout)
  const nonTrumpAces = playable.filter(c => c.suit !== trumpSuit && c.rank === 'ace');
  const masterAces = nonTrumpAces.filter(c => !memory.playedCards.has(`ace_${c.suit}`));
  if (masterAces.length > 0) return masterAces[0];

  // Jouer une couleur longue (pour que le partenaire puisse couper)
  const suitCounts = new Map<Suit, number>();
  for (const c of playable) {
    if (c.suit !== trumpSuit) {
      suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
    }
  }

  // Jouer une carte haute dans notre couleur longue
  let longestSuit: Suit | null = null;
  let maxCount = 0;
  for (const [suit, count] of suitCounts) {
    if (count > maxCount) { maxCount = count; longestSuit = suit; }
  }

  if (longestSuit) {
    const suitCards = playable.filter(c => c.suit === longestSuit);
    // Jouer la carte la plus forte de la couleur longue
    suitCards.sort((a, b) => getCardValue(b, trumpSuit) - getCardValue(a, trumpSuit));
    return suitCards[0];
  }

  // En dernier recours, jouer un petit atout pour tirer les atouts adverses
  const trumpCards = playable.filter(c => c.suit === trumpSuit);
  if (trumpCards.length > 2) {
    // Jouer un petit atout
    trumpCards.sort((a, b) => getCardStrength(a, trumpSuit, trumpSuit) - getCardStrength(b, trumpSuit, trumpSuit));
    return trumpCards[0];
  }

  // Carte la moins valuable
  return getLowestValueCard(playable, trumpSuit);
}

/** Stratégie quand on joue en dernier */
function aiLastStrategy(
  playable: Card[],
  trick: Trick,
  trumpSuit: Suit,
  playerIndex: number,
  partner: number
): Card {
  const leadSuit = trick.cards[0].card.suit;
  
  // Calculer les points dans le pli
  const trickPoints = trick.cards.reduce((sum, p) => sum + getCardValue(p.card, trumpSuit), 0);
  
  // Vérifier si le partenaire gagne
  const currentWinner = getCurrentTrickWinner(trick, trumpSuit);
  const partnerWins = currentWinner === partner;

  if (partnerWins) {
    // Le partenaire gagne : jouer la carte la plus forte (maximiser les points)
    const followCards = playable.filter(c => c.suit === leadSuit);
    if (followCards.length > 0) {
      followCards.sort((a, b) => getCardValue(b, trumpSuit) - getCardValue(a, trumpSuit));
      return followCards[0]; // La carte avec le plus de points
    }
    // Sinon jouer la carte la plus riche
    playable.sort((a, b) => getCardValue(b, trumpSuit) - getCardValue(a, trumpSuit));
    return playable[0];
  }

  // L'adversaire gagne : essayer de prendre le pli
  if (trickPoints >= 10) {
    // Pli intéressant : jouer la carte la plus forte possible
    const winningCards = playable.filter(c => 
      getCardStrength(c, trumpSuit, leadSuit) > getCardStrength(trick.cards[currentWinner === trick.leaderIndex ? 0 : currentWinner]?.card || trick.cards[0].card, trumpSuit, leadSuit)
    );
    if (winningCards.length > 0) {
      // Jouer la plus petite carte gagnante
      winningCards.sort((a, b) => getCardStrength(a, trumpSuit, leadSuit) - getCardStrength(b, trumpSuit, leadSuit));
      return winningCards[0];
    }
  }

  // Ne peut pas gagner ou pli pas intéressant : jouer la carte la moins utile
  return getLowestValueCard(playable, trumpSuit);
}

/** Stratégie pour la position intermédiaire */
function aiMiddleStrategy(
  playable: Card[],
  trick: Trick,
  trumpSuit: Suit,
  playerIndex: number,
  partner: number,
  _memory: AIMemory
): Card {
  const leadSuit = trick.cards[0].card.suit;
  const currentWinner = getCurrentTrickWinner(trick, trumpSuit);
  const partnerWins = currentWinner === partner;

  if (partnerWins) {
    // Partenaire mène : jouer petit
    return getLowestValueCard(playable, trumpSuit);
  }

  // Essayer de gagner
  const winnable = playable.filter(c => {
    const maxStrength = Math.max(...trick.cards.map(p => getCardStrength(p.card, trumpSuit, leadSuit)));
    return getCardStrength(c, trumpSuit, leadSuit) > maxStrength;
  });

  if (winnable.length > 0) {
    // Jouer la plus petite carte gagnante
    winnable.sort((a, b) => getCardStrength(a, trumpSuit, leadSuit) - getCardStrength(b, trumpSuit, leadSuit));
    return winnable[0];
  }

  // Ne peut pas gagner
  return getLowestValueCard(playable, trumpSuit);
}

/** Retourne la carte avec la plus faible valeur */
function getLowestValueCard(cards: Card[], trumpSuit: Suit): Card {
  return cards.reduce((lowest, card) => 
    getCardValue(card, trumpSuit) < getCardValue(lowest, trumpSuit) ? card : lowest
  , cards[0]);
}

/** Détermine le gagnant actuel d'un pli en cours */
function getCurrentTrickWinner(trick: Trick, trumpSuit: Suit): number {
  if (trick.cards.length === 0) return trick.leaderIndex;
  const leadSuit = trick.cards[0].card.suit;
  let maxStrength = 0;
  let winner = trick.cards[0].playerIndex;

  for (const play of trick.cards) {
    const strength = getCardStrength(play.card, trumpSuit, leadSuit);
    if (strength > maxStrength) {
      maxStrength = strength;
      winner = play.playerIndex;
    }
  }
  return winner;
}

/** IA pour le choix d'enchère en mode Contrée */
export function aiChooseBid(
  hand: Card[],
  highestBid: { value: number; suit: Suit | null } | null,
  playerIndex: number
): { action: 'bid' | 'pass'; value?: number; suit?: Suit } {
  // Évaluer la force de la main pour chaque couleur d'atout
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  let bestSuit: Suit = 'hearts';
  let bestScore = 0;

  for (const suit of suits) {
    let score = 0;
    const trumpCards = hand.filter(c => c.suit === suit);
    // Valet d'atout = très fort
    if (trumpCards.some(c => c.rank === 'jack')) score += 30;
    if (trumpCards.some(c => c.rank === '9')) score += 20;
    if (trumpCards.some(c => c.rank === 'ace')) score += 14;
    // Longueur d'atout
    score += trumpCards.length * 5;
    // As dans les autres couleurs
    for (const c of hand) {
      if (c.suit !== suit && c.rank === 'ace') score += 10;
      if (c.suit !== suit && c.rank === '10') score += 5;
    }
    if (score > bestScore) { bestScore = score; bestSuit = suit; }
  }

  // Seuil pour enchérir
  const minBid = highestBid ? highestBid.value + 10 : 80;
  
  if (bestScore >= 60 && minBid <= 100) {
    return { action: 'bid', value: Math.min(minBid, 100), suit: bestSuit };
  }
  if (bestScore >= 80 && minBid <= 130) {
    return { action: 'bid', value: minBid, suit: bestSuit };
  }
  if (bestScore >= 100 && minBid <= 160) {
    return { action: 'bid', value: minBid, suit: bestSuit };
  }

  return { action: 'pass' };
}

/** IA pour le choix d'atout en mode Simple */
export function aiChooseTrump(
  hand: Card[],
  turnedCard: Card | null,
  phase: 'first_round' | 'second_round'
): { action: 'take' | 'pass'; suit?: Suit } {
  if (phase === 'first_round' && turnedCard) {
    const trumpCards = hand.filter(c => c.suit === turnedCard.suit);
    // Prendre si on a le valet + au moins 2 atouts ou 3+ atouts
    if (trumpCards.some(c => c.rank === 'jack') && trumpCards.length >= 2) {
      return { action: 'take' };
    }
    if (trumpCards.length >= 3 && trumpCards.some(c => c.rank === '9' || c.rank === 'ace')) {
      return { action: 'take' };
    }
    return { action: 'pass' };
  }

  // Deuxième tour : chercher la meilleure couleur
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const validSuits = turnedCard ? suits.filter(s => s !== turnedCard.suit) : suits;
  
  for (const suit of validSuits) {
    const trumpCards = hand.filter(c => c.suit === suit);
    if (trumpCards.some(c => c.rank === 'jack') && trumpCards.length >= 2) {
      return { action: 'take', suit };
    }
    if (trumpCards.length >= 3) {
      return { action: 'take', suit };
    }
  }

  return { action: 'pass' };
}
