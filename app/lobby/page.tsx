'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { gameApi } from '@/lib/api-client';
import type { Room, GameMode } from '@/lib/belote/types';

export default function LobbyPage() {
  const router = useRouter();
  const { playerId, playerName, loadFromSession } = useGameStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadFromSession(); }, [loadFromSession]);
  useEffect(() => { if (!playerName) router.push('/'); }, [playerName, router]);

  const fetchRooms = useCallback(async () => {
    try { const data = await gameApi('get_rooms'); setRooms(data.rooms || []); } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleJoinRoom = async (roomId: string) => {
    if (!playerId || !playerName) return;
    setLoading(true);
    try {
      const data = await gameApi('join_room', { roomId, playerId, playerName });
      useGameStore.getState().setRoom(data.room);
      router.push(`/game?room=${data.room.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim() || !playerId || !playerName) return;
    setLoading(true);
    try {
      const data = await gameApi('join_room', { code: joinCode.trim().toUpperCase(), playerId, playerName });
      useGameStore.getState().setRoom(data.room);
      router.push(`/game?room=${data.room.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const handleSoloPlay = async (mode: GameMode) => {
    if (!playerId || !playerName) return;
    setLoading(true);
    try {
      const data = await gameApi('create_room', { playerId, playerName, mode, isPrivate: true, targetScore: 501, fillBots: true });
      useGameStore.getState().setRoom(data.room);
      router.push(`/game?room=${data.room.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    useGameStore.getState().reset();
    router.push('/');
  };

  if (!playerName) return null;

  const initials = playerName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#050508] p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00D4FF]/3 rounded-full blur-[150px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00D4FF]/20 border border-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF] font-bold text-sm">
              {initials}
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.15em] text-[#00D4FF]/60 uppercase">Connecté en tant que</p>
              <p className="text-white font-semibold">{playerName}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 border border-[rgba(0,212,255,0.15)] rounded-lg text-[#6b7f8a] hover:text-white hover:border-[rgba(0,212,255,0.3)] transition-all text-sm">
            <span>↪</span> Quitter
          </button>
        </motion.div>

        {/* Quick play cards */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <QuickPlayCard
            icon="♠"
            title="Solo · Belote Simple"
            desc="Lance une partie vs 3 IA, mode classique."
            onClick={() => handleSoloPlay('simple')}
            loading={loading}
          />
          <QuickPlayCard
            icon="♦"
            title="Solo · Belote Contrée"
            desc="Avec enchères, contre & surcontre."
            onClick={() => handleSoloPlay('contree')}
            loading={loading}
          />
          <QuickPlayCard
            icon="📖"
            title="Tutoriel interactif"
            desc="Apprends les règles en jouant."
            onClick={() => router.push('/demo')}
            loading={false}
            isAlt
          />
        </motion.div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          {/* Public rooms */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="premium-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono tracking-[0.15em] text-[#00D4FF]/60 uppercase mb-1">Salons publics</p>
                <h2 className="text-xl font-bold text-white">Parties en attente</h2>
              </div>
              <button onClick={fetchRooms} className="w-8 h-8 rounded-lg border border-[rgba(0,212,255,0.15)] flex items-center justify-center text-[#6b7f8a] hover:text-[#00D4FF] hover:border-[rgba(0,212,255,0.3)] transition-all text-sm">
                ↻
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="text-center py-12 text-[#6b7f8a] font-mono text-sm">
                Aucun salon public pour l&apos;instant. Crée le premier !
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map(room => (
                  <div key={room.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0d1520]/50 border border-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.25)] transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-[#00D4FF]">{room.mode === 'simple' ? '♠' : '♦'}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{room.name}</p>
                        <p className="text-[#6b7f8a] text-xs font-mono">{room.mode === 'simple' ? 'Simple' : 'Contrée'} · {room.players.length}/4</p>
                      </div>
                    </div>
                    <button onClick={() => handleJoinRoom(room.id)} disabled={loading || room.players.length >= 4} className="px-4 py-1.5 rounded-lg bg-[#00D4FF]/10 text-[#00D4FF] text-xs font-medium border border-[#00D4FF]/20 hover:bg-[#00D4FF]/20 transition-all disabled:opacity-40">
                      Rejoindre
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={() => setShowCreate(true)}
              className="w-full btn-glow rounded-2xl py-4 text-base flex items-center justify-center gap-2"
            >
              <span>+</span> Créer un salon
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              onClick={() => setShowJoinCode(true)}
              className="w-full premium-card rounded-2xl py-4 text-base flex items-center justify-center gap-2 text-white hover:border-[rgba(0,212,255,0.4)] cursor-pointer"
            >
              <span className="text-[#00D4FF]">👥</span> Rejoindre par code
            </motion.button>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="premium-card rounded-2xl p-4">
              <p className="text-[10px] font-mono tracking-[0.15em] text-[#00D4FF]/60 uppercase mb-2">Astuce</p>
              <p className="text-[#6b7f8a] text-sm leading-relaxed">
                Les places libres seront automatiquement comblées par des IA. Tu peux donc lancer une partie même seul.
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateRoomModal onClose={() => setShowCreate(false)} />}
        {showJoinCode && <JoinCodeModal code={joinCode} setCode={setJoinCode} onJoin={handleJoinByCode} onClose={() => setShowJoinCode(false)} loading={loading} />}
      </AnimatePresence>
    </div>
  );
}

function QuickPlayCard({ icon, title, desc, onClick, loading, isAlt }: {
  icon: string; title: string; desc: string; onClick: () => void; loading: boolean; isAlt?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading} className="premium-card rounded-2xl p-5 text-left hover:border-[rgba(0,212,255,0.4)] transition-all group disabled:opacity-50">
      <div className={`w-10 h-10 rounded-lg ${isAlt ? 'bg-[#FFD700]/10 border-[#FFD700]/20' : 'bg-[#00D4FF]/10 border-[#00D4FF]/20'} border flex items-center justify-center text-lg mb-3`}>
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-[#6b7f8a] text-sm">{desc}</p>
      <p className={`text-xs font-medium mt-3 ${isAlt ? 'text-[#FFD700]' : 'text-[#00D4FF]'} group-hover:translate-x-1 transition-transform`}>
        {isAlt ? 'Apprendre →' : 'Jouer →'}
      </p>
    </button>
  );
}

function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { playerId, playerName } = useGameStore();
  const [mode, setMode] = useState<GameMode>('simple');
  const [isPrivate, setIsPrivate] = useState(false);
  const [targetScore, setTargetScore] = useState(501);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!playerId || !playerName) return;
    setLoading(true);
    try {
      const data = await gameApi('create_room', { playerId, playerName, mode, isPrivate, targetScore });
      useGameStore.getState().setRoom(data.room);
      router.push(`/game?room=${data.room.id}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="premium-card rounded-2xl p-6 w-[440px] max-w-[90vw] shadow-[0_0_60px_rgba(0,212,255,0.1)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Créer un salon</h2>
          <button onClick={onClose} className="text-[#6b7f8a] hover:text-white text-xl">×</button>
        </div>

        {/* Mode */}
        <div className="mb-5">
          <label className="block text-[10px] font-mono tracking-[0.15em] text-[#00D4FF]/60 uppercase mb-2">Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('simple')} className={`p-3 rounded-xl border text-left transition-all ${mode === 'simple' ? 'border-[#00D4FF]/50 bg-[#00D4FF]/5' : 'border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.25)]'}`}>
              <p className="text-white font-semibold text-sm">Belote Simple</p>
              <p className="text-[#6b7f8a] text-xs">Choix d&apos;atout classique</p>
            </button>
            <button onClick={() => setMode('contree')} className={`p-3 rounded-xl border text-left transition-all ${mode === 'contree' ? 'border-[#00D4FF]/50 bg-[#00D4FF]/5' : 'border-[rgba(0,212,255,0.1)] hover:border-[rgba(0,212,255,0.25)]'}`}>
              <p className="text-white font-semibold text-sm">Belote Contrée</p>
              <p className="text-[#6b7f8a] text-xs">Enchères 80-160 + contre</p>
            </button>
          </div>
        </div>

        {/* Objectif */}
        <div className="mb-5">
          <label className="block text-[10px] font-mono tracking-[0.15em] text-[#00D4FF]/60 uppercase mb-2">Objectif</label>
          <div className="grid grid-cols-3 gap-2">
            {[501, 1000, 2000].map(s => (
              <button key={s} onClick={() => setTargetScore(s)} className={`py-2 rounded-lg border text-sm font-mono transition-all ${targetScore === s ? 'border-[#00D4FF]/50 bg-[#00D4FF]/5 text-[#00D4FF]' : 'border-[rgba(0,212,255,0.1)] text-[#6b7f8a] hover:border-[rgba(0,212,255,0.25)]'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Privée */}
        <div className="flex items-center justify-between mb-6 p-3 rounded-xl border border-[rgba(0,212,255,0.1)]">
          <div>
            <p className="text-white text-sm font-medium">Partie privée</p>
            <p className="text-[#6b7f8a] text-xs">Visible uniquement avec le code</p>
          </div>
          <button onClick={() => setIsPrivate(!isPrivate)} className={`w-11 h-6 rounded-full transition-all relative ${isPrivate ? 'bg-[#00D4FF]' : 'bg-[#1a2030]'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPrivate ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>

        <button onClick={handleCreate} disabled={loading} className="w-full btn-glow rounded-xl py-3 text-sm font-bold disabled:opacity-50">
          {loading ? 'Création...' : 'Créer le salon'}
        </button>
      </motion.div>
    </motion.div>
  );
}

function JoinCodeModal({ code, setCode, onJoin, onClose, loading }: {
  code: string; setCode: (c: string) => void; onJoin: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="premium-card rounded-2xl p-6 w-[380px] max-w-[90vw]">
        <h2 className="text-xl font-bold text-white mb-4">Rejoindre par code</h2>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="EX: A3K9Z2"
          maxLength={6}
          className="w-full px-4 py-3 bg-[#0d1520] border border-[rgba(0,212,255,0.12)] rounded-xl text-white text-center font-mono text-2xl tracking-[0.3em] placeholder:text-[#3a4a56] placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-[#00D4FF]/50 transition-all mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(0,212,255,0.15)] text-[#6b7f8a] hover:text-white transition-all text-sm">Annuler</button>
          <button onClick={onJoin} disabled={loading || code.length < 4} className="flex-1 btn-glow rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">Rejoindre</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
