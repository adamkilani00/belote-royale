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
  const getRelativePosition = (pos: number) => {
    const diff = (pos - myPosition + 4) % 4;
    return (['south', 'west', 'north', 'east'] as const)[diff];
  };

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
    <div className="w-full h-screen flex overflow-hidden bg-[#050508]">
      {/* Main game area */}
      <div className="flex-1 flex flex-col">
        {/* Contract indicator top-left */}
        <ContractBadge gameState={gameState} />

        {/* Leave button top-right */}
        <button onClick={onLeave} className="absolute top-4 right-4 z-30 flex items-center gap-2 px-4 py-2 rounded-lg border border-[rgba(0,212,255,0.15)] text-[#6b7f8a] hover:text-white hover:border-[rgba(0,212,255,0.3)] transition-all text-sm bg-[#0a0d14]/80 backdrop-blur">
          ← Quitter
        </button>

        {/* Game table */}
        <div className="flex-1 relative">
          <div className="absolute inset-4 felt-table rounded-3xl overflow-hidden">
            {/* North player */}
            <PlayerSlot player={northPlayer} position="north" isActive={gameState.currentPlayerIndex === northPlayer?.position} cardCount={northPlayer?.hand.length || 0} />
            
            {/* West player */}
            <PlayerSlot player={westPlayer} position="west" isActive={gameState.currentPlayerIndex === westPlayer?.position} cardCount={westPlayer?.hand.length || 0} />
            
            {/* East player */}
            <PlayerSlot player={eastPlayer} position="east" isActive={gameState.currentPlayerIndex === eastPlayer?.position} cardCount={eastPlayer?.hand.length || 0} />

            {/* Center trick area */}
            <div className="absolute inset-0 flex items-center justify-center">
              <TrickDisplay gameState={gameState} myPosition={myPosition} />
            </div>

            {/* Trump selection UI */}
            {gameState.phase === 'trump_selection' && gameState.currentPlayerIndex === myPosition && (
              <TrumpSelectionPanel gameState={gameState} onAction={onTrumpAction} />
            )}

            {/* Bidding UI */}
            {gameState.phase === 'bidding' && gameState.currentPlayerIndex === myPosition && (
              <BiddingPanel gameState={gameState} onAction={onBidAction} />
            )}

            {/* Bidding info (when not our turn) */}
            {gameState.phase === 'bidding' && gameState.currentPlayerIndex !== myPosition && (
              <BiddingInfo gameState={gameState} />
            )}

            {/* My hand at bottom */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-end gap-0.5 z-10">
              {/* Player avatar */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full bg-[#00D4FF]/20 border-2 flex items-center justify-center text-[#00D4FF] font-bold text-xs ${gameState.currentPlayerIndex === myPosition ? 'active-player-glow border-[#00D4FF]' : 'border-[#00D4FF]/30'}`}>
                  {myPlayer?.name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              {myHand.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  style={{ transform: `rotate(${(i - myHand.length / 2) * 2}deg)` }}
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

      {/* Right sidebar - Score */}
      <ScoreSidebar gameState={gameState} myPosition={myPosition} />
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
  
  const positionLabels: Record<string, string> = { north: 'NORD', south: 'SUD', west: 'OUEST', east: 'EST' };
  const initials = player.name.slice(0, 2).toUpperCase();

  const posStyles: Record<string, string> = {
    north: 'top-4 left-1/2 -translate-x-1/2 flex-col items-center',
    west: 'left-4 top-1/2 -translate-y-1/2 flex-col items-center',
    east: 'right-4 top-1/2 -translate-y-1/2 flex-col items-center',
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
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-xs ${isActive ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-[#00D4FF] active-player-glow' : 'bg-[#0d1520] border-[rgba(0,212,255,0.2)] text-[#6b7f8a]'}`}>
          {initials}
        </div>
        <div>
          <p className="text-white text-sm font-medium">{player.name}</p>
          <p className="text-[#6b7f8a] text-[10px] font-mono uppercase">{positionLabels[position]}</p>
        </div>
      </div>
      <div className={`flex ${cardLayout[position]}`}>
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
          <PlayingCard key={i} card={{ id: 'h', suit: 'spades', rank: '7' }} faceDown mini={position !== 'north'} small={position === 'north'} />
        ))}
      </div>
    </div>
  );
}

function TrickDisplay({ gameState, myPosition }: { gameState: GameState; myPosition: number }) {
  const trick = gameState.currentTrick;
  if (!trick || trick.cards.length === 0) {
    // Afficher l'atout si défini
    if (gameState.trumpSuit) {
      return (
        <div className="flex flex-col items-center gap-2 opacity-40">
          <span className={`text-4xl ${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
            {suitSymbols[gameState.trumpSuit]}
          </span>
          <span className="text-[10px] font-mono text-[#6b7f8a] uppercase">Atout</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative w-44 h-44">
      <AnimatePresence>
        {trick.cards.map((play) => {
          const relDiff = (play.playerIndex - myPosition + 4) % 4;
          const offsets = [
            { x: 0, y: 35 },   // south (me)
            { x: -35, y: 0 },  // west
            { x: 0, y: -35 },  // north
            { x: 35, y: 0 },   // east
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

function ContractBadge({ gameState }: { gameState: GameState }) {
  const bs = gameState.biddingState;
  const contract = bs?.highestBid;

  return (
    <div className="absolute top-4 left-4 z-30 bg-[#0a0d14]/90 backdrop-blur border border-[rgba(0,212,255,0.15)] rounded-xl px-4 py-2">
      <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider">Contrat</p>
      {contract ? (
        <p className="text-white font-bold">
          <span className={contract.suit === 'hearts' || contract.suit === 'diamonds' ? 'text-red-400' : 'text-white'}>
            {suitSymbols[contract.suit || '']}
          </span>{' '}
          <span className="text-[#00D4FF]">{contract.value} pts</span>
          {bs?.isContred && <span className="text-red-400 ml-1">×2</span>}
          {bs?.isRecontred && <span className="text-orange-400 ml-1">×4</span>}
        </p>
      ) : (
        <p className="text-[#6b7f8a]">—</p>
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
      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/95 backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-2xl p-5 w-[420px] max-w-[80vw] shadow-[0_0_40px_rgba(0,212,255,0.1)]"
    >
      {ts.phase === 'first_round' ? (
        <>
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-2">Choix de l&apos;atout — 1er tour</p>
          <p className="text-white font-semibold mb-4">
            Carte retournée : <span className={`text-xl ${turnedSuit === 'hearts' || turnedSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>{suitSymbols[turnedSuit || '']}</span> — Prendre ?
          </p>
          <div className="flex gap-3">
            <button onClick={() => onAction('take')} className="flex-1 btn-glow rounded-xl py-2.5 text-sm font-bold">
              Prendre {suitSymbols[turnedSuit || '']}
            </button>
            <button onClick={() => onAction('pass')} className="flex-1 py-2.5 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] hover:text-white hover:border-[rgba(0,212,255,0.4)] transition-all text-sm">
              Passer
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-2">Choix de l&apos;atout — 2ème tour</p>
          <p className="text-white/80 text-sm mb-4">Choisissez une couleur (sauf {suitSymbols[turnedSuit || '']})</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {suits.filter(s => s !== turnedSuit).map(s => (
              <button key={s} onClick={() => onAction('take', s)} className={`py-3 rounded-xl border border-[rgba(0,212,255,0.15)] hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5 transition-all flex flex-col items-center gap-1`}>
                <span className={`text-2xl ${s === 'hearts' || s === 'diamonds' ? 'text-red-400' : 'text-white'}`}>{suitSymbols[s]}</span>
                <span className="text-[10px] text-[#6b7f8a]">{suitNames[s]}</span>
              </button>
            ))}
          </div>
          <button onClick={() => onAction('pass')} className="w-full py-2.5 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] hover:text-white transition-all text-sm">
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
      className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/95 backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-2xl p-5 w-[500px] max-w-[85vw] shadow-[0_0_40px_rgba(0,212,255,0.1)]"
    >
      <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">Enchères Belote Contrée</p>
      <p className="text-white font-semibold mb-1">À toi d&apos;annoncer</p>
      <p className="text-[#6b7f8a] text-sm mb-4">
        {bs.highestBid ? `Enchère actuelle : ${bs.highestBid.value} ${suitSymbols[bs.highestBid.suit || '']}` : 'Aucune enchère pour l\'instant. Mise minimum : 80.'}
      </p>

      {/* Valeurs */}
      <div className="mb-3">
        <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-2">Valeur</p>
        <div className="flex flex-wrap gap-1.5">
          {values.filter(v => v >= minBid).map(v => (
            <button key={v} onClick={() => setSelectedValue(v)} className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${selectedValue === v ? 'border-[#00D4FF] bg-[#00D4FF]/10 text-[#00D4FF]' : 'border-[rgba(0,212,255,0.1)] text-[#6b7f8a] hover:border-[rgba(0,212,255,0.3)]'}`}>
              {v}
            </button>
          ))}
          <button onClick={() => setSelectedValue(160)} className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${selectedValue === 160 ? 'border-[#FFD700] bg-[#FFD700]/10 text-[#FFD700]' : 'border-[rgba(0,212,255,0.1)] text-[#6b7f8a] hover:border-[rgba(0,212,255,0.3)]'}`}>
            Capot
          </button>
        </div>
      </div>

      {/* Couleurs */}
      <div className="mb-4">
        <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-2">Atout</p>
        <div className="flex gap-2">
          {suits.map(s => (
            <button key={s} onClick={() => setSelectedSuit(s)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${selectedSuit === s ? 'border-[#00D4FF] bg-[#00D4FF]/10' : 'border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.3)]'}`}>
              <span className={s === 'hearts' || s === 'diamonds' ? 'text-red-400' : 'text-white'}>{suitSymbols[s]}</span>
              <span className="text-[#6b7f8a] text-xs">{suitNames[s]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => onAction('bid', selectedValue, selectedSuit)} className="btn-glow rounded-xl px-5 py-2.5 text-sm font-bold">
          Annoncer {selectedValue} {suitSymbols[selectedSuit]}
        </button>
        <button onClick={() => onAction('pass')} className="px-5 py-2.5 rounded-xl border border-[rgba(0,212,255,0.2)] text-[#6b7f8a] hover:text-white transition-all text-sm">
          Passer
        </button>
        {bs.highestBid && !bs.isContred && bs.highestBid.playerIndex % 2 !== gameState.currentPlayerIndex % 2 && (
          <button onClick={() => onAction('contre')} className="px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all">
            Contre ×2
          </button>
        )}
        {bs.isContred && !bs.isRecontred && bs.highestBid && bs.highestBid.playerIndex % 2 === gameState.currentPlayerIndex % 2 && (
          <button onClick={() => onAction('surcontre')} className="px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all">
            Surcontre ×4
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
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-[#0a0d14]/80 backdrop-blur border border-[rgba(0,212,255,0.15)] rounded-xl px-4 py-2">
      {lastBid ? (
        <p className="text-sm text-white/80">
          <span className="text-[#00D4FF]">{gameState.players[lastBid.playerIndex]?.name}</span> : {lastBid.value} {suitSymbols[lastBid.suit || '']}
        </p>
      ) : null}
      <p className="text-xs text-[#6b7f8a] font-mono mt-0.5">
        {currentPlayer?.name} réfléchit...
      </p>
    </div>
  );
}

function ScoreSidebar({ gameState, myPosition }: { gameState: GameState; myPosition: number }) {
  const myTeam = myPosition % 2;
  const team0Label = myTeam === 0 ? 'Nous (Sud+Nord)' : 'Eux (Sud+Nord)';
  const team1Label = myTeam === 1 ? 'Nous (Ouest+Est)' : 'Eux (Ouest+Est)';
  
  // Plis remportés this round
  const team0Tricks = gameState.tricks.filter(t => t.winnerIndex !== null && t.winnerIndex % 2 === 0).length;
  const team1Tricks = gameState.tricks.filter(t => t.winnerIndex !== null && t.winnerIndex % 2 === 1).length;

  return (
    <div className="w-64 bg-[#0a0d14] border-l border-[rgba(0,212,255,0.1)] p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Score header */}
      <div className="border-b border-[rgba(0,212,255,0.1)] pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider">Score</p>
          <span className="text-[10px] font-mono text-[#6b7f8a] uppercase">{gameState.mode === 'simple' ? 'Simple' : 'Contrée'}</span>
        </div>
        <p className="text-white font-bold">Objectif <span className="text-[#00D4FF]">{gameState.targetScore}</span></p>
      </div>

      {/* Team scores */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80">{team0Label}</span>
          <span className="text-xl font-bold text-[#00D4FF] font-mono">{gameState.totalScores[0]}</span>
        </div>
        <div className="w-full h-1 bg-[#0d1520] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00FFB2] rounded-full transition-all" style={{ width: `${Math.min(100, (gameState.totalScores[0] / gameState.targetScore) * 100)}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80">{team1Label}</span>
          <span className="text-xl font-bold text-[#00D4FF] font-mono">{gameState.totalScores[1]}</span>
        </div>
        <div className="w-full h-1 bg-[#0d1520] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#00FFB2] rounded-full transition-all" style={{ width: `${Math.min(100, (gameState.totalScores[1] / gameState.targetScore) * 100)}%` }} />
        </div>
      </div>

      {/* Contract info */}
      {gameState.biddingState?.highestBid && (
        <div className="border-t border-[rgba(0,212,255,0.1)] pt-3">
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">Contrat en cours</p>
          <p className="text-[#00D4FF] font-bold font-mono">{gameState.biddingState.highestBid.value} pts</p>
        </div>
      )}

      {/* Tricks won */}
      <div className="border-t border-[rgba(0,212,255,0.1)] pt-3">
        <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-2">Plis remportés</p>
        <div className="flex justify-between text-sm">
          <span className="text-white/80 font-mono">Nous : <span className="text-[#00D4FF] font-bold">{myTeam === 0 ? team0Tricks : team1Tricks}</span></span>
          <span className="text-white/80 font-mono">Eux : <span className="text-[#00D4FF] font-bold">{myTeam === 0 ? team1Tricks : team0Tricks}</span></span>
        </div>
      </div>

      {/* Trump suit */}
      {gameState.trumpSuit && (
        <div className="border-t border-[rgba(0,212,255,0.1)] pt-3">
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-1">Atout</p>
          <p className={`text-2xl ${gameState.trumpSuit === 'hearts' || gameState.trumpSuit === 'diamonds' ? 'text-red-400' : 'text-white'}`}>
            {suitSymbols[gameState.trumpSuit]} {suitNames[gameState.trumpSuit]}
          </p>
        </div>
      )}

      {/* Round history */}
      {gameState.roundScores.length > 0 && (
        <div className="border-t border-[rgba(0,212,255,0.1)] pt-3">
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-2">Historique</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {gameState.roundScores.map((score, i) => (
              <div key={i} className="flex justify-between text-xs text-[#6b7f8a] font-mono">
                <span>M{i + 1}</span>
                <span>{score.team0Points} — {score.team1Points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
