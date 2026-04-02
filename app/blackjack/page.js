"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

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

// === EPIC VISUAL CARD (RESPONSIVE FIX) ===
const PlayingCard = ({ card, hidden = false, index, isSmall = false }) => {
  // Mobile first classes, scaling up on md screens to prevent overlaps
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
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [gameMode, setGameMode] = useState('ai'); 

  // PvE States
  const [currency, setCurrency] = useState('green'); 
  const [betAmount, setBetAmount] = useState(10);
  const [gameState, setGameState] = useState('betting'); 
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null); 

  // PvP States
  const [pvpLobbyGames, setPvpLobbyGames] = useState([]);
  const [activePvPGame, setActivePvPGame] = useState(null);
  const pvpPayoutProcessed = useRef(false);

  // Inventory / Pets
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [myInventory, setMyInventory] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [botPets, setBotPets] = useState([]); 
  const [joiningGameId, setJoiningGameId] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(data);
      }
      loadPvPLobby();
      setCargando(false);
    };
    fetchUser();

    // Sincronización Realtime PvP
    const lobbySub = supabase.channel('blackjack_lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.blackjack" }, 
        (payload) => {
          loadPvPLobby(); 
          if (activePvPGame && payload.new.id === activePvPGame.id) {
              setActivePvPGame(payload.new);
          }
      }).subscribe();

    return () => { supabase.removeChannel(lobbySub); };
  }, [activePvPGame]);

  // MOTOR MULTIJUGADOR (PVP): Efectuar el pago cuando termine la mesa
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

              if (dp.currency === 'green' && (isWin || isTie)) {
                  let ganancia = isWin ? (me.score === 21 && me.hand.length === 2 ? Math.floor(dp.betAmount * 2.5) : dp.betAmount * 2) : dp.betAmount;
                  if (ganancia > 0) {
                      const { data } = await supabase.from('profiles').select('saldo_verde').eq('id', currentUser.id).single();
                      const nuevo = data.saldo_verde + ganancia;
                      await supabase.from('profiles').update({ saldo_verde: nuevo }).eq('id', currentUser.id);
                      setUserProfile(prev => ({...prev, saldo_verde: nuevo}));
                  }
              }
          }
      };
      
      if (activePvPGame?.estado === 'completed') processPvPPayout();
      else pvpPayoutProcessed.current = false;

      // Host reparte cartas cuando entra P2
      const checkDeal = async () => {
          if (activePvPGame?.estado === 'playing' && activePvPGame.datos_partida.p1.hand.length === 0 && currentUser?.id === activePvPGame.creador_id) {
             const newDeck = createDeck();
             const dp = { ...activePvPGame.datos_partida };
             dp.p1.hand = [newDeck.pop(), newDeck.pop()];
             dp.p2.hand = [newDeck.pop(), newDeck.pop()];
             dp.dealerHand = [newDeck.pop(), newDeck.pop()]; // Dealers 2nd card stays hidden on UI
             dp.p1.score = calculateScore(dp.p1.hand);
             dp.p2.score = calculateScore(dp.p2.hand);
             dp.deck = newDeck;
             
             if (dp.p1.score === 21) dp.p1.status = 'stand';
             if (dp.p2.score === 21) dp.p2.status = 'stand';

             if (dp.p1.status === 'stand' && dp.p2.status === 'stand') dp.currentTurn = 'dealer';
             else if (dp.p1.status === 'stand') dp.currentTurn = 'p2';
             else dp.currentTurn = 'p1';

             await supabase.from('partidas').update({ datos_partida: dp }).eq('id', activePvPGame.id);
          }
      };
      checkDeal();
  }, [activePvPGame, currentUser]);

  const loadPvPLobby = async () => {
    const { data } = await supabase.from('partidas').select('*').eq('modo_juego', 'blackjack').eq('estado', 'waiting').order('creado_en', { ascending: false });
    if(data) setPvpLobbyGames(data);
  };

  const saldoVerde = userProfile?.saldo_verde || 0;
  const totalPetsValue = selectedPets.reduce((acc, curr) => acc + curr.valor, 0);

  const generateBotPets = (targetValue) => {
      return [
          { nombre: "AI Myst Pet", valor: Math.floor(targetValue * 0.7), imagen: "https://api.dicebear.com/7.x/bottts/svg?seed=1", color: "#ef4444" },
          { nombre: "AI Help Pet", valor: Math.floor(targetValue * 0.3), imagen: "https://api.dicebear.com/7.x/bottts/svg?seed=2", color: "#facc15" }
      ];
  };

  // ==========================================
  // LÓGICA MODO VS AI (PvE)
  // ==========================================
  const startGameAI = async () => {
    if (!currentUser) return alert("Log in to play.");
    if (currency === 'green' && (betAmount <= 0 || betAmount > saldoVerde)) return alert("Invalid Green Coin amount.");
    if (currency === 'pets' && selectedPets.length === 0) return alert("Select pets to bet first.");

    setProcesando(true);
    try {
      if (currency === 'green') {
          const nuevoSaldo = saldoVerde - betAmount;
          await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);
          setUserProfile(prev => ({ ...prev, saldo_verde: nuevoSaldo }));
      } else {
          setBotPets(generateBotPets(totalPetsValue));
      }

      const newDeck = createDeck();
      const pHand = [newDeck.pop(), newDeck.pop()];
      const dHand = [newDeck.pop(), newDeck.pop()];

      setDeck(newDeck);
      setPlayerHand(pHand);
      setDealerHand(dHand);
      setGameState('playing');
      setWinner(null);

      if (calculateScore(pHand) === 21) handleGameOverAI('player', pHand, dHand, true);
    } catch (err) { alert("Error processing bet."); }
    setProcesando(false);
  };

  const hitAI = () => {
    if (gameState !== 'playing' || procesando) return;
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    setPlayerHand(newHand);
    setDeck(newDeck);
    if (calculateScore(newHand) > 21) handleGameOverAI('dealer', newHand, dealerHand);
  };

  const standAI = () => {
    if (gameState !== 'playing' || procesando) return;
    setGameState('dealerTurn');
    let dHand = [...dealerHand];
    let dDeck = [...deck];
    while (calculateScore(dHand) < 17) dHand.push(dDeck.pop());
    setDealerHand(dHand);
    setDeck(dDeck);
    
    const pScore = calculateScore(playerHand);
    const dScore = calculateScore(dHand);

    if (dScore > 21 || pScore > dScore) handleGameOverAI('player', playerHand, dHand);
    else if (dScore > pScore) handleGameOverAI('dealer', playerHand, dHand);
    else handleGameOverAI('tie', playerHand, dHand);
  };

  const handleGameOverAI = async (result, pHand, dHand, isBlackjack = false) => {
    setGameState('gameOver');
    setWinner(result);
    setProcesando(true);
    try {
      if (currency === 'green') {
          let ganancia = 0;
          if (result === 'player') ganancia = isBlackjack ? Math.floor(betAmount * 2.5) : betAmount * 2;
          else if (result === 'tie') ganancia = betAmount; 
          if (ganancia > 0) {
            const saldoRecuperado = userProfile.saldo_verde + ganancia;
            await supabase.from('profiles').update({ saldo_verde: saldoRecuperado }).eq('id', currentUser.id);
            setUserProfile(prev => ({ ...prev, saldo_verde: saldoRecuperado }));
          }
      }
    } catch (err) {}
    setProcesando(false);
  };

  // ==========================================
  // LÓGICA MODO MULTIJUGADOR (PvP)
  // ==========================================
  const createPvPGame = async () => {
      if (!currentUser) return alert("Log in to play.");
      if (currency === 'green' && (betAmount <= 0 || betAmount > saldoVerde)) return alert("Invalid Green Coin amount.");
      if (currency === 'pets' && selectedPets.length === 0) return alert("Select pets to bet.");
      
      setProcesando(true);
      try {
          const { data, error } = await supabase.rpc('create_blackjack_pvp', {
              p_user_id: currentUser.id,
              p_bet_amount: currency === 'green' ? betAmount : totalPetsValue,
              p_currency: currency,
              p_pets: currency === 'pets' ? selectedPets : [],
              p_host_name: userProfile.username || 'Player 1',
              p_host_avatar: userProfile.avatar_url || '/default-avatar.png'
          });
          if (error) throw error;
          
          if(currency === 'green') setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - betAmount}));
          const { data: newRoom } = await supabase.from('partidas').select('*').eq('id', data.game_id).single();
          setActivePvPGame(newRoom);
      } catch(err) { alert("Error: " + err.message); }
      setProcesando(false);
  };

  const handleJoinClick = (game) => {
      if(!currentUser) return alert("Log in first.");
      if(game.datos_partida.currency === 'green') {
          if(saldoVerde < game.datos_partida.betAmount) return alert("Insufficient Green Coins.");
          joinPvPGame(game, []);
      } else {
          setJoiningGameId(game.id);
          openInventoryModal();
      }
  };

  const joinPvPGame = async (gameToJoin, petsToBet) => {
      setProcesando(true);
      try {
          const freshDeck = createDeck(); 
          const { error } = await supabase.rpc('join_blackjack_pvp', {
              p_game_id: gameToJoin.id, p_user_id: currentUser.id, p_player_name: userProfile.username || 'Player 2',
              p_player_avatar: userProfile.avatar_url || '/default-avatar.png', p_pets: petsToBet, p_initial_deck: freshDeck
          });
          if (error) throw error;
          
          if(gameToJoin.datos_partida.currency === 'green') {
              setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - gameToJoin.datos_partida.betAmount}));
          }
          const { data: activeRoom } = await supabase.from('partidas').select('*').eq('id', gameToJoin.id).single();
          setActivePvPGame(activeRoom);
      } catch(err) { alert("Join Error: " + err.message); }
      setProcesando(false);
      setJoiningGameId(null);
  };

  // Motor Frontend PvP: Hit & Stand Sincronizados
  const handlePvPAction = async (action) => {
      setProcesando(true);
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

          await supabase.from('partidas').update({ datos_partida: dp, estado: dp.currentTurn === 'gameOver' ? 'completed' : 'playing' }).eq('id', activePvPGame.id);
      } catch (e) { console.error(e) }
      setProcesando(false);
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
  // INVENTORY MODAL
  // ==========================================
  const openInventoryModal = async () => {
      if (!currentUser) return alert("Log in to play.");
      setIsInventoryOpen(true);
      const { data, error } = await supabase.from('inventory').select(`id, is_locked, items ( id, name, value, image_url, color )`).eq('user_id', currentUser.id).eq('is_locked', false);
      if (data && !error) {
          const mascotas = data.map(inv => ({ inventarioId: inv.id, nombre: inv.items.name, valor: inv.items.value, imagen: inv.items.image_url, color: inv.items.color }));
          setMyInventory(mascotas.sort((a,b) => b.valor - a.valor));
      }
  };

  const togglePetSelection = (pet) => {
      if (selectedPets.find(p => p.inventarioId === pet.inventarioId)) setSelectedPets(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
      else setSelectedPets(prev => [...prev, pet]);
  };

  const confirmPets = () => {
      setIsInventoryOpen(false);
      if (joiningGameId) {
          const gameToJoin = pvpLobbyGames.find(g => g.id === joiningGameId);
          joinPvPGame(gameToJoin, selectedPets);
      } else {
          setBotPets(generateBotPets(totalPetsValue));
      }
  };

  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Setting up the table...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans overflow-hidden relative flex flex-col items-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-[#6C63FF]/20 via-[#22c55e]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      {isInventoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14151f] border border-[#252839] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-bounce-in">
            <div className="p-4 md:p-6 border-b border-[#252839] flex justify-between items-center bg-[#0b0e14] rounded-t-2xl">
              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest text-white">Select Pets</h2>
                {joiningGameId && <p className="text-[#ef4444] text-xs md:text-sm mt-1 font-bold">Match opponent's value to join!</p>}
              </div>
              <button onClick={() => {setIsInventoryOpen(false); setJoiningGameId(null);}} className="text-[#4a506b] hover:text-white transition-colors text-3xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              {myInventory.length === 0 ? (
                <div className="text-center py-20 text-[#555b82] font-bold">Your inventory is empty or locked.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {myInventory.map(pet => {
                    const isSelected = selectedPets.some(p => p.inventarioId === pet.inventarioId);
                    return (
                      <div key={pet.inventarioId} onClick={() => togglePetSelection(pet)} className={`relative bg-[#0b0e14] border-2 rounded-xl p-2 cursor-pointer transition-all hover:-translate-y-1 ${isSelected ? 'border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'border-[#252839] hover:border-[#4a506b]'}`}>
                        {isSelected && <div className="absolute top-1 right-1 w-4 h-4 bg-[#ef4444] rounded-full border-2 border-white z-10"></div>}
                        <img src={pet.imagen} className="w-full h-12 md:h-16 object-contain drop-shadow-md mb-2" alt={pet.nombre}/>
                        <div className="text-center">
                          <p className="text-[9px] font-black uppercase truncate text-white" style={{color: pet.color}}>{pet.nombre}</p>
                          <p className="text-[10px] font-bold text-[#8f9ac6] flex items-center justify-center gap-1 mt-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 md:p-6 border-t border-[#252839] bg-[#0b0e14] rounded-b-2xl flex justify-between items-center">
              <div>
                <p className="text-[#555b82] text-[10px] md:text-xs font-black uppercase tracking-widest">Total Bet Value</p>
                <p className="text-xl md:text-2xl font-black text-[#ef4444] flex items-center gap-2"><RedCoin cls="w-5 h-5 md:w-6 md:h-6"/> {formatValue(totalPetsValue)}</p>
              </div>
              <button onClick={confirmPets} disabled={selectedPets.length === 0} className="px-6 md:px-8 py-3 rounded-xl bg-[#ef4444] hover:bg-red-600 text-white font-black uppercase tracking-widest shadow-[0_0_15px_rgba(239,68,68,0.4)] disabled:opacity-50 transition-all text-xs md:text-base">
                Confirm Bet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER TABS */}
      {!activePvPGame && (
          <div className="w-full max-w-[1200px] mb-8 relative z-10 flex justify-center">
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

      {/* LAYOUT PRINCIPAL: Reordenado para Móviles (Controles abajo de la mesa en móvil, lado izquierdo en PC) */}
      <div className={`w-full max-w-[1200px] relative z-10 flex flex-col lg:grid lg:grid-cols-3 gap-6 md:gap-8`}>
        
        {/* ================= PANEL IZQUIERDO (CONTROLES / LOBBY) ================= */}
        <div className={`order-2 lg:order-1 lg:col-span-1 bg-[#14151f]/90 backdrop-blur-md border border-[#252839] rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col relative overflow-hidden ${activePvPGame ? 'lg:col-span-3 lg:flex-row lg:items-center justify-between' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#6C63FF]/5 to-transparent pointer-events-none"></div>
          
          {!activePvPGame && (
             <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 text-center drop-shadow-md relative z-10">
                Blackjack 21
             </h2>
          )}

          {gameMode === 'ai' && !activePvPGame ? (
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
                            <span>Balance: <GreenCoin cls="w-3 h-3 inline"/> {formatValue(saldoVerde)}</span>
                        </label>
                        <div className="flex bg-[#0b0e14] border border-[#252839] rounded-xl overflow-hidden transition-all focus-within:border-[#22c55e] focus-within:shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                          <div className="pl-3 md:pl-4 flex items-center justify-center bg-[#1c1f2e] border-r border-[#252839]"><GreenCoin cls="w-4 h-4 md:w-5 md:h-5"/></div>
                          <input type="number" disabled={gameState !== 'betting' || procesando} value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} className="w-full bg-transparent text-white font-bold p-2 md:p-3 outline-none text-sm md:text-base" />
                          <button onClick={() => setBetAmount(saldoVerde)} disabled={gameState !== 'betting'} className="px-3 md:px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-black text-xs text-[#22c55e] transition-colors">MAX</button>
                        </div>
                      </div>
                  ) : (
                      <div className="mb-6 relative z-10 bg-[#0b0e14] border border-[#252839] rounded-xl p-3 md:p-4 text-center">
                          <p className="text-[#8f9ac6] font-bold uppercase text-[10px] md:text-xs mb-2">Your Pet Bet</p>
                          {selectedPets.length > 0 ? (
                              <div className="flex justify-center flex-wrap gap-2 mb-2">
                                  {selectedPets.slice(0,3).map((p,i) => <img key={i} src={p.imagen} className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow-md" />)}
                                  {selectedPets.length > 3 && <span className="text-[#555b82] text-[10px] font-black self-center">+{selectedPets.length-3}</span>}
                              </div>
                          ) : (
                              <p className="text-[#555b82] text-[10px] md:text-xs mb-3">No pets selected.</p>
                          )}
                          <div className="text-lg md:text-xl font-black text-[#ef4444] mb-3 flex items-center justify-center gap-1"><RedCoin /> {formatValue(totalPetsValue)}</div>
                          {gameState === 'betting' && <button onClick={openInventoryModal} className="w-full py-2 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest">Edit Pets</button>}
                      </div>
                  )}

                  <div className="mt-auto relative z-10">
                    {gameState === 'betting' ? (
                      <button onClick={startGameAI} disabled={procesando} className={`w-full py-4 md:py-5 rounded-2xl font-black text-base md:text-xl text-white uppercase tracking-widest transition-all ${procesando ? 'bg-gray-600 opacity-50' : 'bg-[#6C63FF] hover:bg-[#5147D9] shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:scale-105'}`}>
                        {procesando ? 'Betting...' : 'Deal Cards'}
                      </button>
                    ) : gameState === 'playing' ? (
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button onClick={hitAI} disabled={procesando} className="py-3 md:py-4 bg-[#252839] hover:bg-[#2F3347] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md hover:-translate-y-1 transition-all text-xs md:text-base">Hit</button>
                        <button onClick={standAI} disabled={procesando} className="py-3 md:py-4 bg-gradient-to-r from-[#ef4444] to-[#b91c1c] rounded-xl font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:-translate-y-1 transition-all text-xs md:text-base">Stand</button>
                      </div>
                    ) : (
                      <button onClick={() => {setGameState('betting'); setPlayerHand([]); setDealerHand([]); setBotPets([]);}} className="w-full py-3 md:py-4 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md transition-all text-xs md:text-base">New Round</button>
                    )}
                  </div>
              </>
          ) : gameMode === 'lobby' && !activePvPGame ? (
              <div className="flex flex-col h-full relative z-10">
                  <div className="flex flex-wrap justify-between items-center mb-4 md:mb-6 gap-2">
                      <h3 className="text-sm md:text-xl font-black text-white uppercase tracking-widest flex items-center gap-1 md:gap-2"><span className="text-xl md:text-2xl">🌍</span> Live Tables</h3>
                      <button onClick={createPvPGame} disabled={procesando} className="px-3 md:px-4 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black uppercase text-[10px] md:text-xs rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                          Create Table
                      </button>
                  </div>
                  
                  <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-2 md:p-3 mb-4 flex gap-2">
                     <button onClick={() => setCurrency('green')} className={`flex-1 py-1.5 rounded text-[10px] md:text-xs font-black uppercase ${currency==='green'?'bg-[#22c55e]/20 text-[#22c55e]':'text-[#555b82]'}`}>Green</button>
                     <button onClick={() => { setCurrency('pets'); openInventoryModal(); }} className={`flex-1 py-1.5 rounded text-[10px] md:text-xs font-black uppercase ${currency==='pets'?'bg-[#ef4444]/20 text-[#ef4444]':'text-[#555b82]'}`}>Pets</button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2 md:gap-3 min-h-[200px]">
                      {pvpLobbyGames.length === 0 ? (
                          <div className="text-center py-10 text-[#555b82] font-bold text-xs md:text-sm uppercase">No tables available. Create one!</div>
                      ) : (
                          pvpLobbyGames.map(game => (
                              <div key={game.id} className="bg-[#0b0e14] border border-[#252839] p-3 md:p-4 rounded-xl flex items-center justify-between hover:border-[#6C63FF]/50 transition-colors">
                                  <div className="flex items-center gap-2 md:gap-3">
                                      <img src={game.datos_partida.p1.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-[#252839]" />
                                      <div>
                                          <p className="text-xs md:text-sm font-bold text-white line-clamp-1">{game.datos_partida.p1.name}</p>
                                          <p className="text-[10px] md:text-xs font-black flex items-center gap-1 mt-0.5" style={{color: game.datos_partida.currency === 'green' ? '#22c55e' : '#ef4444'}}>
                                              {game.datos_partida.currency === 'green' ? <GreenCoin cls="w-2 h-2 md:w-3 md:h-3"/> : <RedCoin cls="w-2 h-2 md:w-3 md:h-3"/>}
                                              {formatValue(game.datos_partida.betAmount)}
                                          </p>
                                      </div>
                                  </div>
                                  <button onClick={() => handleJoinClick(game)} disabled={game.creador_id === currentUser?.id || procesando} className="px-3 md:px-5 py-1.5 md:py-2 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] text-white font-black uppercase text-[10px] md:text-xs rounded-lg disabled:opacity-50">
                                      {game.creador_id === currentUser?.id ? 'Waiting...' : 'Join'}
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          ) : activePvPGame ? (
              <>
                 <div className="flex items-center gap-3 md:gap-4 relative z-10 w-full lg:w-auto">
                    <button onClick={() => setActivePvPGame(null)} className="px-3 md:px-4 py-2 bg-[#0b0e14] border border-[#252839] text-[#8f9ac6] rounded-lg font-bold text-[10px] md:text-xs uppercase hover:text-white">Leave</button>
                    <div>
                        <h3 className="text-sm md:text-lg font-black text-white uppercase tracking-widest">PvP Match</h3>
                        <p className="text-[#8f9ac6] text-[10px] md:text-xs font-bold flex items-center gap-1">
                            Pot: {activePvPGame.datos_partida.currency==='green'?<GreenCoin cls="w-2 h-2 md:w-3 md:h-3"/>:<RedCoin cls="w-2 h-2 md:w-3 md:h-3"/>} 
                            <span className={activePvPGame.datos_partida.currency==='green'?'text-[#22c55e]':'text-[#ef4444]'}>{formatValue(activePvPGame.datos_partida.betAmount * 2)}</span>
                        </p>
                    </div>
                 </div>

                 <div className="flex gap-2 md:gap-4 mt-4 lg:mt-0 w-full lg:w-auto relative z-10">
                    {activePvPGame.estado === 'playing' ? (
                        activePvPGame.datos_partida.currentTurn === (currentUser?.id === activePvPGame.creador_id ? 'p1' : 'p2') ? (
                            <>
                               <button onClick={() => handlePvPAction('hit')} disabled={procesando} className="flex-1 lg:flex-none px-4 md:px-8 py-2 md:py-3 bg-[#252839] hover:bg-[#2F3347] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md hover:-translate-y-1 transition-all text-[10px] md:text-xs">Hit</button>
                               <button onClick={() => handlePvPAction('stand')} disabled={procesando} className="flex-1 lg:flex-none px-4 md:px-8 py-2 md:py-3 bg-gradient-to-r from-[#ef4444] to-[#b91c1c] rounded-xl font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:-translate-y-1 transition-all text-[10px] md:text-xs">Stand</button>
                            </>
                        ) : (
                            <div className="px-4 md:px-8 py-2 md:py-3 bg-[#0b0e14] border border-[#252839] rounded-xl font-black uppercase tracking-widest text-[#555b82] w-full text-center text-[10px] md:text-xs">Opponent's Turn...</div>
                        )
                    ) : activePvPGame.estado === 'waiting' ? (
                        <div className="px-4 md:px-8 py-2 md:py-3 bg-[#0b0e14] border border-[#252839] rounded-xl font-black uppercase tracking-widest text-[#22c55e] w-full text-center animate-pulse text-[10px] md:text-xs">Waiting for challenger...</div>
                    ) : (
                        <div className="px-4 md:px-8 py-2 md:py-3 bg-[#0b0e14] border border-[#252839] rounded-xl font-black uppercase tracking-widest text-white w-full text-center text-[10px] md:text-xs">Game Over</div>
                    )}
                 </div>
              </>
          ) : null}
        </div>

        {/* ================= PANEL DERECHO (LA MESA) ================= */}
        <div className={`order-1 lg:order-2 bg-gradient-to-b from-[#0f111a] to-[#14151f] border-2 border-[#252839] rounded-3xl p-4 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative min-h-[400px] overflow-hidden ${activePvPGame ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          
          <div className="absolute inset-2 md:inset-4 border-2 border-dashed border-[#6C63FF]/20 rounded-2xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl md:text-9xl opacity-5 grayscale pointer-events-none">🃏</div>

          {/* === MESA MODO PVE === */}
          {!activePvPGame && (
              <>
                  <div className="relative z-10 w-full mb-6 md:mb-8">
                    <div className="flex justify-between items-end mb-3 md:mb-4 flex-wrap gap-2">
                      <span className="px-3 md:px-4 py-1 bg-[#1c1f2e] border border-[#252839] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-md flex items-center gap-1 md:gap-2">
                        🤖 AI Dealer {gameState === 'gameOver' && <span className="text-[#ef4444]">({calculateScore(dealerHand)})</span>}
                      </span>
                      {currency === 'pets' && botPets.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 md:gap-2 bg-[#0b0e14] border border-[#252839] px-2 md:px-3 py-1 rounded-lg">
                              <span className="text-[8px] md:text-[10px] text-[#555b82] uppercase font-black">AI Bets:</span>
                              <div className="flex gap-1">
                                  {botPets.map((p,i) => <img key={i} src={p.imagen} className="w-5 h-5 md:w-6 md:h-6 object-contain" title={p.nombre}/>)}
                              </div>
                              <span className="text-[#ef4444] font-black text-[10px] md:text-xs ml-1 flex items-center gap-1"><RedCoin cls="w-2 h-2 md:w-3 md:h-3"/> {formatValue(botPets.reduce((a,c)=>a+c.valor,0))}</span>
                          </div>
                      )}
                    </div>
                    
                    <div className="flex justify-center min-h-[100px] md:min-h-[144px]">
                      {dealerHand.length === 0 ? (
                          <div className="text-[#555b82] text-xs md:text-sm uppercase tracking-widest font-black self-center">Waiting for bets...</div>
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

          {/* === MESA MODO PVP === */}
          {activePvPGame && (
              <div className="relative z-10 w-full flex flex-col items-center gap-4 md:gap-8 py-4 md:py-8">
                  {/* Jugador 2 (Oponente - Arriba) */}
                  {activePvPGame.estado !== 'waiting' && (
                      <div className="w-full flex flex-col items-center">
                          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
                              <img src={activePvPGame.datos_partida.p2?.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-[#252839]"/>
                              <span className="px-3 md:px-4 py-1 bg-[#1c1f2e] border border-[#252839] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-md">
                                  {activePvPGame.datos_partida.p2?.name} {activePvPGame.estado === 'completed' && `(${activePvPGame.datos_partida.p2?.score})`}
                              </span>
                          </div>
                          <div className="flex justify-center min-h-[90px] md:min-h-[110px]">
                              {activePvPGame.datos_partida.p2?.hand?.map((card, idx) => (
                                  <PlayingCard key={`p2-${idx}`} card={card} index={idx} isSmall={true} />
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Dealer PVP (Centro) */}
                  {activePvPGame.estado !== 'waiting' && (
                     <div className="w-full border-y border-[#252839]/50 py-3 md:py-4 flex flex-col items-center bg-[#0b0e14]/50 relative">
                        <span className="text-[8px] md:text-[10px] text-[#8f9ac6] uppercase font-black tracking-widest mb-2">Dealer Cards {activePvPGame.estado === 'completed' && <span className="text-[#ef4444]">({activePvPGame.datos_partida.dealerScore})</span>}</span>
                        <div className="flex justify-center min-h-[90px] md:min-h-[110px]">
                            {activePvPGame.datos_partida.dealerHand?.length > 0 ? activePvPGame.datos_partida.dealerHand.map((card, idx) => (
                                <PlayingCard key={`d-${idx}`} card={card} index={idx} hidden={idx === 1 && activePvPGame.estado === 'playing'} isSmall={true} />
                            )) : <div className="text-[#555b82] text-[10px] md:text-xs font-bold uppercase mt-4">Waiting to deal...</div>}
                        </div>

                        {/* MENSAJE GANADOR PVP FLOTANTE */}
                        {activePvPGame.estado === 'completed' && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                               <div className="px-6 py-2 rounded-2xl bg-[#0b0e14]/90 border border-[#252839] backdrop-blur-md shadow-2xl animate-bounce-in">
                                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-widest text-center text-white">
                                     {getPvPResultMsg()}
                                  </h3>
                               </div>
                            </div>
                        )}
                     </div>
                  )}

                  {/* Jugador 1 (Host - Abajo) */}
                  <div className="w-full flex flex-col items-center mt-2 md:mt-0">
                      <div className="flex justify-center min-h-[90px] md:min-h-[110px] mb-2 md:mb-4">
                          {activePvPGame.datos_partida.p1?.hand?.map((card, idx) => (
                              <PlayingCard key={`p1-${idx}`} card={card} index={idx} isSmall={true} />
                          ))}
                      </div>
                      <div className="flex items-center gap-2 md:gap-3">
                          <img src={activePvPGame.datos_partida.p1.avatar} className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-[#252839]"/>
                          <span className="px-3 md:px-4 py-1 bg-[#1c1f2e] border border-[#252839] rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest text-white shadow-md">
                              {activePvPGame.datos_partida.p1.name} (Host) {activePvPGame.estado === 'completed' && `(${activePvPGame.datos_partida.p1?.score})`}
                          </span>
                      </div>
                  </div>
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
        
        @keyframes cardDeal {
          0% { opacity: 0; transform: translateY(-50px) scale(0.5) rotateY(90deg) rotateZ(-10deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotateY(0deg) rotateZ(0deg); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
