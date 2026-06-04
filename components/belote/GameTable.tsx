'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, Card, Suit } from '@/lib/belote/types';
import { PlayingCard } from './PlayingCard';
import { useState } from 'react';

const suitSymbols: Record<string, string> = {
  hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣',
};
const suitNames: Record<string, string> = {
  hearts: 'Cœur', diamonds: 'Carreau', spades: 'Pique', clubs: 'Trèfle',
};

interface GameTableProps {
  gameState: GameState;
  myPosition: number;
  myHand: Card[];
  playableCards: string[];
  onPlayCard: (cardId: string) => void;
  onTrumpAction: (action: 'take' | 'pass', suit?: Suit) => void;
  onBidAction: (action: 'bid' | 'pass' | 'contre' | 'surcontre', value?: number, suit?: Suit) => void;
  onLeave: () => void;
  announcements?: { type: string; playerIndex: number; points: number }[];
}

export function GameTable({ gameState, myPosition, myHand, playableCards, onPlayCard, onTrumpAction, onBidAction, onLeave, announcements }: GameTableProps) {
  const [showScore, setShowScore] = useState(false);

  const getPlayerByRelPos = (relPos: string) => {
    const positions = ['south', 'west', 'north', 'east'];
    const diff = positions.indexOf(relPos);
    const absPos = (myPosition + diff) % 4;
    return gameState.players[absPos];
  };

  const northPlayer = getPlayerByRelPos('north');
  const westPlayer = getPlayerByRelPos('west');
  const eastPlayer = getPlayerByRelPos('east');
  const myPlayer = gameState.players[myPosition];

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden bg-[#050508]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 z-30 relative bg-[#050508]/90 backdrop-blur border-b border-[rgba(0,212,255,0.08)]">
        <button
          onClick={onLeave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgba(0,212,255,0.15)] text-[#6b7f8a] text-xs bg-[#0a0d14]/80"
        >
          ← Quitter
        </button>
        <ContractBadgeInline gameState={gameState} />
        <button
          onClick={() => setShowScore(s => !s)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[rgba(0,212,255,0.15)] text-[#00D4FF] text-xs bg-[#0a0d14]/80"
        >
          Score
        </button>
      </div>

      {/* Score overlay (mobile) */}
      <AnimatePresence>
        {showScore && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 left-0 right-0 z-50 bg-[#0a0d14]/98 border-b border-[rgba(0,212,255,0.15)] p-4"
          >
            <ScoreContent gameState={gameState} myPosition={myPosition} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main game area — fills remaining height */}
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-2 felt-table rounded-2xl overflow-hidden">

          {/* North player */}
          <PlayerSlot player={northPlayer} position="north" isActive={gameState.currentPlayerIndex === northPlayer?.position} cardCount={northPlayer?.hand.length || 0} />

          {/* West player */}
          <PlayerSlot player={westPlayer} position="west" isActive={gameState.currentPlayerIndex === westPlayer?.position} cardCount={westPlayer?.hand.length || 0} />

          {/* East player */}
          <PlayerSlot player={eastPlayer} position="east" isActive={gameState.currentPlayerIndex === eastPlayer?.position} cardCount={eastPlayer?.hand.length || 0} />

          {/* Center trick */}
          <div className="absolute inset-0 flex items-center justify-center">
            <TrickDisplay gameState={gameState} myPosition={myPosition} />
          </div>

          {/* Trump selection */}
          {gameState.phase === 'trump_selection' && gameState.currentPlayerIndex === myPosition && (
            <TrumpSelectionPanel gameState={gameState} onAction={onTrumpAction} />
          )}

          {/* Bidding */}
          {gameState.phase === 'bidding' && gameState.currentPlayerIndex === myPosition && (
            <BiddingPanel gameState={gameState} onAction={onBidAction} />
          )}
          {gameState.phase === 'bidding' && gameState.currentPlayerIndex !== myPosition && (
            <BiddingInfo gameState={gameState} />
          )}

          {/* My hand at bottom */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end z-10" style={{ gap: myHand.length > 6 ? '0px' : '2px' }}>
            {/* My avatar */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-[10px] ${gameState.currentPlayerIndex === myPosition ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-[#00D4FF] active-player-glow' : 'bg-[#0d1520] border-[#00D4FF]/30 text-[#6b7f8a]'}`}>
                {myPlayer?.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
            {myHand.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  transform: `rotate(${(i - myHand.length / 2) * (myHand.length > 6 ? 3 : 2)}deg)`,
                  marginLeft: myHand.length > 6 ? '-6px' : '0',
                }}
              >
                <PlayingCard
                  card={card}
                  playable={playableCards.includes(card.id)}
                  onClick={() => onPlayCard(card.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerSlot({ player, position, isActive, cardCount }: {
  player: GameState['players'][0] | undefined;
  position: 'north' | 'south' | 'west' | 'east';
  isActive: boolean;
  cardCount: number;
}) {
  if (!player) return null;
  const initials = player.name.slice(0, 2).toUpperCase();

  const posStyles: Record<string, string> = {
    north: 'top-2 left-1/2 -translate-x-1/2 flex-col items-center',
    west: 'left-1 top-1/2 -translate-y-1/2 flex-col items-center',
    east: 'right-1 top-1/2 -translate-y-1/2 flex-col items-center',
    south: 'hidden',
  };
  const cardLayout: Record<string, string> = {
    north: 'flex-row gap-0.5',
    west: 'flex-col gap-0.5',
    east: 'flex-col gap-0.5',
    south: 'flex-row gap-0.5',
  };

  return (
    <div className={`absolute ${posStyles[position]} flex z-10`}>
      <div className="flex items-center gap-1 mb-1">
        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center font-bold text-[9px] sm:text-xs ${isActive ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-[#00D4FF] active-player-glow' : 'bg-[#0d1520] border-[rgba(0,212,255,0.2)] text-[#6b7f8a]'}`}>
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-white text-xs font-medium">{player.name}</p>
        </div>
      </div>
      <div className={`flex ${cardLayout[position]}`}>
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
          <PlayingCard key={i} card={{ id: 'h', suit: 'spades', rank: '7' }} faceDown mini />
        ))}
      </div>
    </div>
  );
}

function TrickDisplay({ gameState, myPosition }: { gameState: GameState; myPosition: number }) {
  const trick = gameState.currentTrick;
  if (!trick || trick.cards.length === 0) {
    if (gameState.trumpSuit) {
      return (
        <div className="flex flex-col items-center gap-1 opacity-40">
          <span className={`text-3xl sm:text-4xl ${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
            {suitSymbols[gameState.trumpSuit]}
          </span>
          <span className="text-[9px] font-mono text-[#6b7f8a] uppercase">Atout</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative w-32 h-32 sm:w-44 sm:h-44">
      <AnimatePresence>
        {trick.cards.map((play) => {
          const relDiff = (play.playerIndex - myPosition + 4) % 4;
          const offsets = [
            { x: 0, y: 25 },
            { x: -25, y: 0 },
            { x: 0, y: -25 },
            { x: 25, y: 0 },
          ];
          const off = offsets[relDiff];
          return (
            <motion.div
              key={play.card.id}
              initial={{ opacity: 0, scale: 0.5, x: off.x * 2, y: off.y * 2 }}
              animate={{ opacity: 1, scale: 1, x: off.x, y: off.y }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <PlayingCard card={play.card} small />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ContractBadgeInline({ gameState }: { gameState: GameState }) {
  const bs = gameState.biddingState;
  const contract = bs?.highestBid;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-[#00D4FF]/50 uppercase">Contrat:</span>
      {contract ? (
        <span className="text-xs font-bold text-white">
          <span className={contract.suit === 'hearts' || contract.suit === 'diamonds' ? 'text-red-400' : 'text-white'}>
            {suitSymbols[contract.suit || '']}
          </span>{' '}
          <span className="text-[#00D4FF]">{contract.value}</span>
          {bs?.isContred && <span className="text-red-400">×2</span>}
        </span>
      ) : (
        <span className="text-xs text-[#6b7f8a]">—</span>
      )}
    </div>
  );
}

function TrumpSelectionPanel({ gameState, onAction }: { gameState: GameState; onAction: (a: 'take' | 'pass', suit?: Suit) => void }) {
  const ts = gameState.trumpSelection;
  if (!ts) return null;
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const turnedSuit = ts.turnedCard?.suit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-20 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/98 backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-2xl p-4 w-[90vw] sm:w-[420px] max-w-sm shadow-[0_0_40px_rgba(0,212,255,0.1)]"
    >
      {ts.phase === 'first_round' ? (
        <>
          <p className="text-[9px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">1er tour</p>
          <p className="text-white font-semibold text-sm mb-3">
            Carte : <span className={`text-lg ${turnedSuit === 'hearts' || turnedSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>{suitSymbols[turnedSuit || '']}</span> — Prendre ?
          </p>
          <div className="flex gap-2">
            <button onClick={() => onAction('take')} className="flex-1 btn-glow rounded-xl py-2.5 text-sm font-bold">
              Prendre {suitSymbols[turnedSuit || '']}
            </button>
            <button onClick={() => onAction('pass')} className="flex-1 py-2.5 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] text-sm">
              Passer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[9px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">2ème tour</p>
          <p className="text-white/80 text-xs mb-3">Choisissez (sauf {suitSymbols[turnedSuit || '']})</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {suits.filter(s => s !== turnedSuit).map(s => (
              <button key={s} onClick={() => onAction('take', s)} className="py-2.5 rounded-xl border border-[rgba(0,212,255,0.15)] hover:border-[#00D4FF]/50 flex flex-col items-center gap-1">
                <span className={`text-xl ${s === 'hearts' || s === 'diamonds' ? 'text-red-400' : 'text-white'}`}>{suitSymbols[s]}</span>
                <span className="text-[9px] text-[#6b7f8a]">{suitNames[s]}</span>
              </button>
            ))}
          </div>
          <button onClick={() => onAction('pass')} className="w-full py-2 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] text-sm">
            Passer
          </button>
        </>
      )}
    </motion.div>
  );
}

function BiddingPanel({ gameState, onAction }: { gameState: GameState; onAction: (a: 'bid' | 'pass' | 'contre' | 'surcontre', value?: number, suit?: Suit) => void }) {
  const bs = gameState.biddingState;
  if (!bs) return null;
  const [selectedValue, setSelectedValue] = useState(bs.highestBid ? bs.highestBid.value + 10 : 80);
  const [selectedSuit, setSelectedSuit] = useState<Suit>('spades');
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
  const values = [80, 90, 100, 110, 120, 130, 140, 150, 160];
  const minBid = bs.highestBid ? bs.highestBid.value + 10 : 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-20 sm:bottom-28 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/98 backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-2xl p-4 w-[92vw] sm:w-[500px] max-w-sm shadow-[0_0_40px_rgba(0,212,255,0.1)]"
    >
      <p className="text-[9px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">Enchères Contrée</p>
      <p className="text-white font-semibold text-sm mb-1">À toi d&apos;annoncer</p>
      <p className="text-[#6b7f8a] text-xs mb-3">
        {bs.highestBid ? `En cours : ${bs.highestBid.value} ${suitSymbols[bs.highestBid.suit || '']}` : 'Mise min : 80'}
      </p>

      {/* Valeurs */}
      <div className="mb-2">
        <p className="text-[9px] font-mono text-[#6b7f8a] uppercase mb-1">Valeur</p>
        <div className="flex flex-wrap gap-1">
          {values.filter(v => v >= minBid).map(v => (
            <button key={v} onClick={() => setSelectedValue(v)} className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${selectedValue === v ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]' : 'border-[rgba(0,212,255,0.1)] text-[#6b7f8a]'}`}>
              {v}
            </button>
          ))}
          <button onClick={() => setSelectedValue(160)} className={`px-2.5 py-1 rounded-lg border text-xs font-mono ${selectedValue === 160 ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-[rgba(0,212,255,0.1)] text-[#6b7f8a]'}`}>
            Capot
          </button>
        </div>
      </div>

      {/* Couleurs */}
      <div className="mb-3">
        <p className="text-[9px] font-mono text-[#6b7f8a] uppercase mb-1">Atout</p>
        <div className="grid grid-cols-4 gap-1">
          {suits.map(s => (
            <button key={s} onClick={() => setSelectedSuit(s)} className={`flex flex-col items-center py-1.5 rounded-lg border text-xs transition-all ${selectedSuit === s ? 'border-[#00D4FF] bg-[#00D4FF]/10' : 'border-[rgba(0,212,255,0.1)]'}`}>
              <span className={s === 'hearts' || s === 'diamonds' ? 'text-red-400' : 'text-white'}>{suitSymbols[s]}</span>
              <span className="text-[8px] text-[#6b7f8a]">{suitNames[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => onAction('bid', selectedValue, selectedSuit)} className="btn-glow rounded-xl px-3 py-2 text-xs font-bold flex-1">
          {selectedValue} {suitSymbols[selectedSuit]}
        </button>
        <button onClick={() => onAction('pass')} className="px-3 py-2 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] text-xs">
          Passer
        </button>
        {bs.highestBid && !bs.isContred && bs.highestBid.playerIndex % 2 !== gameState.currentPlayerIndex % 2 && (
          <button onClick={() => onAction('contre')} className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs">
            Contre ×2
          </button>
        )}
        {bs.isContred && !bs.isRecontred && bs.highestBid && bs.highestBid.playerIndex % 2 === gameState.currentPlayerIndex % 2 && (
          <button onClick={() => onAction('surcontre')} className="px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs">
            ×4
          </button>
        )}
      </div>
    </motion.div>
  );
}

function BiddingInfo({ gameState }: { gameState: GameState }) {
  const bs = gameState.biddingState;
  if (!bs) return null;
  const currentPlayer = gameState.players[bs.currentPlayerIndex];
  const lastBid = bs.bids[bs.bids.length - 1];

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/80 backdrop-blur border border-[rgba(0,212,255,0.15)] rounded-xl px-3 py-1.5">
      {lastBid && (
        <p className="text-xs text-white/80">
          <span className="text-[#00D4FF]">{gameState.players[lastBid.playerIndex]?.name}</span> : {lastBid.value} {suitSymbols[lastBid.suit || '']}
        </p>
      )}
      <p className="text-[10px] text-[#6b7f8a] font-mono">{currentPlayer?.name} réfléchit...</p>
    </div>
  );
}

function ScoreContent({ gameState, myPosition }: { gameState: GameState; myPosition: number }) {
  const myTeam = myPosition % 2;
  const team0Label = myTeam === 0 ? 'Nous' : 'Eux';
  const team1Label = myTeam === 1 ? 'Nous' : 'Eux';
  const team0Tricks = gameState.tricks.filter(t => t.winnerIndex !== null && t.winnerIndex % 2 === 0).length;
  const team1Tricks = gameState.tricks.filter(t => t.winnerIndex !== null && t.winnerIndex % 2 === 1).length;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-[9px] font-mono text-[#00D4FF]/60 uppercase mb-1">Score (/{gameState.targetScore})</p>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-sm mb-0.5">
              <span className="text-white/80">{team0Label}</span>
              <span className="text-[#00D4FF] font-bold font-mono">{gameState.totalScores[0]}</span>
            </div>
            <div className="w-full h-1 bg-[#0d1520] rounded-full">
              <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00FFB2] rounded-full" style={{ width: `${Math.min(100, (gameState.totalScores[0] / gameState.targetScore) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-0.5">
              <span className="text-white/80">{team1Label}</span>
              <span className="text-[#00D4FF] font-bold font-mono">{gameState.totalScores[1]}</span>
            </div>
            <div className="w-full h-1 bg-[#0d1520] rounded-full">
              <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00FFB2] rounded-full" style={{ width: `${Math.min(100, (gameState.totalScores[1] / gameState.targetScore) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div>
        <p className="text-[9px] font-mono text-[#00D4FF]/60 uppercase mb-1">Plis / Atout</p>
        <p className="text-sm text-white/80 font-mono">Nous: <span className="text-[#00D4FF] font-bold">{myTeam === 0 ? team0Tricks : team1Tricks}</span></p>
        <p className="text-sm text-white/80 font-mono">Eux: <span className="text-[#00D4FF] font-bold">{myTeam === 0 ? team1Tricks : team0Tricks}</span></p>
        {gameState.trumpSuit && (
          <p className={`text-lg mt-1 ${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
            {suitSymbols[gameState.trumpSuit]}
          </p>
        )}
      </div>
    </div>
  );
}
