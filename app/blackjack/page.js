"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';
import PetCard from '@/components/PetCard';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// === DECK LOGIC ===
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const createDeck = () => {
  let deck = [];
  for (let s of SUITS) {
    for (let v of VALUES) {
      deck.push({ suit: s, val: v, color: (s === '♥' || s === '♦') ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'text-gray-800 drop-shadow-[0_0_8px_rgba(0,0,0,0.6)]' });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const calculateScore = (hand) => {
  if(!hand || hand.length === 0) return 0;
  let value = 0;
  let aces = 0;
  hand.forEach(card => {
    if (['J','Q','K'].includes(card.val)) value += 10;
    else if (card.val === 'A') { value += 11; aces += 1; }
    else value += parseInt(card.val);
  });
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
};

// === EPIC VISUAL CARD ===
const PlayingCard = ({ card, hidden = false, index, isSmall = false }) => {
  const baseW = isSmall ? "w-12 h-16 -ml-4 md:w-16 md:h-24 md:-ml-6" : "w-14 h-20 -ml-5 md:w-24 md:h-36 md:-ml-10";
  const textClass = isSmall ? "text-xs md:text-base" : "text-sm md:text-xl";
  const iconClass = isSmall ? "text-xl md:text-3xl" : "text-2xl md:text-5xl";

  if (hidden) {
    return (
      <div className={`${baseW} rounded-lg border-2 border-[#6C63FF]/50 bg-[repeating-linear-gradient(45deg,#1c1f2e,#1c1f2e_10px,#14151f_10px,#14151f_20px)] shadow-[0_0_15px_rgba(108,99,255,0.4)] flex items-center justify-center animate-card-deal relative first:ml-0 group perspective-[1000px] shrink-0`} style={{animationDelay: `${index * 150}ms`, zIndex: index}}>
        <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-[#6C63FF]/50 bg-[#0b0e14] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
          <span className="text-sm md:text-2xl drop-shadow-[0_0_10px_rgba(108,99,255,0.8)]">🃏</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`${baseW} bg-gradient-to-br from-white to-gray-200 rounded-lg border-2 border-white/20 shadow-[0_5px_15px_rgba(0,0,0,0.8)] flex flex-col justify-between p-1 md:p-2 animate-card-deal relative first:ml-0 hover:-translate-y-2 hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-300 cursor-pointer shrink-0`} style={{animationDelay: `${index * 150}ms`, zIndex: index}}>
      <div className={`${textClass} font-black ${card.color} leading-none tracking-tighter`}>{card.val}</div>
      <div className={`${iconClass} text-center self-center ${card.color} animate-pulse-slow`}>{card.suit}</div>
      <div className={`${textClass} font-black ${card.color} leading-none tracking-tighter rotate-180 self-end`}>{card.val}</div>
    </div>
  );
};

export default function BlackjackPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allItemsDb, setAllItemsDb] = useState([]);

  const [gameMode, setGameMode] = useState('lobby'); 

  // PvP / PvE Shared
  const [currency, setCurrency] = useState('green'); 
  const [betAmount, setBetAmount] = useState(10);
  
  // PvE States
  const [gameState, setGameState] = useState('betting'); 
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null); 
  const [aiGameId, setAiGameId] = useState(null);

  // PvP States
  const [pvpLobbyGames, setPvpLobbyGames] = useState([]);
  const [activePvPGame, setActivePvPGame] = useState(null);
  const pvpPayoutProcessed = useRef(false);

  // Winnings Modal (Epic Loot Window)
  const [showWinnings, setShowWinnings] = useState(false);
  const [winningsPayload, setWinningsPayload] = useState(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Inventory / Pets
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [myInventory, setMyInventory] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [botPets, setBotPets] = useState([]); 

  useEffect(() => {
    const fetchInitData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
      }
      
      const { data: items } = await supabase.from('items').select('*');
      if (items) setAllItemsDb(items);

      loadPvPLobby();
      setIsLoading(false);
    };
    fetchInitData();

    // REALTIME MATCHMAKING SUBSCRIPTION
    const lobbySub = supabase.channel('blackjack_lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.blackjack" }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPvpLobbyGames(prev => {
                if (prev.find(b => b.id === payload.new.id)) return prev;
                return [payload.new, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setPvpLobbyGames(prev => prev.map(b => b.id === payload.new.id ? payload.new : b));
            
            setActivePvPGame(prev => {
                if (prev && prev.id === payload.new.id) {
                    return payload.new;
                }
                return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            setPvpLobbyGames(prev => prev.filter(g => g.id !== payload.old.id));
            setActivePvPGame(prev => (prev?.id === payload.old.id ? null : prev));
          }
      }).subscribe();

    return () => { supabase.removeChannel(lobbySub); };
  }, [currentUser?.id]);

  // PvP PAYOUT PROCESSOR
  useEffect(() => {
      const processPvPPayout = async () => {
          if (activePvPGame?.estado === 'completed' && !pvpPayoutProcessed.current) {
              pvpPayoutProcessed.current = true;
              const dp = activePvPGame.datos_partida;
              const isP1 = currentUser?.id === activePvPGame.creador_id;
              const me = isP1 ? dp.p1 : dp.p2;
              
              let isWin = false;
              let isTie = false;
              if (me.score <= 21) {
                  if (dp.dealerScore > 21 || me.score > dp.dealerScore) isWin = true;
                  else if (me.score === dp.dealerScore) isTie = true;
              }

              if (dp.currency === 'green') {
                  if (isWin || isTie) {
                      let ganancia = isWin ? (me.score === 21 && me.hand.length === 2 ? Math.floor(dp.betAmount * 2.5) : dp.betAmount * 2) : dp.betAmount;
                      if (ganancia > 0) {
                          const { data } = await supabase.from('profiles').select('saldo_verde').eq('id', currentUser.id).single();
                          const nuevo = data.saldo_verde + ganancia;
                          await supabase.from('profiles').update({ saldo_verde: nuevo }).eq('id', currentUser.id);
                          setUserProfile(prev => ({...prev, saldo_verde: nuevo}));
                          
                          if (isWin) triggerWinnings('green', ganancia, []);
                      }
                  }
              } else if (dp.currency === 'pets') {
                  // If Pets, DB updates happen via the host/challenger logic, here we just show the modal
                  if (isWin) {
                      const wonItems = [...dp.p1.pets, ...dp.p2.pets];
                      triggerWinnings('pets', 0, wonItems);
                  }
              }
          }
      };
      
      if (activePvPGame?.estado === 'completed') processPvPPayout();
      else pvpPayoutProcessed.current = false;

  }, [activePvPGame, currentUser]);

  const loadPvPLobby = async () => {
    const { data } = await supabase.from('partidas').select('*').eq('modo_juego', 'blackjack').in('estado', ['waiting', 'negotiating', 'host_ready']).order('creado_en', { ascending: false });
    if(data) setPvpLobbyGames(data);
  };

  const greenBalance = userProfile?.saldo_verde || 0;
  const totalPetsValue = selectedPets.reduce((acc, curr) => acc + (curr.valor || curr.value || 0), 0);

  // === AI REAL PET GENERATOR ===
  const generateRealBotPets = (targetValue) => {
      if (!allItemsDb || allItemsDb.length === 0) return [];
      let currentSum = 0;
      let aiSelected = [];
      const itemsValidos = allItemsDb.filter(item => (item.value || 0) > 0);
      let shuffled = [...itemsValidos].sort(() => 0.5 - Math.random());
      
      for (let item of shuffled) {
          if (currentSum + item.value <= targetValue) {
              aiSelected.push({ item_id: item.id, name: item.name, valor: item.value, img: item.image_url, color: item.color || '#ffffff' });
              currentSum += item.value;
          }
      }
      
      if (aiSelected.length === 0 && shuffled.length > 0) {
           let cheapest = [...shuffled].sort((a,b) => a.value - b.value)[0];
           aiSelected.push({ item_id: cheapest.id, name: cheapest.name, valor: cheapest.value, img: cheapest.image_url, color: cheapest.color || '#ffffff' });
      }
      return aiSelected;
  };

  // ==========================================
  // PVE LOGIC (VS AI)
  // ==========================================
  const startGameAI = async () => {
    if (!currentUser) return alert("Log in to play.");
    if (currency === 'green' && (betAmount <= 0 || betAmount > greenBalance)) return alert("Invalid Green Coin amount.");
    if (currency === 'pets' && selectedPets.length === 0) return alert("Select pets to bet first.");

    setIsProcessing(true);
    try {
      if (currency === 'green') {
          const nuevoSaldo = greenBalance - betAmount;
          await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);
          setUserProfile(prev => ({ ...prev, saldo_verde: nuevoSaldo }));
      } else {
          const petIds = selectedPets.map(p => p.id); // was inventarioId
          const { error: errDel } = await supabase.from('inventory').delete().in('id', petIds);
          if (errDel) throw new Error("Error locking pets: " + errDel.message);
      }

      const { data: matchData } = await supabase.from('partidas').insert({
          modo_juego: 'blackjack_ai', creador_id: currentUser.id, estado: 'playing',
          datos_partida: { currency, betAmount: currency === 'green' ? betAmount : totalPetsValue, selectedPets, botPets }
      }).select('id').single();
      
      if (matchData) setAiGameId(matchData.id);

      const newDeck = createDeck();
      const pHand = [newDeck.pop(), newDeck.pop()];
      const dHand = [newDeck.pop(), newDeck.pop()];

      setDeck(newDeck); setPlayerHand(pHand); setDealerHand(dHand);
      setGameState('playing'); setWinner(null); setShowWinnings(false);

      if (calculateScore(pHand) === 21) handleGameOverAI('player', pHand, dHand, true);
    } catch (err) { 
        console.error(err); alert("Error placing bet: " + err.message); 
    }
    setIsProcessing(false);
  };

  const hitAI = () => {
    if (gameState !== 'playing' || isProcessing) return;
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setPlayerHand(newHand); setDeck(newDeck);
    if (calculateScore(newHand) > 21) handleGameOverAI('dealer', newHand, dealerHand);
  };

  const standAI = () => {
    if (gameState !== 'playing' || isProcessing) return;
    setGameState('dealerTurn');
    let dHand = [...dealerHand]; let dDeck = [...deck];
    while (calculateScore(dHand) < 17) dHand.push(dDeck.pop());
    setDealerHand(dHand); setDeck(dDeck);
    
    const pScore = calculateScore(playerHand); const dScore = calculateScore(dHand);
    if (dScore > 21 || pScore > dScore) handleGameOverAI('player', playerHand, dHand);
    else if (dScore > pScore) handleGameOverAI('dealer', playerHand, dHand);
    else handleGameOverAI('tie', playerHand, dHand);
  };

  const handleGameOverAI = async (result, pHand, dHand, isBlackjack = false) => {
    setGameState('gameOver'); setWinner(result); setIsProcessing(true);
    try {
      if (currency === 'green') {
          let ganancia = 0;
          if (result === 'player') ganancia = isBlackjack ? Math.floor(betAmount * 2.5) : betAmount * 2;
          else if (result === 'tie') ganancia = betAmount; 
          
          if (ganancia > 0) {
            const saldoRecuperado = userProfile.saldo_verde + ganancia;
            await supabase.from('profiles').update({ saldo_verde: saldoRecuperado }).eq('id', currentUser.id);
            setUserProfile(prev => ({ ...prev, saldo_verde: saldoRecuperado }));
            if (result === 'player') triggerWinnings('green', ganancia, []);
          }
      } else {
          if (result === 'player') {
              const inserts = [];
              selectedPets.forEach(p => inserts.push({ user_id: currentUser.id, item_id: p.item_id }));
              botPets.forEach(p => inserts.push({ user_id: currentUser.id, item_id: p.item_id }));
              await supabase.from('inventory').insert(inserts);
              
              triggerWinnings('pets', 0, [...selectedPets, ...botPets]);

              const nuevoRojo = (userProfile.saldo_rojo || 0) + botPets.reduce((acc, curr) => acc + (curr.valor || curr.value || 0), 0);
              await supabase.from('profiles').update({ saldo_rojo: nuevoRojo }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_rojo: nuevoRojo}));
          } else if (result === 'tie') {
              await supabase.from('inventory').insert(selectedPets.map(p => ({ user_id: currentUser.id, item_id: p.item_id })));
          } else if (result === 'dealer') {
              const nuevoRojo = Math.max(0, (userProfile.saldo_rojo || 0) - selectedPets.reduce((acc, curr) => acc + (curr.valor || curr.value || 0), 0));
              await supabase.from('profiles').update({ saldo_rojo: nuevoRojo }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_rojo: nuevoRojo}));
          }
      }
      if (aiGameId) await supabase.from('partidas').update({ estado: 'completed', resultado: result }).eq('id', aiGameId);
    } catch (err) { console.error("Error paying AI game:", err); }
    setIsProcessing(false);
  };


  // ==========================================
  // MULTIPLAYER (PvP) LOGIC
  // ==========================================
  
  const createPvPGame = async () => {
      if (!currentUser) return alert("Log in to play.");
      setIsProcessing(true);
      try {
          const datosPartida = {
              currency: 'none',
              betAmount: 0,
              p1: { id: currentUser.id, name: userProfile.username || 'Host', avatar: userProfile.avatar_url || '/default-avatar.png', hand: [], score: 0, status: 'waiting', pets: [] },
              p2: null,
              dealerHand: [],
              dealerScore: 0,
              currentTurn: 'waiting',
              deck: []
          };
          const { data: newRoom, error } = await supabase.from('partidas').insert({
              modo_juego: 'blackjack', creador_id: currentUser.id, apuesta_creador: [], datos_partida: datosPartida, estado: 'waiting'
          }).select().single();
          if (error) throw error;
          setActivePvPGame(newRoom);
      } catch(err) { alert("Error: " + err.message); }
      setIsProcessing(false);
  };

  const joinPvPGame = async (gameToJoin) => {
      if(!currentUser) return alert("Log in first.");
      setIsProcessing(true);
      try {
          const dp = {
              ...gameToJoin.datos_partida,
              p2: { id: currentUser.id, name: userProfile.username || 'Challenger', avatar: userProfile.avatar_url || '/default-avatar.png', hand: [], score: 0, status: 'waiting', pets: [] },
          };
          const { data: activeRoom, error } = await supabase.from('partidas').update({
              retador_id: currentUser.id, apuesta_retador: [], datos_partida: dp, estado: 'negotiating'
          }).eq('id', gameToJoin.id).select().single();
          if (error) throw error;
          setActivePvPGame(activeRoom);
      } catch(err) { alert("Join Error: " + err.message); }
      setIsProcessing(false);
  };

  const hostProposeBet = async () => {
      if (currency === 'green' && (betAmount <= 0 || betAmount > greenBalance)) return alert("Invalid Green Coin amount.");
      if (currency === 'pets' && selectedPets.length === 0) return alert("Select pets to bet.");
      setIsProcessing(true);
      try {
          if (currency === 'green') {
              const nuevoSaldo = greenBalance - betAmount;
              await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_verde: nuevoSaldo}));
          } else {
              const petIds = selectedPets.map(p => p.id);
              await supabase.from('inventory').delete().in('id', petIds);
          }

          const dp = { ...activePvPGame.datos_partida, currency: currency, betAmount: currency === 'green' ? betAmount : totalPetsValue };
          dp.p1.pets = currency === 'pets' ? selectedPets : [];

          const { data: activeRoom, error } = await supabase.from('partidas').update({
              datos_partida: dp, estado: 'host_ready'
          }).eq('id', activePvPGame.id).select().single();
          if (error) throw error;
          setActivePvPGame(activeRoom);
      } catch(err) { alert("Error proposing bet: " + err.message); }
      setIsProcessing(false);
  };

  const challengerAcceptBetAndDeal = async () => {
      const requiredBet = activePvPGame.datos_partida.betAmount;
      const cur = activePvPGame.datos_partida.currency;

      if (cur === 'green' && greenBalance < requiredBet) return alert("You don't have enough Green Coins to match this bet.");
      if (cur === 'pets' && totalPetsValue < requiredBet * 0.98) return alert("Your pets value must match the Host's bet.");

      setIsProcessing(true);
      try {
          if (cur === 'green') {
              const nuevoSaldo = greenBalance - requiredBet;
              await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_verde: nuevoSaldo}));
          } else {
              const petIds = selectedPets.map(p => p.id);
              await supabase.from('inventory').delete().in('id', petIds);
              // Store pets in inventory temporarily (if needed, but usually handled in payout)
          }

          const freshDeck = createDeck(); 
          const dp = { ...activePvPGame.datos_partida, deck: freshDeck, currentTurn: 'p1' };
          dp.p2.pets = cur === 'pets' ? selectedPets : [];
          
          dp.p1.hand = [freshDeck.pop(), freshDeck.pop()];
          dp.p2.hand = [freshDeck.pop(), freshDeck.pop()];
          dp.dealerHand = [freshDeck.pop(), freshDeck.pop()]; 
          dp.p1.score = calculateScore(dp.p1.hand);
          dp.p2.score = calculateScore(dp.p2.hand);
          
          if (dp.p1.score === 21) dp.p1.status = 'stand';
          if (dp.p2.score === 21) dp.p2.status = 'stand';

          if (dp.p1.status === 'stand' && dp.p2.status === 'stand') dp.currentTurn = 'dealer';
          else if (dp.p1.status === 'stand') dp.currentTurn = 'p2';

          const { data: activeRoom, error } = await supabase.from('partidas').update({
              datos_partida: dp, estado: 'playing'
          }).eq('id', activePvPGame.id).select().single();
          if (error) throw error;
          setActivePvPGame(activeRoom);
      } catch(err) { alert("Error matching bet: " + err.message); }
      setIsProcessing(false);
  };

  const leaveTable = async () => {
      if (!activePvPGame) return;
      if (activePvPGame.estado === 'host_ready' && currentUser.id === activePvPGame.creador_id) {
          const cur = activePvPGame.datos_partida.currency;
          if (cur === 'green') {
              const refund = greenBalance + activePvPGame.datos_partida.betAmount;
              await supabase.from('profiles').update({ saldo_verde: refund }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_verde: refund}));
          } else {
              const inserts = activePvPGame.datos_partida.p1.pets.map(p => ({ user_id: currentUser.id, item_id: p.item_id }));
              await supabase.from('inventory').insert(inserts);
          }
      }
      
      if (activePvPGame.estado !== 'playing') {
          await supabase.from('partidas').delete().eq('id', activePvPGame.id);
      }
      setActivePvPGame(null);
  };

  const handlePvPAction = async (action) => {
      setIsProcessing(true);
      try {
          let dp = { ...activePvPGame.datos_partida };
          let isP1 = currentUser.id === activePvPGame.creador_id;
          let pKey = isP1 ? 'p1' : 'p2';
          let me = dp[pKey];

          if (action === 'hit') {
              me.hand.push(dp.deck.pop());
              me.score = calculateScore(me.hand);
              if (me.score > 21) {
                  me.status = 'bust';
                  if (isP1) dp.currentTurn = dp.p2.status !== 'stand' && dp.p2.status !== 'bust' ? 'p2' : 'dealer';
                  else dp.currentTurn = 'dealer';
              }
          } else if (action === 'stand') {
              me.status = 'stand';
              if (isP1) dp.currentTurn = dp.p2.status !== 'stand' && dp.p2.status !== 'bust' ? 'p2' : 'dealer';
              else dp.currentTurn = 'dealer';
          }

          if (dp.currentTurn === 'dealer') {
              let dHand = [...dp.dealerHand];
              if (dp.p1.status !== 'bust' || dp.p2.status !== 'bust') {
                 while(calculateScore(dHand) < 17) dHand.push(dp.deck.pop());
              }
              dp.dealerHand = dHand;
              dp.dealerScore = calculateScore(dHand);
              dp.currentTurn = 'gameOver';
          }

          // If pets, we need to handle the inventory transfer here for PvP.
          // Wait, Realtime payout is cleaner if we just process it there. 
          // But DB inserts need to be authorized. So let the last person acting do it.
          if (dp.currentTurn === 'gameOver' && dp.currency === 'pets') {
               let winnerKey = null;
               const p1Win = dp.p1.score <= 21 && (dp.dealerScore > 21 || dp.p1.score > dp.dealerScore);
               const p2Win = dp.p2.score <= 21 && (dp.dealerScore > 21 || dp.p2.score > dp.dealerScore);
               
               // Basic logic for PvP Pets: whoever wins against dealer gets ALL pets.
               // If both win, it's complex. Usually PvP Blackjack means competing against each other or dealer?
               // Assuming standard Casino PvP: players play against Dealer independently.
               // If player 1 wins, he gets his pets matched. If player 2 wins, he gets his.
               // BUT this is a 1v1 bet. The winner should be the one who beats the other, or beats dealer best.
               
               // To keep it simple: Host vs Challenger. Best score without busting wins pot.
               let p1Valid = dp.p1.score <= 21 ? dp.p1.score : 0;
               let p2Valid = dp.p2.score <= 21 ? dp.p2.score : 0;

               if (p1Valid > p2Valid) winnerKey = 'p1';
               else if (p2Valid > p1Valid) winnerKey = 'p2';
               
               if (winnerKey) {
                   const winnerId = winnerKey === 'p1' ? activePvPGame.creador_id : activePvPGame.retador_id;
                   const wonItems = [...dp.p1.pets, ...dp.p2.pets];
                   const inserts = wonItems.map(p => ({ user_id: winnerId, item_id: p.item_id }));
                   await supabase.from('inventory').insert(inserts);
               } else {
                   // Tie - return pets to original owners
                   const p1Inserts = dp.p1.pets.map(p => ({ user_id: activePvPGame.creador_id, item_id: p.item_id }));
                   const p2Inserts = dp.p2.pets.map(p => ({ user_id: activePvPGame.retador_id, item_id: p.item_id }));
                   await supabase.from('inventory').insert([...p1Inserts, ...p2Inserts]);
               }
          }

          await supabase.from('partidas').update({ datos_partida: dp, estado: dp.currentTurn === 'gameOver' ? 'completed' : 'playing' }).eq('id', activePvPGame.id);
      } catch (e) { console.error(e) }
      setIsProcessing(false);
  };

  const getPvPResultMsg = () => {
      if (!activePvPGame) return '';
      const dp = activePvPGame.datos_partida;
      const isP1 = currentUser?.id === activePvPGame.creador_id;
      const me = isP1 ? dp.p1 : dp.p2;

      if (me.score > 21) return 'You Busted! (Lose)';
      if (dp.dealerScore > 21) return 'Dealer Busts! You Win!';
      if (me.score > dp.dealerScore) return 'You Win!';
      if (me.score === dp.dealerScore) return 'Push (Tie)';
      return 'You Lose';
  };

  // ==========================================
  // INVENTORY MODAL & WINNINGS
  // ==========================================
  const triggerWinnings = (type, amount, items) => {
      setWinningsPayload({ type, amount, items });
      setShowWinnings(true);
  };

  const handleClaimLoot = () => {
      setIsClaiming(true);
      setTimeout(() => {
          setShowWinnings(false);
          setIsClaiming(false);
          setWinningsPayload(null);
          if(gameMode === 'lobby') setGameMode('lobby'); // Reset view if needed
      }, 800);
  };

  const openInventoryModal = async () => {
      if (!currentUser) return alert("Log in to play.");
      setIsInventoryOpen(true);
      const { data, error } = await supabase.from('inventory').select(`id, is_locked, items ( id, name, value, image_url, color )`).eq('user_id', currentUser.id).eq('is_locked', false);
      if (data && !error) {
          const mascotas = data.map(inv => ({ 
              id: inv.id, item_id: inv.items.id, name: inv.items.name, valor: inv.items.value, img: inv.items.image_url, color: inv.items.color 
          }));
          setMyInventory(mascotas.sort((a,b) => b.valor - a.valor));
      }
  };

  const togglePetSelection = (pet) => {
      if (selectedPets.find(p => p.id === pet.id)) setSelectedPets(prev => prev.filter(p => p.id !== pet.id));
      else setSelectedPets(prev => [...prev, pet]);
  };

  const confirmPets = () => {
      setIsInventoryOpen(false);
      if (gameMode === 'ai') setBotPets(generateRealBotPets(totalPetsValue));
  };

  if (isLoading) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Setting up the table...</p>
    </div>
  );

  const isHost = activePvPGame?.creador_id === currentUser?.id;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans overflow-hidden relative flex flex-col items-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-[#6C63FF]/20 via-[#22c55e]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      {/* ========================================== */}
      {/* EPIC LOOT MODAL (WINNINGS) */}
      {/* ========================================== */}
      {showWinnings && winningsPayload && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#facc1540_0%,_transparent_60%)] animate-pulse"></div>

              <div className={`relative bg-[#141323] border-4 border-[#facc15] rounded-3xl p-6 md:p-10 max-w-5xl w-full flex flex-col items-center shadow-[0_0_80px_rgba(250,204,21,0.4)] transition-all duration-700 ${isClaiming ? 'scale-50 opacity-0 translate-y-full blur-md' : 'scale-100 opacity-100'}`}>
                  
                  <h2 className="text-5xl md:text-6xl font-black text-[#facc15] uppercase tracking-widest mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] animate-bounce">
                      Victory!
                  </h2>
                  <p className="text-[#8f9ac6] mb-8 font-bold text-center text-lg md:text-xl">
                      You beat the Dealer. These rewards are yours:
                  </p>

                  {winningsPayload.type === 'green' ? (
                      <div className="flex flex-col items-center justify-center bg-[#0b0e14] border border-[#252839] p-10 rounded-2xl w-full max-w-md shadow-inner mb-8">
                          <GreenCoin cls="w-32 h-32 mb-4 animate-pulse-slow drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]" />
                          <span className="text-5xl font-black text-[#22c55e] drop-shadow-md">+{formatValue(winningsPayload.amount)}</span>
                      </div>
                  ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 w-full max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                          {winningsPayload.items.map((item, idx) => (
                              <PetCard 
                                  key={idx} 
                                  item={item} 
                                  showValue={true} 
                              />
                          ))}
                      </div>
                  )}

                  <button 
                      onClick={handleClaimLoot} 
                      className="mt-10 bg-gradient-to-r from-[#facc15] to-[#ca8a04] hover:from-[#fde047] hover:to-[#eab308] text-[#0b0e14] font-black px-12 md:px-16 py-4 md:py-5 rounded-2xl text-xl md:text-2xl uppercase tracking-widest transition-transform hover:scale-110 shadow-[0_0_30px_rgba(250,204,21,0.6)] flex items-center gap-3"
                  >
                      {isClaiming ? 'Claiming...' : 'Claim to Backpack 🎒'}
                  </button>
              </div>
          </div>
      )}

      {/* ========================================== */}
      {/* INVENTORY MODAL (USING PETCARD) */}
      {/* ========================================== */}
      {isInventoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14151f] border border-[#252839] rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl animate-bounce-in">
            <div className="p-4 md:p-6 border-b border-[#252839] flex justify-between items-center bg-[#0b0e14] rounded-t-2xl">
              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white">Select Pets</h2>
                {activePvPGame?.estado === 'host_ready' && !isHost && <p className="text-[#ef4444] text-xs md:text-sm mt-1 font-bold">Match Host's Bet of {formatValue(activePvPGame.datos_partida.betAmount)} to Start!</p>}
              </div>
              <button onClick={() => setIsInventoryOpen(false)} className="text-[#4a506b] hover:text-white transition-colors text-3xl">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              {myInventory.length === 0 ? (
                <div className="text-center py-20 text-[#555b82] font-bold">Your inventory is empty or locked.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {myInventory.map(pet => (
                      <PetCard 
                          key={pet.id} 
                          item={pet} 
                          selectable={true}
                          isSelected={selectedPets.some(p => p.id === pet.id)}
                          onClick={() => togglePetSelection(pet)}
                      />
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 md:p-6 border-t border-[#252839] bg-[#0b0e14] rounded-b-2xl flex justify-between items-center">
              <div>
                <p className="text-[#555b82] text-[10px] md:text-xs font-black uppercase tracking-widest">Total Bet Value</p>
                <p className="text-xl md:text-2xl font-black text-[#ef4444] flex items-center gap-2"><RedCoin cls="w-5 h-5 md:w-6 md:h-6"/> {formatValue(totalPetsValue)}</p>
              </div>
              <button onClick={confirmPets} disabled={selectedPets.length === 0} className="px-6 md:px-8 py-3 rounded-xl bg-[#ef4444] hover:bg-red-600 text-white font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 transition-all text-xs md:text-base">
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER TABS */}
      {!activePvPGame && (
          <div className="w-full max-w-[1200px] mb-8 relative z-10 flex justify-center animate-fade-in">
             <div className="bg-[#14151f] p-1.5 rounded-2xl border border-[#252839] flex gap-2 shadow-lg">
                <button onClick={() => setGameMode('ai')} className={`px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm transition-all ${gameMode === 'ai' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}>
                    Vs AI (PvE)
                </button>
                <button onClick={() => setGameMode('lobby')} className={`px-6 md:px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs md:text-sm transition-all ${gameMode === 'lobby' ? 'bg-[#22c55e] text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}>
                    PvP Lobby
                </button>
             </div>
          </div>
      )}

      <div className={`w-full max-w-[1200px] relative z-10 flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8`}>
        
        {/* ================= LEFT PANEL (CONTROLS/LOBBY) ================= */}
        {!activePvPGame && (
          <div className="order-2 lg:order-1 lg:col-span-1 bg-[#14151f]/90 backdrop-blur-md border border-[#252839] rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col relative overflow-hidden animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6C63FF]/5 to-transparent pointer-events-none"></div>
            
            <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 text-center drop-shadow-md relative z-10">
              Blackjack 21
            </h2>

            {/* PVE CONTROLS */}
            {gameMode === 'ai' && (
                <>
                    <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-3 md:p-4 mb-6 shadow-inner relative z-10">
                      <p className="text-[#8f9ac6] font-bold uppercase text-[10px] md:text-xs tracking-wider mb-2">Currency</p>
                      <div className="flex bg-[#1c1f2e] p-1 rounded-lg">
                        <button disabled={gameState !== 'betting'} onClick={() => setCurrency('green')} className={`flex-1 py-2 rounded-md font-black text-xs md:text-sm uppercase flex items-center justify-center gap-1 md:gap-2 transition-all ${currency === 'green' ? 'bg-[#22c55e]/20 border border-[#22c55e]/50 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'text-[#555b82] hover:text-white'}`}>
                          <GreenCoin /> Green
                        </button>
                        <button disabled={gameState !== 'betting'} onClick={() => { setCurrency('pets'); if(gameState==='betting') openInventoryModal(); }} className={`flex-1 py-2 rounded-md font-black text-xs md:text-sm uppercase flex items-center justify-center gap-1 md:gap-2 transition-all ${currency === 'pets' ? 'bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-[#555b82] hover:text-white'}`}>
                          <RedCoin /> Pets
                        </button>
                      </div>
                    </div>

                    {currency === 'green' ? (
                        <div className="mb-6 relative z-10">
                          <label className="text-[#8f9ac6] font-bold uppercase text-[10px] md:text-xs tracking-wider mb-2 flex justify-between">
                              <span>Bet Amount</span>
                              <span>Balance: <GreenCoin cls="w-3 h-3 inline"/> {formatValue(greenBalance)}</span>
                          </label>
                          <div className="flex bg-[#0b0e14] border border-[#252839] rounded-xl overflow-hidden transition-all focus-within:border-[#22c55e] focus-within:shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                            <div className="pl-3 md:pl-4 flex items-center justify-center bg-[#1c1f2e] border-r border-[#252839]"><GreenCoin cls="w-4 h-4 md:w-5 md:h-5"/></div>
                            <input type="number" disabled={gameState !== 'betting' || isProcessing} value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="w-full bg-transparent text-white font-bold p-2 md:p-3 outline-none text-sm md:text-base" />
                            <button onClick={() => setBetAmount(greenBalance)} disabled={gameState !== 'betting'} className="px-3 md:px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-black text-xs text-[#22c55e] transition-colors">MAX</button>
                          </div>
                        </div>
                    ) : (
                        <div className="mb-6 relative z-10 bg-[#0b0e14] border border-[#252839] rounded-xl p-3 md:p-4 text-center">
                            <p className="text-[#8f9ac6] font-bold uppercase text-[10px] md:text-xs mb-2">Your Pet Bet</p>
                            {selectedPets.length > 0 ? (
                                <div className="flex justify-center flex-wrap gap-2 mb-2">
                                    {selectedPets.slice(0,3).map((p,i) => <img key={i} src={p.img} className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" />)}
                                    {selectedPets.length > 3 && <span className="text-[#555b82] text-[10px] font-black self-center">+{selectedPets.length-3}</span>}
                                </div>
                            ) : (
                                <p className="text-[#555b82] text-[10px] md:text-xs mb-3">No pets selected.</p>
                            )}
                            <div className="text-lg md:text-xl font-black text-[#ef4444] mb-3 flex items-center justify-center gap-1"><RedCoin /> {formatValue(totalPetsValue)}</div>
                            
                            {gameState === 'betting' && botPets.length > 0 && (
                                <div className="mt-4 p-3 bg-[#1c1f2e] border border-[#ef4444]/30 rounded-xl shadow-inner">
                                    <p className="text-[#ef4444] text-[10px] uppercase font-black mb-2 flex items-center justify-center gap-1">🤖 AI is matching with:</p>
                                    <div className="flex justify-center flex-wrap gap-2">
                                        {botPets.slice(0,3).map((p,i) => <img key={i} src={p.img} className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" title={p.name}/>)}
                                        {botPets.length > 3 && <span className="text-[#555b82] text-[10px] font-black self-center">+{botPets.length-3}</span>}
                                    </div>
                                </div>
                            )}

                            {gameState === 'betting' && <button onClick={openInventoryModal} className="w-full py-2 mt-3 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest">Edit Pets</button>}
                        </div>
                    )}

                    <div className="mt-auto relative z-10">
                      {gameState === 'betting' ? (
                        <button onClick={startGameAI} disabled={isProcessing} className={`w-full py-4 md:py-5 rounded-2xl font-black text-base md:text-xl text-white uppercase tracking-widest transition-all ${isProcessing ? 'bg-gray-600 opacity-50' : 'bg-[#6C63FF] hover:bg-[#5147D9] shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:scale-105'}`}>
                          {isProcessing ? 'Betting...' : 'Deal Cards'}
                        </button>
                      ) : gameState === 'playing' ? (
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                          <button onClick={hitAI} disabled={isProcessing} className="py-3 md:py-4 bg-[#252839] hover:bg-[#2F3347] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md hover:-translate-y-1 transition-all text-xs md:text-base">Hit</button>
                          <button onClick={standAI} disabled={isProcessing} className="py-3 md:py-4 bg-gradient-to-r from-[#ef4444] to-[#b91c1c] rounded-xl font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:-translate-y-1 transition-all text-xs md:text-base">Stand</button>
                        </div>
                      ) : (
                        <button onClick={() => {setGameState('betting'); setPlayerHand([]); setDealerHand([]); setBotPets([]); setSelectedPets([]);}} className="w-full py-3 md:py-4 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md transition-all text-xs md:text-base">New Round</button>
                      )}
                    </div>
                </>
            )}

            {/* PVP LOBBY */}
            {gameMode === 'lobby' && (
                <div className="flex flex-col h-full relative z-10">
                    <div className="flex flex-col gap-4 mb-6">
                        <div className="text-center">
                            <p className="text-[#8f9ac6] text-xs font-bold mb-1">Create an empty table</p>
                            <button onClick={createPvPGame} disabled={isProcessing} className="w-full py-4 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] text-black font-black uppercase text-sm rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105 transition-all">
                                Open New Table
                            </button>
                        </div>
                    </div>
                    
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4 border-t border-[#252839] pt-6"><span className="text-xl">🌍</span> Live Tables</h3>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 min-h-[200px]">
                        {pvpLobbyGames.length === 0 ? (
                            <div className="text-center py-10 text-[#555b82] font-bold text-xs md:text-sm uppercase bg-[#0b0e14] border border-[#252839] border-dashed rounded-xl">No tables available. Be the first!</div>
                        ) : (
                            pvpLobbyGames.map(game => (
                                <div key={game.id} className="bg-[#0b0e14] border border-[#252839] p-3 md:p-4 rounded-xl flex items-center justify-between hover:border-[#6C63FF]/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={game.datos_partida.p1.avatar} className="w-10 h-10 rounded-full border-2 border-[#252839]" />
                                            {game.estado === 'waiting' && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0b0e14] animate-pulse"></div>}
                                            {game.estado !== 'waiting' && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border-2 border-[#0b0e14]"></div>}
                                        </div>
                                        <div>
                                            <p className="text-xs md:text-sm font-bold text-white line-clamp-1">{game.datos_partida.p1.name}'s Table</p>
                                            <p className="text-[10px] md:text-xs font-black text-[#555b82] uppercase mt-0.5">
                                                {game.estado === 'waiting' ? 'Waiting for Challenger' : 'Match in progress'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => joinPvPGame(game)} disabled={game.creador_id === currentUser?.id || game.estado !== 'waiting' || isProcessing} className="px-4 py-2 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] text-white font-black uppercase text-[10px] md:text-xs rounded-lg disabled:opacity-50 transition-all group-hover:border-[#6C63FF]/50">
                                        {game.creador_id === currentUser?.id ? 'My Table' : game.estado === 'waiting' ? 'Sit Down' : 'Full'}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
          </div>
        )}

        {/* ================= RIGHT/CENTER PANEL (THE TABLE) ================= */}
        <div className={`order-1 lg:order-2 bg-gradient-to-b from-[#0f111a] to-[#14151f] border-2 border-[#252839] rounded-3xl p-4 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative min-h-[400px] overflow-hidden animate-fade-in ${activePvPGame ? 'lg:col-span-3 min-h-[80vh]' : 'lg:col-span-2'}`}>
          <div className="absolute inset-2 md:inset-4 border-2 border-dashed border-[#6C63FF]/20 rounded-2xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl md:text-[200px] opacity-5 grayscale pointer-events-none">🃏</div>

          {/* === PVE TABLE === */}
          {!activePvPGame && (
              <>
                  <div className="relative z-10 w-full mb-6 md:mb-8">
                    <div className="flex justify-between items-end mb-3 md:mb-4 flex-wrap gap-2">
                      <span className="px-3 md:px-4 py-1 bg-[#1c1f2e] border border-[#252839] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-md flex items-center gap-1 md:gap-2">
                        🤖 AI Dealer {gameState === 'gameOver' && <span className="text-[#ef4444]">({calculateScore(dealerHand)})</span>}
                      </span>
                      {currency === 'pets' && botPets.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 md:gap-2 bg-[#0b0e14] border border-[#252839] px-2 md:px-3 py-1 rounded-lg animate-fade-in">
                              <span className="text-[8px] md:text-[10px] text-[#555b82] uppercase font-black">AI Bets:</span>
                              <div className="flex gap-1">
                                  {botPets.map((p,i) => <img key={i} src={p.img} className="w-5 h-5 md:w-6 md:h-6 object-contain"/>)}
                              </div>
                              <span className="text-[#ef4444] font-black text-[10px] md:text-xs ml-1 flex items-center gap-1"><RedCoin cls="w-2 h-2 md:w-3 md:h-3"/> {formatValue(botPets.reduce((a,c)=>a+(c.valor||c.value||0),0))}</span>
                          </div>
                      )}
                    </div>
                    
                    <div className="flex justify-center min-h-[100px] md:min-h-[144px]">
                      {dealerHand.length === 0 ? (
                          <div className="text-[#555b82] text-xs md:text-sm uppercase tracking-widest font-black self-center bg-[#0b0e14] px-6 py-3 rounded-xl border border-[#252839] border-dashed">Waiting for bets...</div>
                      ) : (
                          dealerHand.map((card, idx) => (
                            <PlayingCard key={`dealer-${idx}`} card={card} index={idx} hidden={idx === 1 && gameState === 'playing'} />
                          ))
                      )}
                    </div>
                  </div>

                  <div className="relative z-20 h-16 md:h-20 flex items-center justify-center">
                    {gameState === 'gameOver' && (
                      <div className={`px-6 md:px-10 py-2 md:py-3 rounded-2xl border-2 backdrop-blur-md shadow-2xl animate-bounce-in ${winner === 'player' ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e] shadow-[0_0_30px_rgba(34,197,94,0.4)]' : winner === 'dealer' ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-gray-500/20 border-gray-400 text-gray-300'}`}>
                        <h3 className="text-xl md:text-3xl font-black uppercase tracking-widest text-center">
                          {winner === 'player' ? 'You Win!' : winner === 'dealer' ? 'You Lose' : 'Push (Tie)'}
                        </h3>
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 w-full mt-6 md:mt-8">
                    <div className="flex justify-center min-h-[100px] md:min-h-[144px] mb-3 md:mb-4">
                      {playerHand.map((card, idx) => (
                        <PlayingCard key={`player-${idx}`} card={card} index={idx} />
                      ))}
                    </div>
                    {playerHand.length > 0 && (
                        <div className="flex justify-center">
                          <span className={`px-4 md:px-6 py-1.5 md:py-2 border rounded-full text-sm md:text-lg font-black uppercase tracking-widest transition-colors shadow-lg ${calculateScore(playerHand) > 21 ? 'bg-red-500/20 border-red-500 text-red-500' : calculateScore(playerHand) === 21 ? 'bg-[#6C63FF]/20 border-[#6C63FF] text-[#6C63FF] shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'bg-[#1c1f2e] border-[#252839] text-white'}`}>
                            You ({calculateScore(playerHand)})
                          </span>
                        </div>
                    )}
                  </div>
              </>
          )}

          {/* === PVP TABLE === */}
          {activePvPGame && (
              <div className="relative z-10 w-full flex flex-col h-full animate-fade-in">
                  
                  {/* HEADER SALA PVP */}
                  <div className="flex justify-between items-center bg-[#0b0e14]/80 p-4 rounded-xl border border-[#252839] mb-8 shadow-md">
                      <div>
                          <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">⚔️ VIP Table</h3>
                          <p className="text-[#8f9ac6] text-[10px] md:text-xs font-bold uppercase tracking-widest">
                              {activePvPGame.estado === 'waiting' ? 'Waiting for Challenger...' : activePvPGame.estado === 'negotiating' ? 'Betting Phase' : activePvPGame.estado === 'host_ready' ? 'Waiting for Accept...' : 'Live Match'}
                          </p>
                      </div>
                      <button onClick={leaveTable} className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 rounded-lg font-black text-[10px] md:text-xs uppercase transition-colors">
                          Leave Table
                      </button>
                  </div>

                  {/* FASE DE NEGOCIACIÓN (VS SCREEN) */}
                  {(activePvPGame.estado === 'waiting' || activePvPGame.estado === 'negotiating' || activePvPGame.estado === 'host_ready') && (
                      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 flex-1 w-full max-w-5xl mx-auto">
                          
                          {/* HOST SIDE */}
                          <div className={`flex-1 flex flex-col items-center p-6 md:p-10 rounded-3xl border-2 transition-all w-full ${isHost ? 'bg-[#1c1f2e] border-[#6C63FF] shadow-[0_0_30px_rgba(108,99,255,0.2)]' : 'bg-[#0b0e14] border-[#252839]'}`}>
                              <img src={activePvPGame.datos_partida.p1.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-[#252839] mb-4 object-cover shadow-xl"/>
                              <h3 className="text-xl md:text-2xl font-black text-white uppercase mb-1 text-center w-full truncate">{activePvPGame.datos_partida.p1.name}</h3>
                              <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-8">Table Host</p>

                              {activePvPGame.estado === 'waiting' && isHost && (
                                  <div className="text-center animate-pulse">
                                      <p className="text-[#22c55e] font-black uppercase text-sm mb-2">Table Open!</p>
                                      <p className="text-[#555b82] text-xs font-bold">Waiting for someone to sit down...</p>
                                  </div>
                              )}
                              
                              {(activePvPGame.estado === 'negotiating' || activePvPGame.estado === 'host_ready') && (
                                  <div className="w-full">
                                      <p className="text-center text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-3">Proposed Bet</p>
                                      <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-6 text-center shadow-inner">
                                          {activePvPGame.estado === 'negotiating' && isHost ? (
                                              <div className="flex flex-col gap-4 animate-fade-in">
                                                  <div className="flex bg-[#1c1f2e] p-1 rounded-lg">
                                                      <button onClick={() => setCurrency('green')} className={`flex-1 py-2 rounded-md font-black text-xs uppercase flex items-center justify-center gap-2 transition-all ${currency === 'green' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'text-[#555b82]'}`}><GreenCoin/> Green</button>
                                                      <button onClick={() => {setCurrency('pets'); openInventoryModal();}} className={`flex-1 py-2 rounded-md font-black text-xs uppercase flex items-center justify-center gap-2 transition-all ${currency === 'pets' ? 'bg-[#ef4444]/20 text-[#ef4444]' : 'text-[#555b82]'}`}><RedCoin/> Pets</button>
                                                  </div>
                                                  {currency === 'green' ? (
                                                      <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="w-full bg-[#1c1f2e] text-center text-white font-black p-3 rounded-lg outline-none border border-[#3b405a] focus:border-[#22c55e]" placeholder="Amount" />
                                                  ) : (
                                                      <div className="text-[#ef4444] font-black text-lg"><RedCoin/> {formatValue(totalPetsValue)}</div>
                                                  )}
                                                  <button onClick={hostProposeBet} disabled={isProcessing || (currency==='pets'&&selectedPets.length===0)} className="w-full py-3 bg-[#6C63FF] hover:bg-[#5147D9] text-white font-black rounded-lg uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(108,99,255,0.4)] disabled:opacity-50">Set Bet & Pay</button>
                                              </div>
                                          ) : (
                                              <div className="animate-bounce-in">
                                                  <span className={`text-4xl font-black flex items-center justify-center gap-3 ${activePvPGame.datos_partida.currency === 'green' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                                      {activePvPGame.datos_partida.currency === 'green' ? <GreenCoin cls="w-8 h-8"/> : <RedCoin cls="w-8 h-8"/>}
                                                      {formatValue(activePvPGame.datos_partida.betAmount)}
                                                  </span>
                                                  {activePvPGame.estado === 'host_ready' && isHost && <p className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mt-4 animate-pulse">Waiting for challenger to match...</p>}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* VS BADGE */}
                          <div className="text-4xl md:text-6xl font-black italic text-[#252839] drop-shadow-[0_0_20px_rgba(0,0,0,1)] z-10 shrink-0">
                              VS
                          </div>

                          {/* CHALLENGER SIDE */}
                          <div className={`flex-1 flex flex-col items-center p-6 md:p-10 rounded-3xl border-2 transition-all w-full ${!isHost && activePvPGame.estado !== 'waiting' ? 'bg-[#1c1f2e] border-[#ef4444] shadow-[0_0_30px_rgba(239,68,68,0.2)]' : 'bg-[#0b0e14] border-[#252839]'}`}>
                              {activePvPGame.estado === 'waiting' ? (
                                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-dashed border-[#252839] bg-[#14151f] mb-4 flex items-center justify-center">
                                      <span className="text-[#252839] text-4xl">?</span>
                                  </div>
                              ) : (
                                  <img src={activePvPGame.datos_partida.p2.avatar} className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-[#252839] mb-4 object-cover shadow-xl animate-fade-in"/>
                              )}
                              
                              <h3 className="text-xl md:text-2xl font-black text-[#8f9ac6] uppercase mb-1 text-center w-full truncate">
                                  {activePvPGame.estado === 'waiting' ? 'Empty Seat' : activePvPGame.datos_partida.p2.name}
                              </h3>
                              <p className="text-[#555b82] text-xs font-bold uppercase tracking-widest mb-8">Challenger</p>

                              {activePvPGame.estado === 'negotiating' && (
                                  <div className="text-center w-full">
                                      <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-6 text-center animate-pulse">
                                          <p className="text-[#555b82] text-xs font-black uppercase">Host is selecting bet...</p>
                                      </div>
                                  </div>
                              )}

                              {activePvPGame.estado === 'host_ready' && (
                                  <div className="w-full text-center">
                                      <p className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-3">Required to Join</p>
                                      <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-6 shadow-inner">
                                          <span className={`text-2xl md:text-3xl font-black flex items-center justify-center gap-2 mb-6 ${activePvPGame.datos_partida.currency === 'green' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                              {activePvPGame.datos_partida.currency === 'green' ? <GreenCoin cls="w-6 h-6"/> : <RedCoin cls="w-6 h-6"/>}
                                              {formatValue(activePvPGame.datos_partida.betAmount)}
                                          </span>
                                          {!isHost && (
                                              activePvPGame.datos_partida.currency === 'green' ? (
                                                  <button onClick={challengerAcceptBetAndDeal} disabled={isProcessing} className="w-full py-3 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black rounded-lg uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(34,197,94,0.4)] disabled:opacity-50 transition-all hover:scale-105">Match & Deal</button>
                                              ) : (
                                                  <button onClick={openInventoryModal} disabled={isProcessing} className="w-full py-3 bg-[#ef4444] hover:bg-red-600 text-white font-black rounded-lg uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 transition-all hover:scale-105">Select Pets to Match</button>
                                              )
                                          )}
                                          {isHost && <p className="text-[#555b82] text-xs font-bold uppercase">Waiting...</p>}
                                      </div>
                                  </div>
                              )}
                          </div>

                      </div>
                  )}

                  {/* FASE DE JUEGO (CARTAS) */}
                  {(activePvPGame.estado === 'playing' || activePvPGame.estado === 'completed') && (
                      <div className="flex-1 flex flex-col justify-between w-full h-full animate-fade-in">
                          
                          {/* JUGADOR 2 (Arriba) */}
                          <div className="w-full flex flex-col items-center">
                              <div className="flex items-center gap-3 mb-4">
                                  <img src={activePvPGame.datos_partida.p2.avatar} className="w-10 h-10 rounded-full border-2 border-[#252839]"/>
                                  <span className="px-4 py-1.5 bg-[#1c1f2e] border border-[#252839] rounded-full text-xs font-black uppercase tracking-widest text-white shadow-md">
                                      {activePvPGame.datos_partida.p2.name} {activePvPGame.estado === 'completed' && <span className="text-[#ef4444]">({activePvPGame.datos_partida.p2.score})</span>}
                                  </span>
                              </div>
                              <div className="flex justify-center min-h-[110px]">
                                  {activePvPGame.datos_partida.p2.hand.map((card, idx) => (
                                      <PlayingCard key={`p2-${idx}`} card={card} index={idx} isSmall={true} />
                                  ))}
                              </div>
                          </div>

                          {/* DEALER (Centro) */}
                          <div className="w-full border-y border-[#252839]/50 py-6 my-4 flex flex-col items-center bg-[#0b0e14]/50 relative">
                              <span className="text-[10px] text-[#8f9ac6] uppercase font-black tracking-widest mb-4">Dealer Cards {activePvPGame.estado === 'completed' && <span className="text-[#ef4444]">({activePvPGame.datos_partida.dealerScore})</span>}</span>
                              <div className="flex justify-center min-h-[110px]">
                                  {activePvPGame.datos_partida.dealerHand.length > 0 ? activePvPGame.datos_partida.dealerHand.map((card, idx) => (
                                      <PlayingCard key={`d-${idx}`} card={card} index={idx} hidden={idx === 1 && activePvPGame.estado === 'playing'} isSmall={true} />
                                  )) : null}
                              </div>

                              {activePvPGame.estado === 'completed' && (
                                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                      <div className="px-8 py-3 rounded-2xl bg-[#0b0e14]/90 border border-[#252839] backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-bounce-in">
                                          <h3 className="text-3xl font-black uppercase tracking-widest text-center text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                                              {getPvPResultMsg()}
                                          </h3>
                                      </div>
                                  </div>
                              )}
                          </div>

                          {/* JUGADOR 1 (Abajo) */}
                          <div className="w-full flex flex-col items-center">
                              <div className="flex justify-center min-h-[110px] mb-4">
                                  {activePvPGame.datos_partida.p1.hand.map((card, idx) => (
                                      <PlayingCard key={`p1-${idx}`} card={card} index={idx} isSmall={true} />
                                  ))}
                              </div>
                              <div className="flex items-center gap-3">
                                  <img src={activePvPGame.datos_partida.p1.avatar} className="w-10 h-10 rounded-full border-2 border-[#252839]"/>
                                  <span className="px-4 py-1.5 bg-[#1c1f2e] border border-[#252839] rounded-full text-xs font-black uppercase tracking-widest text-white shadow-md">
                                      {activePvPGame.datos_partida.p1.name} (Host) {activePvPGame.estado === 'completed' && <span className="text-[#ef4444]">({activePvPGame.datos_partida.p1.score})</span>}
                                  </span>
                              </div>
                          </div>

                          {/* CONTROLES IN-GAME PVP */}
                          <div className="mt-8 flex justify-center w-full relative z-20">
                              {activePvPGame.estado === 'playing' && (
                                  activePvPGame.datos_partida.currentTurn === (isHost ? 'p1' : 'p2') ? (
                                      <div className="flex gap-4 w-full max-w-md animate-fade-in">
                                          <button onClick={() => handlePvPAction('hit')} disabled={isProcessing} className="flex-1 py-4 bg-[#252839] hover:bg-[#2F3347] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md hover:-translate-y-1 transition-all">Hit</button>
                                          <button onClick={() => handlePvPAction('stand')} disabled={isProcessing} className="flex-1 py-4 bg-gradient-to-r from-[#ef4444] to-[#b91c1c] rounded-xl font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:-translate-y-1 transition-all">Stand</button>
                                      </div>
                                  ) : (
                                      <div className="px-8 py-4 bg-[#0b0e14] border border-[#252839] rounded-xl font-black uppercase tracking-widest text-[#555b82] text-center w-full max-w-md animate-pulse">Opponent's Turn...</div>
                                  )
                              )}
                          </div>
                      </div>
                  )}

              </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a506b; }
        
        .perspective-[1000px] { perspective: 1000px; }
        
        .animate-card-deal { animation: cardDeal 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.1) both; }
        .animate-bounce-in { animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        
        @keyframes cardDeal {
          0% { opacity: 0; transform: translateY(-50px) scale(0.5) rotateY(90deg) rotateZ(-10deg); box-shadow: 0 0 0 rgba(0,0,0,0); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg) rotateZ(0deg); box-shadow: 0 5px 15px rgba(0,0,0,0.8); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
