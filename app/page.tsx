'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

export default function HomePage() {
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const setPlayerName = useGameStore(s => s.setPlayerName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = pseudo.trim();
    if (trimmed.length < 3 || trimmed.length > 15) {
      setError('Le pseudo doit contenir entre 3 et 15 caractères');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Caractères alphanumériques et _ uniquement');
      return;
    }
    setPlayerName(trimmed);
    router.push('/lobby');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#050508]" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#00D4FF]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00FFB2]/5 rounded-full blur-[100px]" />
      </div>

      {/* Floating decorations */}
      <motion.div
        animate={{ y: [-10, 10, -10], rotate: [45, 45, 45] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 left-16 w-4 h-4 border border-[#00D4FF]/30 rotate-45"
      />
      <motion.div
        animate={{ y: [10, -10, 10], rotate: [45, 45, 45] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-32 left-24 w-3 h-3 bg-[#00D4FF]/20 rotate-45"
      />
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-24 right-20 text-[#00D4FF]/20 text-2xl"
      >♥</motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 text-center max-w-2xl px-4"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#00D4FF]/20 bg-[#00D4FF]/5 mb-8"
        >
          <span className="text-[#00D4FF] text-xs">✦</span>
          <span className="text-xs font-mono tracking-[0.15em] text-[#00D4FF]/80 uppercase">Belote Royale · 2026</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-5xl md:text-7xl font-bold leading-tight mb-6"
        >
          <span className="text-white">La </span>
          <span className="text-gradient-cyan">Belote</span>
          <br />
          <span className="text-white">au futur du </span>
          <span className="text-[#FFD700]">jeu.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[#6b7f8a] text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed"
        >
          Belote Simple ou Contrée. Cartes vectorielles, IA experte, design ultra premium. Crée ton salon, défie tes amis ou apprends en mode tutoriel.
        </motion.p>

        {/* Input Card */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onSubmit={handleSubmit}
          className="premium-card rounded-2xl p-6 max-w-md mx-auto"
        >
          <label className="block text-left text-xs font-mono tracking-[0.1em] uppercase text-[#00D4FF]/70 mb-3">
            Choisis ton pseudo
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={pseudo}
              onChange={(e) => { setPseudo(e.target.value); setError(''); }}
              placeholder="ex: Joker_92"
              maxLength={15}
              className="flex-1 px-4 py-3 bg-[#0d1520] border border-[rgba(0,212,255,0.12)] rounded-xl text-white placeholder:text-[#3a4a56] focus:outline-none focus:border-[#00D4FF]/50 focus:shadow-[0_0_15px_rgba(0,212,255,0.15)] transition-all font-mono"
            />
            <button
              type="submit"
              className="btn-glow px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap"
            >
              Lobby →
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2 text-left">{error}</p>}

          {/* Features row */}
          <div className="flex justify-between mt-5 pt-4 border-t border-[rgba(0,212,255,0.08)]">
            <div className="text-center">
              <div className="text-[#00D4FF] text-lg mb-1">♠</div>
              <div className="text-[10px] font-mono tracking-wider text-[#6b7f8a] uppercase">32 Cartes</div>
            </div>
            <div className="text-center">
              <div className="text-[#00D4FF] text-lg mb-1">◆</div>
              <div className="text-[10px] font-mono tracking-wider text-[#6b7f8a] uppercase">IA Experte</div>
            </div>
            <div className="text-center">
              <div className="text-[#00D4FF] text-lg mb-1">✦</div>
              <div className="text-[10px] font-mono tracking-wider text-[#6b7f8a] uppercase">Multijoueur</div>
            </div>
          </div>
        </motion.form>

        {/* Tutorial link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-sm text-[#6b7f8a] font-mono"
        >
          Pas encore prêt ?{' '}
          <button onClick={() => router.push('/demo')} className="text-[#00D4FF] underline underline-offset-4 hover:text-[#00FFB2] transition-colors">
            Lance le tutoriel
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}
