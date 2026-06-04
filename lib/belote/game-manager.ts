// Gestionnaire d'état du jeu côté serveur — Version Premium
import {
  Room, GameState, GameMode, Player, Suit, Trick, Card,
  BiddingState, TrumpSelection, GamePhase
} from './types';
import {
  createDeck, shuffleDeck, dealCards, determineTrickWinner,
  calculateRoundPoints, getPlayableCards, hasBeloteRebelote, getCardValue
} from './engine';
import { aiChooseCard, aiChooseBid, aiChooseTrump, createAIMemory, updateMemory } from './ai';
import { detectAnnouncements, resolveAnnouncements, Announcement } from './announcements';

// Noms des bots IA
const BOT_NAMES = ['Aria', 'Nova', 'Solal', 'Echo', 'Luna', 'Orion'];

// Messages de chat
export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

class GameManager {
  rooms: Map<string, Room> = new Map();
  playerToRoom: Map<string, string> = new Map();
  // Reconnexion par pseudo
  pseudoToPlayer: Map<string, string> = new Map(); // pseudo -> playerId
  // Chat par salon
  roomChats: Map<string, ChatMessage[]> = new Map();
  // IA mémoire par partie
  aiMemories: Map<string, ReturnType<typeof createAIMemory>> = new Map();
  // Annonces par partie
  gameAnnouncements: Map<string, Announcement[]> = new Map();

  generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /** Crée un salon — avec option de remplir par des bots */
  createRoom(playerId: string, playerName: string, mode: GameMode, isPrivate: boolean, targetScore: number, fillBots?: boolean): Room {
    // Enregistrer le pseudo pour reconnexion
    this.pseudoToPlayer.set(playerName.toLowerCase(), playerId);

    const room: Room = {
      id: crypto.randomUUID(),
      code: this.generateCode(),
      name: `Partie de ${playerName}`,
      mode,
      isPrivate,
      creatorId: playerId,
      players: [{ id: playerId, name: playerName, ready: false }],
      gameState: null,
      maxPlayers: 4,
      targetScore,
    };
    this.rooms.set(room.id, room);
    this.playerToRoom.set(playerId, room.id);
    this.roomChats.set(room.id, []);

    // Remplir avec des bots si demandé
    if (fillBots) {
      this.fillWithBots(room);
    }

    return room;
  }

  /** Remplit un salon avec des bots IA */
  fillWithBots(room: Room): void {
    let botIdx = 0;
    while (room.players.length < 4) {
      const botName = BOT_NAMES[botIdx % BOT_NAMES.length];
      const botId = `bot_${room.id}_${botIdx}`;
      room.players.push({ id: botId, name: botName, ready: true });
      botIdx++;
    }
  }

  /** Rejoindre un salon */
  joinRoom(roomId: string, playerId: string, playerName: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 4) return null;
    if (room.players.find(p => p.id === playerId)) return room;
    
    this.pseudoToPlayer.set(playerName.toLowerCase(), playerId);
    room.players.push({ id: playerId, name: playerName, ready: false });
    this.playerToRoom.set(playerId, roomId);
    return room;
  }

  /** Reconnexion par pseudo */
  reconnectByPseudo(pseudo: string, newPlayerId: string): { room: Room; playerIndex: number } | null {
    const oldPlayerId = this.pseudoToPlayer.get(pseudo.toLowerCase());
    if (!oldPlayerId) return null;
    
    const roomId = this.playerToRoom.get(oldPlayerId);
    if (!roomId) return null;
    
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Remplacer l'ancien ID par le nouveau
    const playerInRoom = room.players.find(p => p.id === oldPlayerId);
    if (playerInRoom) {
      playerInRoom.id = newPlayerId;
      this.playerToRoom.delete(oldPlayerId);
      this.playerToRoom.set(newPlayerId, roomId);
      this.pseudoToPlayer.set(pseudo.toLowerCase(), newPlayerId);
    }

    // Mettre à jour dans le gameState aussi
    if (room.gameState) {
      const gamePlayer = room.gameState.players.find(p => p.id === oldPlayerId);
      if (gamePlayer) {
        gamePlayer.id = newPlayerId;
        gamePlayer.connected = true;
        const idx = room.gameState.players.indexOf(gamePlayer);
        return { room, playerIndex: idx };
      }
    }

    const idx = room.players.findIndex(p => p.id === newPlayerId);
    return { room, playerIndex: idx };
  }

  /** Quitter un salon */
  leaveRoom(playerId: string): { room: Room | null; destroyed: boolean } {
    const roomId = this.playerToRoom.get(playerId);
    if (!roomId) return { room: null, destroyed: false };
    const room = this.rooms.get(roomId);
    if (!room) return { room: null, destroyed: false };

    if (room.creatorId === playerId && !room.gameState) {
      room.players.forEach(p => this.playerToRoom.delete(p.id));
      this.rooms.delete(roomId);
      this.roomChats.delete(roomId);
      return { room, destroyed: true };
    }

    // Pendant une partie, marquer comme déconnecté mais garder le slot
    if (room.gameState) {
      const player = room.gameState.players.find(p => p.id === playerId);
      if (player) player.connected = false;
      return { room, destroyed: false };
    }

    room.players = room.players.filter(p => p.id !== playerId);
    this.playerToRoom.delete(playerId);
    return { room, destroyed: false };
  }

  /** Chat */
  addChatMessage(roomId: string, sender: string, text: string, isSystem?: boolean): ChatMessage {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender,
      text: text.slice(0, 200),
      timestamp: Date.now(),
      isSystem,
    };
    const chat = this.roomChats.get(roomId) || [];
    chat.push(msg);
    if (chat.length > 100) chat.shift();
    this.roomChats.set(roomId, chat);
    return msg;
  }

  getChat(roomId: string): ChatMessage[] {
    return this.roomChats.get(roomId) || [];
  }

  getPublicRooms(): Room[] {
    return Array.from(this.rooms.values()).filter(r => !r.isPrivate && r.gameState === null);
  }

  getRoomByCode(code: string): Room | null {
    return Array.from(this.rooms.values()).find(r => r.code === code) || null;
  }

  /** Démarre la partie */
  startGame(roomId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length !== 4) return null;

    const players: Player[] = room.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      position: i as 0 | 1 | 2 | 3,
      team: (i % 2) as 0 | 1, // 0&2 = Nous, 1&3 = Eux
      hand: [],
      connected: true,
    }));

    const dealerIndex = 0;
    const gameState: GameState = {
      id: crypto.randomUUID(),
      mode: room.mode,
      phase: 'dealing',
      players,
      dealerIndex,
      currentPlayerIndex: (dealerIndex + 1) % 4,
      trumpSuit: null,
      trumpSelection: null,
      biddingState: null,
      currentTrick: null,
      tricks: [],
      roundScores: [],
      totalScores: [0, 0],
      targetScore: room.targetScore,
      turnedCard: null,
      lastTrickWinner: null,
      beloteAnnounced: [],
      roundNumber: 1,
    };

    // Initialiser la mémoire IA
    this.aiMemories.set(gameState.id, createAIMemory());
    this.gameAnnouncements.set(gameState.id, []);

    this.dealForMode(gameState);
    room.gameState = gameState;

    // Message système
    this.addChatMessage(roomId, 'Système', 'La partie commence ! Bonne chance.', true);

    // Si c'est un bot qui doit jouer en premier, faire jouer l'IA
    this.processBotsIfNeeded(room);

    return gameState;
  }

  /** Distribution selon le mode — RÈGLES OFFICIELLES */
  private dealForMode(gameState: GameState): void {
    const deck = shuffleDeck(createDeck());
    const { dealerIndex } = gameState;
    const order = [0, 1, 2, 3].map(i => (dealerIndex + 1 + i) % 4);

    if (gameState.mode === 'simple') {
      // Mode Simple : 5 cartes → retourne → puis 3 cartes après la prise
      let cardIndex = 0;
      for (const pi of order) {
        // Distribuer par 3 puis 2 (règle classique : 3+2)
        gameState.players[pi].hand = deck.slice(cardIndex, cardIndex + 5);
        cardIndex += 5;
      }
      // La 21ème carte est la retourne
      const turnedCard = deck[20];
      gameState.turnedCard = turnedCard;
      gameState.phase = 'trump_selection';
      gameState.trumpSelection = {
        phase: 'first_round',
        currentPlayerIndex: (dealerIndex + 1) % 4,
        turnedCard,
        selectedSuit: null,
        takerPlayerIndex: null,
        passes: 0,
      };
      gameState.currentPlayerIndex = (dealerIndex + 1) % 4;
    } else {
      // Mode Contrée : 8 cartes à chacun
      let cardIndex = 0;
      for (const pi of order) {
        gameState.players[pi].hand = deck.slice(cardIndex, cardIndex + 8);
        cardIndex += 8;
      }
      gameState.phase = 'bidding';
      gameState.biddingState = {
        bids: [],
        currentPlayerIndex: (dealerIndex + 1) % 4,
        highestBid: null,
        passes: 0,
        isContred: false,
        isRecontred: false,
        contredBy: null,
        recontredBy: null,
        declarerIndex: null,
      };
      gameState.currentPlayerIndex = (dealerIndex + 1) % 4;
    }
  }

  /** Gestion de la sélection d'atout (mode Simple) */
  handleTrumpSelection(roomId: string, playerIndex: number, action: 'take' | 'pass', suit?: Suit): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    const gs = room.gameState;
    const ts = gs.trumpSelection;
    if (!ts || gs.phase !== 'trump_selection') return null;
    if (ts.currentPlayerIndex !== playerIndex) return null;

    if (action === 'pass') {
      ts.passes++;
      if (ts.phase === 'first_round' && ts.passes === 4) {
        ts.phase = 'second_round';
        ts.passes = 0;
        ts.currentPlayerIndex = (gs.dealerIndex + 1) % 4;
      } else if (ts.phase === 'second_round' && ts.passes === 4) {
        // Redistribution
        this.startNewRound(gs);
        this.processBotsIfNeeded(room);
        return gs;
      } else {
        ts.currentPlayerIndex = (ts.currentPlayerIndex + 1) % 4;
      }
      gs.currentPlayerIndex = ts.currentPlayerIndex;
      this.processBotsIfNeeded(room);
      return gs;
    }

    // Prendre
    const turnedCard = ts.turnedCard!;
    if (ts.phase === 'first_round') {
      gs.trumpSuit = turnedCard.suit;
    } else {
      if (!suit || suit === turnedCard.suit) return null;
      gs.trumpSuit = suit;
    }

    ts.takerPlayerIndex = playerIndex;
    ts.selectedSuit = gs.trumpSuit;
    ts.phase = 'done';

    // Compléter la distribution
    this.completeDealSimple(gs, playerIndex);
    
    // Détecter les annonces
    this.detectAllAnnouncements(gs);

    gs.phase = 'playing';
    gs.currentPlayerIndex = (gs.dealerIndex + 1) % 4;
    gs.currentTrick = { cards: [], leaderIndex: gs.currentPlayerIndex, winnerIndex: null };

    this.processBotsIfNeeded(room);
    return gs;
  }

  /** Complète la distribution après prise (mode Simple) */
  private completeDealSimple(gs: GameState, takerIndex: number): void {
    // Recréer le deck pour trouver les cartes restantes
    const deck = shuffleDeck(createDeck());
    const usedIds = new Set<string>();
    gs.players.forEach(p => p.hand.forEach(c => usedIds.add(c.id)));
    if (gs.turnedCard) usedIds.add(gs.turnedCard.id);

    const remaining = deck.filter(c => !usedIds.has(c.id));
    const order = [0, 1, 2, 3].map(i => (gs.dealerIndex + 1 + i) % 4);

    let cardIdx = 0;
    for (const pi of order) {
      if (pi === takerIndex) {
        // Le preneur reçoit la retourne + 2 cartes du talon
        gs.players[pi].hand.push(gs.turnedCard!);
        gs.players[pi].hand.push(remaining[cardIdx++]);
        gs.players[pi].hand.push(remaining[cardIdx++]);
      } else {
        gs.players[pi].hand.push(remaining[cardIdx++]);
        gs.players[pi].hand.push(remaining[cardIdx++]);
        gs.players[pi].hand.push(remaining[cardIdx++]);
      }
    }

    // Vérification : chaque joueur doit avoir exactement 8 cartes
    for (const p of gs.players) {
      if (p.hand.length !== 8) {
        console.error(`ERREUR: Joueur ${p.name} a ${p.hand.length} cartes au lieu de 8!`);
      }
    }
  }

  /** Détecte les annonces de tous les joueurs */
  private detectAllAnnouncements(gs: GameState): void {
    if (!gs.trumpSuit) return;
    const allAnnouncements: Announcement[] = [];
    for (const player of gs.players) {
      const ann = detectAnnouncements(player.hand, player.position, gs.trumpSuit);
      allAnnouncements.push(...ann);
    }
    this.gameAnnouncements.set(gs.id, allAnnouncements);
  }

  /** Gestion des enchères (mode Contrée) */
  handleBid(roomId: string, playerIndex: number, action: 'bid' | 'pass' | 'contre' | 'surcontre', value?: number, suit?: Suit): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    const gs = room.gameState;
    const bs = gs.biddingState;
    if (!bs || gs.phase !== 'bidding') return null;
    if (bs.currentPlayerIndex !== playerIndex) return null;

    if (action === 'bid') {
      if (!value || !suit) return null;
      if (bs.highestBid && value <= bs.highestBid.value) return null;
      if (value < 80 || value > 160 || value % 10 !== 0) return null;
      bs.bids.push({ playerIndex, value, suit });
      bs.highestBid = { playerIndex, value, suit };
      bs.passes = 0;
      bs.isContred = false;
      bs.isRecontred = false;
      bs.currentPlayerIndex = (playerIndex + 1) % 4;
    } else if (action === 'pass') {
      bs.passes++;
      if (!bs.highestBid && bs.passes === 4) {
        this.startNewRound(gs);
        this.processBotsIfNeeded(room);
        return gs;
      }
      if (bs.highestBid && bs.passes === 3) {
        // Enchères terminées
        bs.declarerIndex = bs.highestBid.playerIndex;
        gs.trumpSuit = bs.highestBid.suit;
        gs.phase = 'playing';
        gs.currentPlayerIndex = (gs.dealerIndex + 1) % 4;
        gs.currentTrick = { cards: [], leaderIndex: gs.currentPlayerIndex, winnerIndex: null };
        this.detectAllAnnouncements(gs);
        this.processBotsIfNeeded(room);
        return gs;
      }
      bs.currentPlayerIndex = (playerIndex + 1) % 4;
    } else if (action === 'contre') {
      if (!bs.highestBid || bs.isContred) return null;
      if (playerIndex % 2 === bs.highestBid.playerIndex % 2) return null;
      bs.isContred = true;
      bs.contredBy = playerIndex;
      bs.passes = 0;
      bs.currentPlayerIndex = (playerIndex + 1) % 4;
    } else if (action === 'surcontre') {
      if (!bs.isContred || bs.isRecontred || !bs.highestBid) return null;
      if (playerIndex % 2 !== bs.highestBid.playerIndex % 2) return null;
      bs.isRecontred = true;
      bs.recontredBy = playerIndex;
      bs.passes = 0;
      bs.currentPlayerIndex = (playerIndex + 1) % 4;
    }

    gs.currentPlayerIndex = bs.currentPlayerIndex;
    this.processBotsIfNeeded(room);
    return gs;
  }

  /** Jouer une carte */
  handlePlayCard(roomId: string, playerIndex: number, cardId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    const gs = room.gameState;
    if (gs.phase !== 'playing' || gs.currentPlayerIndex !== playerIndex) return null;
    if (!gs.currentTrick || !gs.trumpSuit) return null;

    const player = gs.players[playerIndex];
    const card = player.hand.find(c => c.id === cardId);
    if (!card) return null;

    // Vérifier que la carte est jouable (règles strictes)
    const playable = getPlayableCards(player.hand, gs.currentTrick, gs.trumpSuit, playerIndex);
    if (!playable.find(c => c.id === cardId)) return null;

    // Retirer et jouer
    player.hand = player.hand.filter(c => c.id !== cardId);
    gs.currentTrick.cards.push({ card, playerIndex });

    // Belote/Rebelote
    this.checkBeloteAnnouncement(gs, playerIndex, card);

    // Pli complet
    if (gs.currentTrick.cards.length === 4) {
      const winnerIndex = determineTrickWinner(gs.currentTrick, gs.trumpSuit);
      gs.currentTrick.winnerIndex = winnerIndex;
      gs.tricks.push(gs.currentTrick);
      gs.lastTrickWinner = winnerIndex;

      // Mettre à jour la mémoire IA
      const memory = this.aiMemories.get(gs.id);
      if (memory) updateMemory(memory, gs.currentTrick, gs.trumpSuit);

      if (gs.tricks.length === 8) {
        this.calculateAndApplyScore(gs, room);
        return gs;
      }

      gs.currentTrick = { cards: [], leaderIndex: winnerIndex, winnerIndex: null };
      gs.currentPlayerIndex = winnerIndex;
    } else {
      gs.currentPlayerIndex = (playerIndex + 1) % 4;
    }

    this.processBotsIfNeeded(room);
    return gs;
  }

  /** Vérifie belote/rebelote */
  private checkBeloteAnnouncement(gs: GameState, playerIndex: number, card: Card): void {
    if (!gs.trumpSuit || card.suit !== gs.trumpSuit) return;
    if (card.rank !== 'king' && card.rank !== 'queen') return;

    const player = gs.players[playerIndex];
    const otherRank = card.rank === 'king' ? 'queen' : 'king';
    const hasOther = player.hand.some(c => c.suit === gs.trumpSuit && c.rank === otherRank) ||
      gs.tricks.some(t => t.cards.some(tc => tc.playerIndex === playerIndex && tc.card.suit === gs.trumpSuit && tc.card.rank === otherRank));

    // On vérifie aussi la carte actuelle du pli en cours (sauf la carte qu'on vient de jouer)
    if (!hasOther) return;

    let entry = gs.beloteAnnounced.find(e => e.playerIndex === playerIndex);
    if (!entry) {
      entry = { playerIndex, announced: [] };
      gs.beloteAnnounced.push(entry);
    }
    const type = entry.announced.length === 0 ? 'belote' : 'rebelote';
    if (!entry.announced.includes(type)) {
      entry.announced.push(type);
    }
  }

  /** Calcul et application du score */
  private calculateAndApplyScore(gs: GameState, room: Room): void {
    if (!gs.trumpSuit) return;
    gs.phase = 'scoring';

    const [team0Raw, team1Raw] = calculateRoundPoints(gs.tricks, gs.trumpSuit);

    // Bonus annonces
    const announcements = this.gameAnnouncements.get(gs.id) || [];
    const team0Ann = announcements.filter(a => a.playerIndex % 2 === 0);
    const team1Ann = announcements.filter(a => a.playerIndex % 2 === 1);
    const { totalPoints: annPoints } = resolveAnnouncements(team0Ann, team1Ann);

    // Bonus belote-rebelote
    let beloteTeam: number | null = null;
    for (const entry of gs.beloteAnnounced) {
      if (entry.announced.includes('belote') && entry.announced.includes('rebelote')) {
        beloteTeam = entry.playerIndex % 2;
        break;
      }
    }

    let team0Score = team0Raw + annPoints[0];
    let team1Score = team1Raw + annPoints[1];
    let contractMet: boolean | null = null;

    if (gs.mode === 'simple') {
      const takerIndex = gs.trumpSelection?.takerPlayerIndex ?? 0;
      const takerTeam = takerIndex % 2;
      const takerPoints = takerTeam === 0 ? team0Score : team1Score;
      const threshold = beloteTeam === takerTeam ? 92 : 82;

      if (takerPoints >= threshold) {
        contractMet = true;
      } else {
        contractMet = false;
        if (takerTeam === 0) { team0Score = 0; team1Score = 162; }
        else { team0Score = 162; team1Score = 0; }
      }
    } else {
      const bs = gs.biddingState;
      if (!bs?.highestBid) return;
      const declarerTeam = bs.highestBid.playerIndex % 2;
      const declarerPoints = declarerTeam === 0 ? team0Raw : team1Raw;
      const contractValue = bs.highestBid.value;

      let multiplier = 1;
      if (bs.isRecontred) multiplier = 4;
      else if (bs.isContred) multiplier = 2;

      if (declarerPoints >= contractValue) {
        contractMet = true;
        const score = contractValue * multiplier;
        if (declarerTeam === 0) { team0Score = score + annPoints[0]; team1Score = team1Raw; }
        else { team0Score = team0Raw; team1Score = score + annPoints[1]; }
      } else {
        contractMet = false;
        const penalty = (contractValue + 10) * multiplier;
        if (declarerTeam === 0) { team0Score = 0; team1Score = penalty; }
        else { team0Score = penalty; team1Score = 0; }
      }
    }

    // Belote toujours comptée
    if (beloteTeam === 0) team0Score += 20;
    else if (beloteTeam === 1) team1Score += 20;

    gs.totalScores[0] += team0Score;
    gs.totalScores[1] += team1Score;

    gs.roundScores.push({
      team0Points: team0Score,
      team1Points: team1Score,
      team0Total: gs.totalScores[0],
      team1Total: gs.totalScores[1],
      contractMet,
      beloteTeam,
    });

    // Chat message
    const roomId = Array.from(this.rooms.entries()).find(([, r]) => r.gameState?.id === gs.id)?.[0];
    if (roomId) {
      this.addChatMessage(roomId, 'Système', `Manche terminée — Nous: ${team0Score} pts | Eux: ${team1Score} pts`, true);
    }

    // Fin de partie ou nouvelle manche
    if (gs.totalScores[0] >= gs.targetScore || gs.totalScores[1] >= gs.targetScore) {
      gs.phase = 'finished';
    } else {
      // Passer en phase scoring avec un timestamp — le client appellera next_round après 2s
      gs.phase = 'scoring';
      (gs as any).scoringTimestamp = Date.now();
    }
  }

  /** Appelé par le client après avoir vu les scores (remplace le setTimeout) */
  handleNextRound(roomId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room?.gameState) return null;
    const gs = room.gameState;
    if (gs.phase !== 'scoring') return gs; // déjà passé
    this.startNewRound(gs);
    this.processBotsIfNeeded(room);
    return gs;
  }

  /** Nouvelle manche */
  startNewRound(gs: GameState): void {
    gs.dealerIndex = (gs.dealerIndex + 1) % 4;
    gs.tricks = [];
    gs.currentTrick = null;
    gs.trumpSuit = null;
    gs.turnedCard = null;
    gs.lastTrickWinner = null;
    gs.beloteAnnounced = [];
    gs.trumpSelection = null;
    gs.biddingState = null;
    gs.roundNumber++;
    this.aiMemories.set(gs.id, createAIMemory());
    this.gameAnnouncements.set(gs.id, []);
    this.dealForMode(gs);
  }

  /** Fait jouer les bots si c'est leur tour */
  processBotsIfNeeded(room: Room): void {
    const gs = room.gameState;
    if (!gs) return;

    const currentPlayer = gs.players[gs.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.id.startsWith('bot_')) return;

    // Délai simulant la réflexion de l'IA
    setTimeout(() => this.botPlay(room), 400);
  }

  /** Action du bot */
  private botPlay(room: Room): void {
    const gs = room.gameState;
    if (!gs) return;

    const playerIndex = gs.currentPlayerIndex;
    const player = gs.players[playerIndex];
    if (!player || !player.id.startsWith('bot_')) return;

    if (gs.phase === 'trump_selection') {
      const tsPhase = gs.trumpSelection?.phase;
      if (tsPhase === 'done') return;
      const decision = aiChooseTrump(player.hand, gs.turnedCard, tsPhase || 'first_round');
      this.handleTrumpSelection(room.id, playerIndex, decision.action, decision.suit);
    } else if (gs.phase === 'bidding') {
      const bs = gs.biddingState;
      const decision = aiChooseBid(
        player.hand,
        bs?.highestBid ? { value: bs.highestBid.value, suit: bs.highestBid.suit } : null,
        playerIndex
      );
      this.handleBid(room.id, playerIndex, decision.action, decision.value, decision.suit);
    } else if (gs.phase === 'playing' && gs.currentTrick && gs.trumpSuit) {
      const memory = this.aiMemories.get(gs.id) || createAIMemory();
      const card = aiChooseCard(player.hand, gs.currentTrick, gs.trumpSuit, playerIndex, memory, gs);
      this.handlePlayCard(room.id, playerIndex, card.id);
    }
  }
}

export const gameManager = new GameManager();
