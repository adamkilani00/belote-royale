'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { gameApi } from '@/lib/api-client';
import { playChatSound } from '@/lib/sounds';

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

interface GameChatProps {
  roomId: string;
  playerName: string;
}

export function GameChat({ roomId, playerName }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const fetchChat = useCallback(async () => {
    try {
      const data = await gameApi('get_chat', { roomId });
      const msgs = data.messages || [];
      if (msgs.length > lastCountRef.current && lastCountRef.current > 0) {
        const newMsgs = msgs.slice(lastCountRef.current);
        const hasOtherMsg = newMsgs.some((m: ChatMessage) => m.sender !== playerName && !m.isSystem);
        if (hasOtherMsg && !isOpen) {
          setUnread(prev => prev + newMsgs.filter((m: ChatMessage) => m.sender !== playerName).length);
          playChatSound();
        }
      }
      lastCountRef.current = msgs.length;
      setMessages(msgs);
    } catch { /* ignore */ }
  }, [roomId, playerName, isOpen]);

  useEffect(() => {
    fetchChat();
    const interval = setInterval(fetchChat, 2000);
    return () => clearInterval(interval);
  }, [fetchChat]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) setUnread(0);
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    try {
      await gameApi('chat', { roomId, sender: playerName, text });
      fetchChat();
    } catch { /* ignore */ }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-[#0a0d14] border border-[rgba(0,212,255,0.3)] flex items-center justify-center text-[#00D4FF] hover:border-[rgba(0,212,255,0.6)] hover:shadow-[0_0_20px_rgba(0,212,255,0.2)] transition-all"
      >
        💬
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#00D4FF] text-[#050508] rounded-full text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 z-40 w-80 h-96 bg-[#0a0d14] border border-[rgba(0,212,255,0.2)] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[rgba(0,212,255,0.1)] flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Chat de la partie</p>
              <button onClick={() => setIsOpen(false)} className="text-[#6b7f8a] hover:text-white text-lg">×</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map(msg => (
                <div key={msg.id}>
                  {msg.isSystem ? (
                    <div className="text-center text-[10px] text-[#6b7f8a] font-mono py-1">
                      {msg.text}
                    </div>
                  ) : (
                    <div className={`${msg.sender === playerName ? 'ml-8' : 'mr-8'}`}>
                      <div className={`rounded-xl px-3 py-2 ${msg.sender === playerName ? 'bg-[#00D4FF]/10 border border-[#00D4FF]/20 ml-auto' : 'bg-[#0d1520] border border-[rgba(0,212,255,0.08)]'}`}>
                        <p className="text-[10px] font-mono text-[#00D4FF]/60 mb-0.5">{msg.sender}</p>
                        <p className="text-sm text-white/90">{msg.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-center text-[#6b7f8a] text-xs font-mono mt-8">Aucun message. Dis bonjour !</p>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-[rgba(0,212,255,0.1)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ton message..."
                  maxLength={200}
                  className="flex-1 px-3 py-2 bg-[#0d1520] border border-[rgba(0,212,255,0.1)] rounded-lg text-sm text-white placeholder:text-[#3a4a56] focus:outline-none focus:border-[#00D4FF]/40 transition-all"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="px-3 py-2 rounded-lg bg-[#00D4FF]/20 text-[#00D4FF] text-sm font-medium border border-[#00D4FF]/20 hover:bg-[#00D4FF]/30 transition-all disabled:opacity-30"
                >
                  ↗
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
