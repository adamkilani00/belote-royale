'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { gameApi } from '@/lib/api-client';
import { GameTable } from '@/components/belote/GameTable';
import { GameChat } from '@/components/belote/GameChat';
import { playCardSound, playTrickWonSound, playYourTurnSound, playVictorySound, playDefeatSound } from '@/lib/sounds';
import type { Room, GameState, Card, Suit } from '@/lib/belote/types';

function GamePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room');
  const { playerId, playerName, loadFromSession } = useGameStore();

  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [playableCards, setPlayableCards] = useState<string[]>([]);
  const [myPosition, setMyPosition] = useState<number>(0);
  const prevTrickCountRef = useRef(0);
  const prevTurnRef = useRef<number | null>(null);
  const scoringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { loadFromSession(); }, [loadFromSession]);
  useEffect(() => { if (!playerName || !roomId) router.push('/lobby'); }, [playerName, roomId, router]);

  const pollState = useCallback(async () => {
    if (!roomId || !playerId) return;
    try {
      const data = await gameApi('get_state', { roomId, playerId });
      if (data.room) setRoom(data.room);
      if (data.gameState) {
        const gs = data.gameState;
        const idx = gs.players.findIndex((p: { id: string }) => p.id === playerId);

        // Sound: trick won
        if (gs.tricks && gs.tricks.length > prevTrickCountRef.current) {
          playTrickWonSound();
          prevTrickCountRef.current = gs.tricks.length;
        }

        // Sound: your turn
        if (gs.currentPlayerIndex === idx && prevTurnRef.current !== idx) {
          playYourTurnSound();
        }
        prevTurnRef.current = gs.currentPlayerIndex;

        setGameState(gs);
        if (data.hand) setMyHand(data.hand);
        if (data.playableCards) setPlayableCards(data.playableCards);
        if (idx >= 0) setMyPosition(idx);
      } else {
        setGameState(null);
      }
    } catch { /* ignore */ }
  }, [roomId, playerId]);

  useEffect(() => {
    pollState();
    const interval = setInterval(pollState, 800);
    return () => clearInterval(interval);
  }, [pollState]);

  // FIXED: Auto-advance scoring screen after 2.5s
  useEffect(() => {
    if (gameState?.phase === 'scoring' && roomId) {
      if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
      scoringTimeoutRef.current = setTimeout(async () => {
        try {
          await gameApi('next_round', { roomId });
        } catch { /* ignore */ }
      }, 2500);
      return () => {
        if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
      };
    }
  }, [gameState?.phase, roomId]);

  const handleStartGame = async () => {
    if (!roomId || !playerId) return;
    try {
      await gameApi('start_game', { roomId, playerId });
      pollState();
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
  };

  const handleLeave = async () => {
    if (!playerId) return;
    if (scoringTimeoutRef.current) clearTimeout(scoringTimeoutRef.current);
    await gameApi('leave_room', { playerId });
    router.push('/lobby');
  };

  const handlePlayCard = async (cardId: string) => {
    if (!roomId || !playableCards.includes(cardId) || !playerId) return;
    playCardSound();
    try {
      await gameApi('play_card', { roomId, playerIndex: myPosition, cardId, playerId });
      setTimeout(pollState, 100);
    } catch { /* ignore */ }
  };

  const handleTrumpAction = async (action: 'take' | 'pass', suit?: Suit) => {
    if (!roomId) return;
    try {
      await gameApi('trump_selection', { roomId, playerIndex: myPosition, selAction: action, suit });
      setTimeout(pollState, 100);
    } catch { /* ignore */ }
  };

  const handleBidAction = async (action: 'bid' | 'pass' | 'contre' | 'surcontre', value?: number, suit?: Suit) => {
    if (!roomId) return;
    try {
      await gameApi('bid', { roomId, playerIndex: myPosition, bidAction: action, value, suit });
      setTimeout(pollState, 100);
    } catch { /* ignore */ }
  };

  // Waiting room
  if (!gameState) {
    return <WaitingRoom room={room} playerId={playerId} onStart={handleStartGame} onLeave={handleLeave} />;
  }

  // Scoring screen (between rounds)
  if (gameState.phase === 'scoring') {
    const myTeam = myPosition % 2;
    const lastRound = gameState.roundScores[gameState.roundScores.length - 1];
    return (
      <div className="min-h-[100dvh] bg-[#050508] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] bg-[#00D4FF]/5 rounded-full blur-[120px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card rounded-2xl p-8 w-[440px] max-w-[90vw] relative z-10 text-center"
        >
          <p className="text-[10px] font-mono text-[#00D4FF]/60 uppercase tracking-wider mb-2">Manche {gameState.roundNumber - 1} terminée</p>
          <h2 className="text-2xl font-bold text-white mb-6">Résultats</h2>
          {lastRound && (
            <div className="flex gap-8 justify-center mb-6 p-4 rounded-xl bg-[#0d1520]/50 border border-[rgba(0,212,255,0.1)]">
              <div>
                <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-1">Nous</p>
                <p className="text-3xl font-bold text-[#00D4FF] font-mono">{myTeam === 0 ? lastRound.team0Points : lastRound.team1Points}</p>
                <p className="text-xs text-[#6b7f8a] font-mono">Total: {myTeam === 0 ? lastRound.team0Total : lastRound.team1Total}</p>
              </div>
              <div className="w-px bg-[rgba(0,212,255,0.1)]" />
              <div>
                <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-1">Eux</p>
                <p className="text-3xl font-bold text-white/60 font-mono">{myTeam === 0 ? lastRound.team1Points : lastRound.team0Points}</p>
                <p className="text-xs text-[#6b7f8a] font-mono">Total: {myTeam === 0 ? lastRound.team1Total : lastRound.team0Total}</p>
              </div>
            </div>
          )}
          <p className="text-[#6b7f8a] text-sm font-mono animate-pulse">Prochaine manche dans 2 secondes...</p>
        </motion.div>
      </div>
    );
  }

  // Victory
  if (gameState.phase === 'finished') {
    const myTeam = myPosition % 2;
    const winningTeam = gameState.totalScores[0] >= gameState.targetScore ? 0 : 1;
    if (myTeam === winningTeam) playVictorySound();
    else playDefeatSound();
    return <VictoryScreen gameState={gameState} myPosition={myPosition} onLeave={handleLeave} />;
  }

  // Game table with chat
  return (
    <>
      <GameTable
        gameState={gameState}
        myPosition={myPosition}
        myHand={myHand}
        playableCards={playableCards}
        onPlayCard={handlePlayCard}
        onTrumpAction={handleTrumpAction}
        onBidAction={handleBidAction}
        onLeave={handleLeave}
      />
      {roomId && playerName && (
        <GameChat roomId={roomId} playerName={playerName} />
      )}
    </>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GamePageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508]">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#6b7f8a] font-mono text-sm">Chargement...</p>
      </div>
    </div>
  );
}

function WaitingRoom({ room, playerId, onStart, onLeave }: {
  room: Room | null; playerId: string | null; onStart: () => void; onLeave: () => void;
}) {
  if (!room) return <LoadingScreen />;

  const isCreator = room.creatorId === playerId;
  const canStart = room.players.length >= 1;

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-[#00D4FF]/3 rounded-full blur-[150px]" />
      </div>
      
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="premium-card rounded-2xl p-8 w-[520px] max-w-[90vw] relative z-10 shadow-[0_0_60px_rgba(0,212,255,0.15)]">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">{room.name}</h2>
          <p className="text-[#6b7f8a] text-sm mt-1 font-mono">
            {room.mode === 'simple' ? 'Belote Simple' : 'Belote Contrée'} — Objectif {room.targetScore}
          </p>
          {room.isPrivate && (
            <div className="mt-3 inline-flex items-center gap-2 bg-[#00D4FF]/5 border border-[#00D4FF]/20 rounded-lg px-4 py-2">
              <span className="text-[10px] font-mono text-[#6b7f8a] uppercase">Code :</span>
              <span className="font-mono font-bold text-[#00D4FF] text-lg tracking-[0.2em]">{room.code}</span>
            </div>
          )}
        </div>

        <div className="space-y-2 mb-6">
          {[0, 1, 2, 3].map(i => {
            const player = room.players[i];
            const teamLabel = i % 2 === 0 ? 'Nous' : 'Eux';
            const posLabel = ['Sud', 'Ouest', 'Nord', 'Est'][i];
            const isBot = player?.id.startsWith('bot_');
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${player ? 'bg-[#0d1520]/50 border-[rgba(0,212,255,0.15)]' : 'border-dashed border-[rgba(0,212,255,0.1)]'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${player ? (i % 2 === 0 ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30' : 'bg-white/5 text-white/50 border border-white/10') : 'bg-[#0d1520]/50 border border-[#00D4FF]/10'}`}>
                  {player ? player.name.slice(0, 2).toUpperCase() : '?'}
                </div>
                <div className="flex-1">
                  {player ? (
                    <span className="font-medium text-white">{player.name} {isBot && <span className="text-[10px] text-[#6b7f8a] font-mono ml-1">IA</span>}</span>
                  ) : (
                    <span className="text-[#3a4a56] italic text-sm">En attente...</span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-[#6b7f8a] uppercase">{posLabel} · {teamLabel}</span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onLeave} className="flex-1 py-2.5 rounded-xl border border-[rgba(0,212,255,0.15)] text-[#6b7f8a] hover:text-white hover:border-[rgba(0,212,255,0.3)] transition-all text-sm font-medium">
            Quitter
          </button>
          {isCreator && (
            <button onClick={onStart} disabled={!canStart} className="flex-1 btn-glow rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
              {room.players.length < 4 ? `Lancer avec IA (${room.players.length}/4)` : 'Démarrer la partie'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function VictoryScreen({ gameState, myPosition, onLeave }: { gameState: GameState; myPosition: number; onLeave: () => void }) {
  const myTeam = myPosition % 2;
  const winningTeam = gameState.totalScores[0] >= gameState.targetScore ? 0 : 1;
  const iWon = myTeam === winningTeam;

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0">
        <div className={`absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full blur-[200px] ${iWon ? 'bg-[#00D4FF]/10' : 'bg-red-500/5'}`} />
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }} className="premium-card rounded-3xl p-10 text-center relative z-10 max-w-[520px]">
        <motion.div initial={{ rotate: -10, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="text-7xl mb-4">
          {iWon ? '🏆' : '💫'}
        </motion.div>
        <h2 className={`text-3xl font-bold mb-2 ${iWon ? 'text-gradient-cyan' : 'text-white'}`}>
          {iWon ? 'Victoire !' : 'Défaite'}
        </h2>
        <p className="text-[#6b7f8a] mb-6">
          {iWon ? 'Bravo, ton équipe remporte la partie !' : 'Bien joué, tu feras mieux la prochaine fois !'}
        </p>
        
        <div className="flex gap-8 justify-center mb-8 p-4 rounded-xl bg-[#0d1520]/50 border border-[rgba(0,212,255,0.1)]">
          <div>
            <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-1">Nous</p>
            <p className="text-2xl font-bold text-[#00D4FF] font-mono">{gameState.totalScores[myTeam]}</p>
          </div>
          <div className="w-px bg-[rgba(0,212,255,0.1)]" />
          <div>
            <p className="text-[10px] font-mono text-[#6b7f8a] uppercase mb-1">Eux</p>
            <p className="text-2xl font-bold text-white/60 font-mono">{gameState.totalScores[1 - myTeam]}</p>
          </div>
        </div>

        <button onClick={onLeave} className="btn-glow rounded-xl px-8 py-3 text-sm font-bold">
          Retour au lobby
        </button>
      </motion.div>
    </div>
  );
}
