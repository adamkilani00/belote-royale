'use client';

import { motion } from 'framer-motion';
import type { Card } from '@/lib/belote/types';

const suitSymbols: Record<string, string> = {
  hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣',
};

const suitColors: Record<string, string> = {
  hearts: '#ef4444', diamonds: '#ef4444',
  spades: '#1a1a2e', clubs: '#1a1a2e',
};

const rankLabels: Record<string, string> = {
  '7': '7', '8': '8', '9': '9', '10': '10',
  'jack': 'V', 'queen': 'D', 'king': 'R', 'ace': 'A',
};

interface PlayingCardProps {
  card: Card;
  faceDown?: boolean;
  playable?: boolean;
  small?: boolean;
  mini?: boolean;
  onClick?: () => void;
}

export function PlayingCard({ card, faceDown, playable, small, mini, onClick }: PlayingCardProps) {
  if (faceDown) {
    const size = mini ? 'w-5 h-7 sm:w-6 sm:h-9' : small ? 'w-8 h-11 sm:w-10 sm:h-14' : 'w-11 h-16 sm:w-14 sm:h-20';
    return (
      <div className={`${size} rounded-lg card-back relative overflow-hidden`} />
    );
  }

  const symbol = suitSymbols[card.suit] || '?';
  const color = suitColors[card.suit] || '#1a1a2e';
  const rank = rankLabels[card.rank] || card.rank;

  if (mini) {
    return (
      <div className="w-5 h-7 sm:w-6 sm:h-9 rounded playing-card flex items-center justify-center" style={{ fontSize: '9px' }}>
        <span style={{ color }}>{rank}{symbol}</span>
      </div>
    );
  }

  // Sur mobile : cartes plus petites
  const sizeClass = small
    ? 'w-9 h-[52px] sm:w-12 sm:h-[68px]'
    : 'w-[46px] h-[68px] sm:w-[60px] sm:h-[88px]';
  const textSize = small ? 'text-xs sm:text-sm' : 'text-base sm:text-lg';
  const symbolSize = small ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl';

  return (
    <motion.div
      whileHover={playable ? { y: -12, scale: 1.08 } : undefined}
      whileTap={playable ? { scale: 0.95 } : undefined}
      onClick={playable ? onClick : undefined}
      className={`
        ${sizeClass} rounded-lg playing-card
        ${playable ? 'playable' : ''}
        flex flex-col justify-between p-1 select-none relative
      `}
    >
      <div className="flex flex-col items-center leading-none self-start">
        <span className={`font-bold ${textSize}`} style={{ color }}>{rank}</span>
        <span className="text-[10px]" style={{ color }}>{symbol}</span>
      </div>
      <div className={`absolute inset-0 flex items-center justify-center ${symbolSize}`} style={{ color }}>
        {symbol}
      </div>
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className={`font-bold ${textSize}`} style={{ color }}>{rank}</span>
        <span className="text-[10px]" style={{ color }}>{symbol}</span>
      </div>
    </motion.div>
  );
}
