// Types pour le jeu de Belote

// --- Types de base ---
export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '7' | '8' | '9' | '10' | 'jack' | 'queen' | 'king' | 'ace';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // ex: "7_spades"
}

// --- Modes et phases de jeu ---
export type GameMode = 'simple' | 'contree';
export type GamePhase = 'waiting' | 'dealing' | 'bidding' | 'trump_selection' | 'playing' | 'scoring' | 'finished';

// --- Joueur ---
export interface Player {
  id: string;
  name: string;
  position: 0 | 1 | 2 | 3;
  team: 0 | 1;
  hand: Card[];
  connected: boolean;
}

// --- Sélection d'atout (mode Simple) ---
export interface TrumpSelection {
  phase: 'first_round' | 'second_round' | 'done';
  currentPlayerIndex: number;
  turnedCard: Card | null;
  selectedSuit: Suit | null;
  takerPlayerIndex: number | null;
  passes: number;
}

// --- Enchères (mode Contrée) ---
export interface Bid {
  playerIndex: number;
  value: number; // 80-160 par pas de 10
  suit: Suit | null;
}

export interface BiddingState {
  bids: Bid[];
  currentPlayerIndex: number;
  highestBid: Bid | null;
  passes: number;
  isContred: boolean;
  isRecontred: boolean;
  contredBy: number | null;
  recontredBy: number | null;
  declarerIndex: number | null;
}

// --- Pli ---
export interface Trick {
  cards: { card: Card; playerIndex: number }[];
  leaderIndex: number;
  winnerIndex: number | null;
}

// --- Score de manche ---
export interface RoundScore {
  team0Points: number;
  team1Points: number;
  team0Total: number;
  team1Total: number;
  contractMet: boolean | null;
  beloteTeam: number | null;
}

// --- État de la partie ---
export interface GameState {
  id: string;
  mode: GameMode;
  phase: GamePhase;
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;
  trumpSuit: Suit | null;
  trumpSelection: TrumpSelection | null;
  biddingState: BiddingState | null;
  currentTrick: Trick | null;
  tricks: Trick[];
  roundScores: RoundScore[];
  totalScores: [number, number];
  targetScore: number;
  turnedCard: Card | null;
  lastTrickWinner: number | null;
  beloteAnnounced: { playerIndex: number; announced: ('belote' | 'rebelote')[] }[];
  roundNumber: number;
}

// --- Salon de jeu ---
export interface Room {
  id: string;
  code: string;
  name: string;
  mode: GameMode;
  isPrivate: boolean;
  creatorId: string;
  players: { id: string; name: string; ready: boolean }[];
  gameState: GameState | null;
  maxPlayers: 4;
  targetScore: number;
}
