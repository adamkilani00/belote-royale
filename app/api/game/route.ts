// API Route principale du jeu de Belote Royale
import { NextRequest, NextResponse } from 'next/server';
import { gameManager } from '@/lib/belote/game-manager';
import { getPlayableCards } from '@/lib/belote/engine';
import type { GameMode, Suit } from '@/lib/belote/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create_room': {
        const { playerId, playerName, mode, isPrivate, targetScore, fillBots } = body;
        if (!playerId || !playerName || !mode) {
          return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
        }
        const room = gameManager.createRoom(
          playerId, playerName, mode as GameMode,
          isPrivate ?? false, targetScore ?? 501, fillBots ?? false
        );
        return NextResponse.json({ room });
      }

      case 'join_room': {
        const { roomId, playerId, playerName, code } = body;
        let targetRoomId = roomId;
        if (code && !roomId) {
          const found = gameManager.getRoomByCode(code);
          if (!found) return NextResponse.json({ error: 'Salon introuvable' }, { status: 404 });
          targetRoomId = found.id;
        }
        if (!targetRoomId || !playerId || !playerName) {
          return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
        }
        const room = gameManager.joinRoom(targetRoomId, playerId, playerName);
        if (!room) return NextResponse.json({ error: 'Salon plein ou introuvable' }, { status: 400 });
        return NextResponse.json({ room });
      }

      case 'reconnect': {
        const { pseudo, newPlayerId } = body;
        if (!pseudo || !newPlayerId) {
          return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
        }
        const result = gameManager.reconnectByPseudo(pseudo, newPlayerId);
        if (!result) return NextResponse.json({ error: 'Aucune session trouvée' }, { status: 404 });
        return NextResponse.json(result);
      }

      case 'leave_room': {
        const { playerId } = body;
        const result = gameManager.leaveRoom(playerId);
        return NextResponse.json(result);
      }

      case 'get_rooms': {
        const rooms = gameManager.getPublicRooms();
        return NextResponse.json({ rooms });
      }

      case 'get_room': {
        const { roomId } = body;
        const room = gameManager.rooms.get(roomId);
        if (!room) return NextResponse.json({ error: 'Salon introuvable' }, { status: 404 });
        return NextResponse.json({ room });
      }

      case 'start_game': {
        const { roomId, playerId } = body;
        const room = gameManager.rooms.get(roomId);
        if (!room) return NextResponse.json({ error: 'Salon introuvable' }, { status: 404 });
        if (room.creatorId !== playerId) {
          return NextResponse.json({ error: 'Seul le créateur peut démarrer' }, { status: 403 });
        }
        if (room.players.length < 4) {
          // Auto-fill with bots
          gameManager.fillWithBots(room);
        }
        const gameState = gameManager.startGame(roomId);
        if (!gameState) return NextResponse.json({ error: 'Impossible de démarrer' }, { status: 400 });
        return NextResponse.json({ gameState: sanitizeGameState(gameState, playerId) });
      }

      case 'get_state': {
        const { roomId, playerId } = body;
        const room = gameManager.rooms.get(roomId);
        if (!room) return NextResponse.json({ gameState: null, room: null });
        if (!room.gameState) return NextResponse.json({ gameState: null, room });
        
        const gs = room.gameState;
        const playerIdx = gs.players.findIndex(p => p.id === playerId);
        const hand = playerIdx >= 0 ? gs.players[playerIdx].hand : [];
        let playable: string[] = [];
        if (gs.phase === 'playing' && gs.currentPlayerIndex === playerIdx && gs.currentTrick && gs.trumpSuit) {
          playable = getPlayableCards(hand, gs.currentTrick, gs.trumpSuit, playerIdx).map(c => c.id);
        }

        // Annonces
        const announcements = gameManager.gameAnnouncements.get(gs.id) || [];

        return NextResponse.json({
          gameState: sanitizeGameState(gs, playerId),
          hand,
          playableCards: playable,
          room,
          announcements,
        });
      }

      case 'trump_selection': {
        const { roomId, playerIndex, selAction, suit } = body;
        const gs = gameManager.handleTrumpSelection(roomId, playerIndex, selAction, suit as Suit);
        if (!gs) return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      case 'bid': {
        const { roomId, playerIndex, bidAction, value, suit } = body;
        const gs = gameManager.handleBid(roomId, playerIndex, bidAction, value, suit as Suit);
        if (!gs) return NextResponse.json({ error: 'Enchère invalide' }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      case 'play_card': {
        const { roomId, playerIndex, cardId } = body;
        const gs = gameManager.handlePlayCard(roomId, playerIndex, cardId);
        if (!gs) return NextResponse.json({ error: 'Coup invalide' }, { status: 400 });
        return NextResponse.json({ success: true });
      }

      case 'chat': {
        const { roomId, sender, text } = body;
        if (!roomId || !sender || !text) {
          return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
        }
        const msg = gameManager.addChatMessage(roomId, sender, text);
        return NextResponse.json({ message: msg });
      }

      case 'get_chat': {
        const { roomId } = body;
        const messages = gameManager.getChat(roomId);
        return NextResponse.json({ messages });
      }

      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }
  } catch (err) {
    console.error('Game API error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

/** Masque les mains des autres joueurs */
function sanitizeGameState(gs: import('@/lib/belote/types').GameState, playerId: string) {
  return {
    ...gs,
    players: gs.players.map(p => ({
      ...p,
      hand: p.id === playerId ? p.hand : Array.from({ length: p.hand.length }, () => ({ id: 'hidden', suit: 'hidden', rank: 'hidden' })),
    })),
  };
}
