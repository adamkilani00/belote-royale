import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Room, GameState, Card } from '@/lib/belote/types';

interface BeloteStore {
  // State
  playerId: string | null;
  playerName: string | null;
  currentRoom: Room | null;
  gameState: GameState | null;
  myHand: Card[];
  playableCards: string[];
  isMyTurn: boolean;
  myPosition: number | null;
  error: string | null;
  connected: boolean;

  // Actions
  setPlayerName: (name: string) => void;
  loadFromSession: () => void;
  setRoom: (room: Room | null) => void;
  setGameState: (state: GameState | null) => void;
  setMyHand: (hand: Card[]) => void;
  setPlayableCards: (cards: string[]) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

const initialState = {
  playerId: null,
  playerName: null,
  currentRoom: null,
  gameState: null,
  myHand: [],
  playableCards: [],
  isMyTurn: false,
  myPosition: null,
  error: null,
  connected: false,
};

export const useGameStore = create<BeloteStore>()(
  persist(
    (set) => ({
      ...initialState,

      setPlayerName: (name: string) => {
        const id = crypto.randomUUID();
        set({ playerId: id, playerName: name });
      },

      loadFromSession: () => {
        // Already loaded from localStorage via persist
      },

      setRoom: (room) => set({ currentRoom: room }),

      setGameState: (state) => {
        if (!state) return set({ gameState: null, isMyTurn: false, myPosition: null });
        const playerId = useGameStore.getState().playerId;
        const myPosition = state.players.findIndex((p) => p.id === playerId);
        const isMyTurn = state.currentPlayerIndex === myPosition;
        set({ gameState: state, isMyTurn, myPosition: myPosition >= 0 ? myPosition : null });
      },

      setMyHand: (hand) => set({ myHand: hand }),
      setPlayableCards: (cards) => set({ playableCards: cards }),
      setError: (error) => set({ error }),
      setConnected: (connected) => set({ connected }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'belote-store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : sessionStorage)),
      partialize: (state) => ({
        playerId: state.playerId,
        playerName: state.playerName,
      }),
    }
  )
);
