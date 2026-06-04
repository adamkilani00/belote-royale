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
    const size = mini ? 'w-6 h-9' : small ? 'w-10 h-14' : 'w-14 h-20';
    return (
      <div className={`${size} rounded-lg card-back relative overflow-hidden`} />
    );
  }

  const symbol = suitSymbols[card.suit] || '?';
  const color = suitColors[card.suit] || '#1a1a2e';
  const rank = rankLabels[card.rank] || card.rank;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  if (mini) {
    return (
      <div className="w-6 h-9 rounded playing-card flex items-center justify-center" style={{ fontSize: '10px' }}>
        <span style={{ color }}>{rank}{symbol}</span>
      </div>
    );
  }

  const sizeClass = small ? 'w-12 h-[68px]' : 'w-[60px] h-[88px]';
  const textSize = small ? 'text-sm' : 'text-lg';
  const symbolSize = small ? 'text-xl' : 'text-3xl';

  return (
    <motion.div
      whileHover={playable ? { y: -16, scale: 1.08 } : undefined}
      whileTap={playable ? { scale: 0.95 } : undefined}
      onClick={playable ? onClick : undefined}
      className={`
        ${sizeClass} rounded-lg playing-card
        ${playable ? 'playable' : ''}
        flex flex-col justify-between p-1.5 select-none relative
      `}
    >
      {/* Coin supérieur gauche */}
      <div className="flex flex-col items-center leading-none self-start">
        <span className={`font-bold ${textSize}`} style={{ color }}>{rank}</span>
        <span className="text-xs" style={{ color }}>{symbol}</span>
      </div>

      {/* Symbole central */}
      <div className={`absolute inset-0 flex items-center justify-center ${symbolSize}`} style={{ color }}>
        {symbol}
      </div>

      {/* Coin inférieur droit */}
      <div className="flex flex-col items-center leading-none self-end rotate-180">
        <span className={`font-bold ${textSize}`} style={{ color }}>{rank}</span>
        <span className="text-xs" style={{ color }}>{symbol}</span>
      </div>
    </motion.div>
  );
}
