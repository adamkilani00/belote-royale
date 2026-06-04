'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayingCard } from '@/components/belote/PlayingCard';
import { createDeck, shuffleDeck, dealCards, getPlayableCards, determineTrickWinner, getCardValue } from '@/lib/belote/engine';
import type { Card, Suit, Trick, GameMode } from '@/lib/belote/types';

const suitSymbols: Record<string, string> = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
const suitNames: Record<string, string> = { hearts: 'Cœur', diamonds: 'Carreau', spades: 'Pique', clubs: 'Trèfle' };

interface DemoState {
  phase: 'choose_mode' | 'playing' | 'finished';
  mode: GameMode;
  hands: Card[][];
  trumpSuit: Suit | null;
  currentPlayer: number;
  currentTrick: Trick;
  tricks: Trick[];
  scores: [number, number];
  message: string;
  hint: string;
  tutorialStep: number;
}

const TUTORIAL_STEPS = [
  'Bienvenue ! Tu es le joueur Sud. Ton partenaire est au Nord.',
  'Tu dois suivre la couleur demandée. Si tu ne peux pas, coupe à l\'atout.',
  'À l\'atout, tu dois monter si possible (jouer un atout plus fort).',
  'Si ton partenaire gagne le pli, tu n\'es pas obligé de couper.',
  'Le dernier pli vaut 10 points bonus (10 de der).',
  'Le Valet d\'atout vaut 20 pts, le 9 d\'atout vaut 14 pts !',
];

export default function DemoPage() {
  const router = useRouter();
  const [state, setState] = useState<DemoState>({
    phase: 'choose_mode',
    mode: 'simple',
    hands: [[], [], [], []],
    trumpSuit: null,
    currentPlayer: 0,
    currentTrick: { cards: [], leaderIndex: 0, winnerIndex: null },
    tricks: [],
    scores: [0, 0],
    message: '',
    hint: '',
    tutorialStep: 0,
  });

  const startDemo = (mode: GameMode) => {
    const deck = shuffleDeck(createDeck());
    const hands = dealCards(deck);
    // Choisir un atout simple pour la démo
    const trumpSuit: Suit = 'spades';

    setState({
      phase: 'playing',
      mode,
      hands,
      trumpSuit,
      currentPlayer: 0,
      currentTrick: { cards: [], leaderIndex: 0, winnerIndex: null },
      tricks: [],
      scores: [0, 0],
      message: TUTORIAL_STEPS[0],
      hint: `L'atout est ${suitSymbols[trumpSuit]} ${suitNames[trumpSuit]}. Clique sur une carte en surbrillance pour jouer.`,
      tutorialStep: 0,
    });
  };

  const playCard = useCallback((cardId: string) => {
    setState(prev => {
      if (prev.currentPlayer !== 0 || prev.phase !== 'playing' || !prev.trumpSuit) return prev;
      const card = prev.hands[0].find(c => c.id === cardId);
      if (!card) return prev;

      const playable = getPlayableCards(prev.hands[0], prev.currentTrick, prev.trumpSuit, 0);
      if (!playable.find(c => c.id === cardId)) return prev;

      const newHands = prev.hands.map(h => [...h]);
      newHands[0] = newHands[0].filter(c => c.id !== cardId);

      const newTrick: Trick = {
        ...prev.currentTrick,
        cards: [...prev.currentTrick.cards, { card, playerIndex: 0 }],
      };

      const nextStep = Math.min(prev.tutorialStep + 1, TUTORIAL_STEPS.length - 1);

      return {
        ...prev,
        hands: newHands,
        currentTrick: newTrick,
        currentPlayer: 1,
        message: TUTORIAL_STEPS[nextStep],
        hint: 'Les bots jouent...',
        tutorialStep: nextStep,
      };
    });
  }, []);

  // Bot play logic
  useEffect(() => {
    if (state.currentPlayer === 0 || state.phase !== 'playing') return;
    if (state.currentTrick.cards.length >= 4) return;

    const timer = setTimeout(() => {
      setState(prev => {
        const player = prev.currentPlayer;
        if (!prev.trumpSuit || player === 0) return prev;

        const hand = prev.hands[player];
        if (hand.length === 0) return prev;

        const playable = getPlayableCards(hand, prev.currentTrick, prev.trumpSuit, player);
        if (playable.length === 0) return prev;
        const card = playable[Math.floor(Math.random() * playable.length)];

        const newHands = prev.hands.map(h => [...h]);
        newHands[player] = newHands[player].filter(c => c.id !== card.id);

        const newTrick: Trick = {
          ...prev.currentTrick,
          cards: [...prev.currentTrick.cards, { card, playerIndex: player }],
        };

        const nextPlayer = (player + 1) % 4;
        const trickComplete = newTrick.cards.length === 4;

        if (trickComplete) {
          const winner = determineTrickWinner(newTrick, prev.trumpSuit!);
          const trickPoints = newTrick.cards.reduce((sum, p) => sum + getCardValue(p.card, prev.trumpSuit!), 0);
          const newScores: [number, number] = [...prev.scores];
          newScores[winner % 2 as 0 | 1] += trickPoints;

          const newTricks = [...prev.tricks, { ...newTrick, winnerIndex: winner }];

          if (newTricks.length === 8) {
            newScores[winner % 2 as 0 | 1] += 10;
            return {
              ...prev, hands: newHands, currentTrick: newTrick, tricks: newTricks,
              scores: newScores, currentPlayer: 0, phase: 'finished' as const,
              message: `Partie terminée ! Nous: ${newScores[0]} — Eux: ${newScores[1]}`,
              hint: newScores[0] > newScores[1] ? 'Victoire ! Bien joué.' : 'Défaite, retente ta chance !',
            };
          }

          return {
            ...prev, hands: newHands,
            currentTrick: { cards: [], leaderIndex: winner, winnerIndex: null },
            tricks: newTricks, scores: newScores, currentPlayer: winner,
            message: `Pli gagné par ${winner === 0 ? 'toi' : winner === 2 ? 'ton partenaire' : 'l\'adversaire'} (+${trickPoints} pts)`,
            hint: winner === 0 ? 'C\'est à toi !' : '',
          };
        }

        return { ...prev, hands: newHands, currentTrick: newTrick, currentPlayer: nextPlayer };
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [state.currentPlayer, state.currentTrick.cards.length, state.phase]);

  const playableCards = state.phase === 'playing' && state.currentPlayer === 0 && state.trumpSuit
    ? getPlayableCards(state.hands[0], state.currentTrick, state.trumpSuit, 0).map(c => c.id)
    : [];

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,212,255,0.1)] bg-[#0a0d14]/80 backdrop-blur z-20 relative">
        <div className="flex items-center gap-3">
          <span className="text-[#00D4FF]">📖</span>
          <h1 className="text-lg font-bold text-white">Mode Tutoriel</h1>
        </div>
        <button onClick={() => router.push('/lobby')} className="px-4 py-2 rounded-lg border border-[rgba(0,212,255,0.15)] text-[#6b7f8a] hover:text-white hover:border-[rgba(0,212,255,0.3)] transition-all text-sm">
          ← Retour
        </button>
      </div>

      {/* Mode selection */}
      {state.phase === 'choose_mode' && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="premium-card rounded-2xl p-8 text-center max-w-lg">
            <h2 className="text-2xl font-bold text-white mb-2">Apprends la Belote</h2>
            <p className="text-[#6b7f8a] mb-6">Joue contre des bots avec des conseils à chaque étape</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => startDemo('simple')} className="premium-card p-5 rounded-xl text-left hover:border-[rgba(0,212,255,0.4)] transition-all">
                <p className="text-2xl mb-2">♠</p>
                <p className="text-white font-semibold">Belote Simple</p>
                <p className="text-[#6b7f8a] text-xs mt-1">Choix d&apos;atout classique</p>
              </button>
              <button onClick={() => startDemo('contree')} className="premium-card p-5 rounded-xl text-left hover:border-[rgba(0,212,255,0.4)] transition-all">
                <p className="text-2xl mb-2">♦</p>
                <p className="text-white font-semibold">Belote Contrée</p>
                <p className="text-[#6b7f8a] text-xs mt-1">Avec enchères</p>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Game area */}
      {state.phase !== 'choose_mode' && (
        <div className="flex-1 flex">
          {/* Table */}
          <div className="flex-1 relative">
            <div className="absolute inset-4 felt-table rounded-2xl overflow-hidden">
              {/* Trump indicator */}
              {state.trumpSuit && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0a0d14]/80 backdrop-blur px-4 py-2 rounded-full text-sm border border-[rgba(0,212,255,0.15)]">
                  <span className="text-[#6b7f8a]">Atout : </span>
                  <span className="text-white font-bold">{suitSymbols[state.trumpSuit]} {suitNames[state.trumpSuit]}</span>
                </div>
              )}

              {/* Bot hands */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-0.5">
                {state.hands[2].map((_, i) => <PlayingCard key={i} card={{ id: 'h', suit: 'spades', rank: '7' }} faceDown small />)}
              </div>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                {state.hands[1].map((_, i) => <PlayingCard key={i} card={{ id: 'h', suit: 'spades', rank: '7' }} faceDown mini />)}
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                {state.hands[3].map((_, i) => <PlayingCard key={i} card={{ id: 'h', suit: 'spades', rank: '7' }} faceDown mini />)}
              </div>

              {/* Trick center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex gap-2">
                  <AnimatePresence>
                    {state.currentTrick.cards.map((play) => (
                      <motion.div key={play.card.id} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
                        <PlayingCard card={play.card} small />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* My hand */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-0.5">
                {state.hands[0].map(card => (
                  <PlayingCard key={card.id} card={card} playable={playableCards.includes(card.id)} onClick={() => playCard(card.id)} />
                ))}
              </div>

              {/* Score */}
              <div className="absolute top-4 right-4 bg-[#0a0d14]/80 backdrop-blur rounded-xl px-3 py-2 border border-[rgba(0,212,255,0.15)] text-xs font-mono">
                <p className="text-[#6b7f8a]">Nous: <span className="text-[#00D4FF] font-bold">{state.scores[0]}</span></p>
                <p className="text-[#6b7f8a]">Eux: <span className="text-white/60 font-bold">{state.scores[1]}</span></p>
                <p className="text-[#6b7f8a] mt-1 border-t border-[rgba(0,212,255,0.1)] pt-1">Plis: {state.tricks.length}/8</p>
              </div>
            </div>
          </div>

          {/* Tutorial sidebar */}
          <div className="w-72 bg-[#0a0d14] border-l border-[rgba(0,212,255,0.1)] p-4 flex flex-col">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-[#00D4FF]">💡</span> Guide
            </h3>

            <div className="bg-[#00D4FF]/5 border border-[#00D4FF]/20 rounded-xl p-3 mb-3">
              <p className="text-sm text-white/90 leading-relaxed">{state.message}</p>
            </div>

            {state.hint && (
              <div className="bg-[#00FFB2]/5 border border-[#00FFB2]/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#00FFB2]/80">{state.hint}</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto text-xs text-[#6b7f8a] space-y-2 border-t border-[rgba(0,212,255,0.1)] pt-3">
              <p className="font-mono text-[10px] text-[#00D4FF]/60 uppercase tracking-wider mb-2">Règles</p>
              <p>• Suivre la couleur demandée</p>
              <p>• Si impossible, couper à l&apos;atout</p>
              <p>• Obligation de monter à l&apos;atout</p>
              <p>• Partenaire maître = pas obligé de couper</p>
              <p>• Dernier pli = +10 pts</p>
              <p className="border-t border-[rgba(0,212,255,0.08)] pt-2 mt-2">• Atout: V=20, 9=14, A=11, 10=10</p>
              <p>• Normal: A=11, 10=10, R=4, D=3, V=2</p>
            </div>

            {state.phase === 'finished' && (
              <button onClick={() => setState(prev => ({ ...prev, phase: 'choose_mode' }))} className="mt-4 btn-glow rounded-xl py-2.5 text-sm font-bold w-full">
                Rejouer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
