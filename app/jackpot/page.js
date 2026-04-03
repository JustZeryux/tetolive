"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

const playAudio = (src, vol = 0.5) => {
    try {
        const audio = new Audio(src);
        audio.volume = vol;
        audio.play().catch(() => {});
    } catch (e) {}
};

export default function JackpotPage() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Game States
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState('betting'); // 'betting' | 'rolling' | 'finished'
  const [timeLeft, setTimeLeft] = useState(45);
  const [endTime, setEndTime] = useState(null); 
  
  // Roulette States
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [winner, setWinner] = useState(null);
  const [players, setPlayers] = useState([]); // Raw history of bets
  const [showEpicWin, setShowEpicWin] = useState(false);
  
  // Inventory States
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [myInventory, setMyInventory] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [isDepositing, setIsDepositing] = useState(false);
  const [visiblePetsCount, setVisiblePetsCount] = useState(60);

  const isResolving = useRef(false);
  const audioTickRef = useRef(null);

  // Group players visually if they make multiple deposits
  const groupedPlayers = useMemo(() => {
     const map = {};
     players.forEach(p => {
         if(!map[p.id]) {
             map[p.id] = { ...p, pets: [...(p.pets||[])] };
         } else {
             map[p.id].bet += p.bet;
             map[p.id].pets = [...map[p.id].pets, ...(p.pets||[])];
         }
     });
     return Object.values(map).sort((a,b) => b.bet - a.bet);
  }, [players]);

  const potTotal = groupedPlayers.reduce((sum, p) => sum + p.bet, 0);

  useEffect(() => {
    const initData = async () => {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', authData.user.id).single();
            setCurrentUser({ id: authData.user.id, username: profile?.username || 'Player', avatar_url: profile?.avatar_url || '/default-avatar.png' });
        }

        const { data: activeGame } = await supabase
            .from('partidas')
            .select('*')
            .eq('modo_juego', 'jackpot')
            .eq('estado', 'waiting')
            .order('creado_en', { ascending: false })
            .limit(1)
            .single();

        if (activeGame) loadGameData(activeGame);
    };
    initData();

    const channel = supabase.channel('jackpot_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.jackpot" }, 
        (payload) => {
          const game = payload.new;
          if (payload.eventType === 'INSERT') {
             loadGameData(game);
          } else if (payload.eventType === 'UPDATE') {
             if (game.estado === 'waiting') {
                 // Si alguien se unió, suena un click satisfactorio
                 if (payload.old.datos_partida?.players?.length < game.datos_partida?.players?.length) {
                     playAudio('/sounds/click.mp3', 0.4);
                 }
                 loadGameData(game);
             } else if (game.estado === 'completed' && game.resultado?.ganador && gameState === 'betting') {
                 startVisualRoulette(game.resultado.ganador, getGrouped(game.datos_partida.players));
             }
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameState]);

  const getGrouped = (rawPlayers) => {
      if(!rawPlayers) return [];
      const map = {};
      rawPlayers.forEach(p => {
         if(!map[p.id]) map[p.id] = { ...p, pets: [...(p.pets||[])] };
         else { map[p.id].bet += p.bet; map[p.id].pets = [...map[p.id].pets, ...(p.pets||[])]; }
      });
      return Object.values(map).sort((a,b) => b.bet - a.bet);
  };

  const loadGameData = (game) => {
      setActiveGameId(game.id);
      setPlayers(game.datos_partida?.players || []);
      setEndTime(game.datos_partida?.endTime || null);
      if (game.estado === 'waiting') {
          setGameState('betting');
          setWinner(null);
          setShowEpicWin(false);
          setOffset(0);
      }
  };

  useEffect(() => {
    if (gameState !== 'betting' || !endTime) return;
    
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      // Intense sound on last 10 seconds
      if (remaining <= 10 && remaining > 0) {
         playAudio('/sounds/click.mp3', 0.6);
      }
      
      if (remaining <= 0 && activeGameId && !isResolving.current) {
        isResolving.current = true;
        setTimeout(() => resolveGlobalMatch(), Math.random() * 1000); // Random delay to prevent race conditions
      }
    };
    
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endTime, gameState, activeGameId]);

  // Anti-Lag for Inventory
  const handleScrollInventory = (e) => {
      const { scrollTop, clientHeight, scrollHeight } = e.target;
      if (scrollHeight - scrollTop <= clientHeight + 100) {
          setVisiblePetsCount(prev => prev + 60);
      }
  };

  const openInventoryModal = async () => {
      if (!currentUser) return alert("Please log in to play.");
      setIsInventoryOpen(true);
      setSelectedPets([]);
      setVisiblePetsCount(60);
      
      const { data, error } = await supabase
        .from('inventory')
        .select(`id, is_locked, items ( id, name, value, image_url, color )`)
        .eq('user_id', currentUser.id)
        .eq('is_locked', false);

      if (data && !error) {
          const mascotas = data.map(inv => ({
              inventarioId: inv.id,
              itemId: inv.items.id,
              nombre: inv.items.name,
              valor: inv.items.value,
              imagen: inv.items.image_url,
              color: inv.items.color
          }));
          setMyInventory(mascotas.sort((a,b) => b.valor - a.valor));
      }
  };

  const togglePetSelection = (pet) => {
      if (selectedPets.find(p => p.inventarioId === pet.inventarioId)) {
          setSelectedPets(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
      } else {
          setSelectedPets(prev => [...prev, pet]);
      }
  };

  const handleDepositPets = async () => {
    if (selectedPets.length === 0) return alert("Select at least one pet.");
    if (isDepositing) return;
    setIsDepositing(true);
    
    const totalBetValue = selectedPets.reduce((sum, pet) => sum + pet.valor, 0);
    const assignedColor = ['#10b981', '#ec4899', '#8b5cf6', '#f97316', '#ef4444', '#3b82f6', '#facc15'][Math.floor(Math.random() * 7)];
    
    const myPlayerEntry = {
      id: currentUser.id,
      name: currentUser.username,
      avatar: currentUser.avatar_url,
      bet: totalBetValue,
      color: assignedColor,
      pets: selectedPets 
    };

    const petIds = selectedPets.map(p => p.inventarioId);

    try {
      const { data, error } = await supabase.rpc('join_jackpot', {
         p_user_id: currentUser.id,
         p_player_entry: myPlayerEntry,
         p_pet_ids: petIds
      });

      if (error) {
         alert("Error joining the pot. Please refresh and try again.");
         console.error(error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDepositing(false);
      setIsInventoryOpen(false);
      setSelectedPets([]);
    }
  };

  const resolveGlobalMatch = async () => {
      setGameState('rolling');
      const { data: result } = await supabase.rpc('resolver_partida_jackpot', { p_partida_id: activeGameId });
      
      if (result && result.ganador) {
          startVisualRoulette(result.ganador, groupedPlayers);
      }
  };

  const startVisualRoulette = (ganadorReal, finalGroupedPlayers) => {
    setGameState('rolling');
    setWinner(ganadorReal);
    playAudio('/sounds/spin.mp3', 0.8);

    const localPotTotal = finalGroupedPlayers.reduce((sum, p) => sum + p.bet, 0);
    const track = [];
    
    // Generate accurate proportion track
    for (let i = 0; i < 60; i++) {
      if (i === 45) { 
        track.push(ganadorReal); 
      } else {
        let randomFill = finalGroupedPlayers[0];
        const fillTicket = Math.random() * localPotTotal;
        let fillCurrent = 0;
        for (let p of finalGroupedPlayers) {
          fillCurrent += p.bet;
          if (fillTicket <= fillCurrent) { randomFill = p; break; }
        }
        track.push(randomFill);
      }
    }
    
    setSpinnerItems(track);
    setOffset(0);

    setTimeout(() => {
      const ITEM_WIDTH = 100; 
      // Stop anywhere within the winner's tile
      const randomOffset = Math.floor(Math.random() * (ITEM_WIDTH - 20)) - (ITEM_WIDTH / 2 - 10);
      const targetOffset = -(45 * ITEM_WIDTH) + randomOffset;
      setOffset(targetOffset);
      
      setTimeout(() => {
        // Flashbang
        const flash = document.createElement('div');
        flash.className = "fixed inset-0 bg-white z-[999] opacity-0 transition-opacity duration-300 pointer-events-none";
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = "0.7", 10);
        setTimeout(() => {
          flash.style.opacity = "0";
          setTimeout(() => flash.remove(), 300);
        }, 150);

        playAudio('/sounds/win.mp3', 0.8);
        setGameState('finished');
        setShowEpicWin(true);

        setTimeout(() => {
          setActiveGameId(null);
          setPlayers([]);
          setEndTime(null);
          setTimeLeft(45);
          setGameState('betting');
          setWinner(null);
          setShowEpicWin(false);
          isResolving.current = false;
        }, 6000); // Wait 6 seconds before new round
      }, 8000); // 8 seconds of spin
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden">
      
      {/* INVENTORY MODAL */}
      {isInventoryOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14151f] border border-[#252839] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="p-6 border-b border-[#252839] flex justify-between items-center bg-[#0b0e14] rounded-t-3xl">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-3">
                  🎰 Deposit Items
                </h2>
                <p className="text-[#8f9ac6] text-sm mt-1">No limit. Add as many items as you want to increase your win chance.</p>
              </div>
              <button onClick={() => setIsInventoryOpen(false)} className="text-[#555b82] hover:text-white transition-colors text-3xl">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar" onScroll={handleScrollInventory}>
              {myInventory.length === 0 ? (
                <div className="text-center py-20 text-[#555b82] font-bold uppercase tracking-widest text-sm border border-[#252839] border-dashed rounded-2xl">
                  Your inventory is empty or all items are locked.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                  {myInventory.slice(0, visiblePetsCount).map(pet => {
                    const isSelected = selectedPets.some(p => p.inventarioId === pet.inventarioId);
                    return (
                      <div 
                        key={pet.inventarioId} 
                        onClick={() => togglePetSelection(pet)}
                        className={`relative bg-[#0b0e14] border-2 rounded-2xl p-3 cursor-pointer transition-all hover:-translate-y-1 ${isSelected ? 'border-[#ef4444] shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-gradient-to-b from-[#ef4444]/10 to-transparent' : 'border-[#252839] hover:border-[#4a506b]'}`}
                      >
                        {isSelected && <div className="absolute top-2 right-2 w-4 h-4 bg-[#ef4444] rounded-full shadow-[0_0_10px_#ef4444] z-10"></div>}
                        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                        <img src={pet.imagen} className="w-full h-16 object-contain drop-shadow-lg mb-3 relative z-10" alt={pet.nombre}/>
                        <div className="text-center relative z-10">
                          <p className="text-[10px] font-black uppercase tracking-wide truncate w-full" style={{color: pet.color || '#fff'}}>{pet.nombre}</p>
                          <p className="text-xs font-black text-white flex items-center justify-center gap-1 mt-1 bg-[#14151f] rounded-lg py-1 border border-[#252839]">
                            <RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-[#252839] bg-[#0b0e14] rounded-b-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-center sm:text-left bg-[#14151f] px-6 py-3 rounded-2xl border border-[#252839] shadow-inner w-full sm:w-auto">
                <p className="text-[#555b82] text-xs font-black uppercase tracking-widest">Selected Value ({selectedPets.length})</p>
                <p className="text-2xl font-black text-[#ef4444] flex items-center gap-2 justify-center sm:justify-start mt-1">
                  <RedCoin cls="w-6 h-6"/> {formatValue(selectedPets.reduce((s, p) => s + p.valor, 0))}
                </p>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button onClick={() => setIsInventoryOpen(false)} className="flex-1 sm:flex-none px-6 py-4 rounded-xl border border-[#252839] text-white font-bold hover:bg-[#252839] transition-colors uppercase tracking-widest text-xs">
                  Cancel
                </button>
                <button 
                  onClick={handleDepositPets}
                  disabled={selectedPets.length === 0 || isDepositing}
                  className="flex-1 sm:flex-none px-8 py-4 rounded-xl bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95 text-xs"
                >
                  {isDepositing ? 'DEPOSITING...' : 'CONFIRM BET'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto relative z-10">
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ef4444] to-[#8f9ac6] drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            Jackpot
          </h1>
          <p className="text-[#8f9ac6] font-bold text-lg mt-3 tracking-wide">Deposit items. The more you bet, the higher your chances to win it all.</p>
        </div>

        {/* MAIN CONTAINER: ROULETTE / STATE */}
        <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl shadow-2xl overflow-hidden mb-10 relative">
          
          {/* EPIC WIN BANNER (ABSOLUTE OVERLAY OVER ROULETTE) */}
          {showEpicWin && winner && (
             <div className="absolute inset-0 z-50 bg-[#0b0e14] flex flex-col items-center justify-center animate-bounce-in shadow-[inset_0_0_100px_rgba(234,179,8,0.2)] border-4 border-yellow-500 rounded-3xl">
                 <div className="absolute inset-0 bg-yellow-500 blur-[150px] opacity-20 pointer-events-none animate-pulse"></div>
                 <h2 className="text-5xl font-black text-yellow-400 uppercase tracking-widest drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-6 animate-shake">
                     JACKPOT WINNER!
                 </h2>
                 <div className="flex items-center gap-8 relative z-10">
                     <img src={winner.avatar} className="w-32 h-32 rounded-full border-4 border-yellow-400 object-cover shadow-[0_0_30px_rgba(250,204,21,0.5)]" alt="Winner"/>
                     <div className="flex flex-col">
                         <span className="text-3xl font-black text-white">{winner.name}</span>
                         <span className="text-yellow-400 font-bold uppercase tracking-widest mt-1">
                             Won with {((winner.bet / potTotal) * 100).toFixed(2)}% Chance
                         </span>
                         <span className="text-4xl font-black text-white flex items-center gap-2 mt-4 bg-[#14151f] px-6 py-2 rounded-2xl border border-yellow-500/50">
                             <RedCoin cls="w-8 h-8"/> {formatValue(potTotal)}
                         </span>
                     </div>
                 </div>
             </div>
          )}

          <div className="bg-[#0b0e14] border-b border-[#252839] p-6 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
            
            <div className="flex flex-col items-center md:items-start bg-[#14151f] px-8 py-4 rounded-2xl border border-[#252839]">
              <span className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Total Pot Value</span>
              <span className="text-4xl font-black text-white flex items-center gap-3 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <RedCoin cls="w-8 h-8" /> {formatValue(potTotal)}
              </span>
              <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mt-2 bg-[#252839] px-3 py-1 rounded-full">{groupedPlayers.length} Players in pot</span>
            </div>

            {/* Timer / Rolling Status */}
            <div className="flex flex-col items-center justify-center min-w-[150px]">
              {gameState === 'betting' ? (
                <>
                  <div className={`w-24 h-24 rounded-full border-4 border-[#252839] flex items-center justify-center relative shadow-inner mb-3 bg-[#14151f] ${groupedPlayers.length === 0 ? 'opacity-50' : ''}`}>
                    <div className="absolute inset-0 rounded-full border-4 border-[#ef4444] transition-all duration-1000 ease-linear shadow-[0_0_15px_rgba(239,68,68,0.5)]" style={{ clipPath: `polygon(50% 50%, 50% 0, ${timeLeft < 22 ? '100% 0' : '100% 100%'}, ${timeLeft < 11 ? '0 100%' : '100% 100%'}, 0 0)`, opacity: groupedPlayers.length > 0 ? 1 : 0}}></div>
                    <span className={`text-3xl font-black relative z-10 ${timeLeft <= 10 && groupedPlayers.length > 0 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{groupedPlayers.length > 0 ? `${timeLeft}s` : '∞'}</span>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-widest ${groupedPlayers.length > 0 ? 'text-[#ef4444] animate-pulse' : 'text-[#555b82]'}`}>
                      {groupedPlayers.length > 0 ? 'Rolling Soon' : 'Waiting...'}
                  </span>
                </>
              ) : gameState === 'rolling' ? (
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin mb-3 shadow-[0_0_15px_rgba(250,204,21,0.5)]"></div>
                  <span className="text-xl font-black text-[#facc15] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse">Rolling...</span>
                </div>
              ) : (
                <div className="text-center opacity-0"></div> // Space reserved for when banner hides
              )}
            </div>

            {/* Deposit Button */}
            <div className="w-full md:w-auto text-center flex flex-col items-center justify-center">
              <button 
                  onClick={openInventoryModal}
                  disabled={gameState !== 'betting'}
                  className="bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white px-10 py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] disabled:opacity-50 disabled:grayscale transition-all hover:scale-105 active:scale-95 w-full md:w-auto"
                >
                  DEPOSIT ITEMS
              </button>
              <span className="text-[#8f9ac6] text-[10px] font-bold uppercase tracking-widest mt-3">Join the action</span>
            </div>

          </div>

          {/* VISUAL ROULETTE (ONLY VISIBLE IF NO EPIC WIN BANNER OR UNDER IT) */}
          <div className={`w-full h-[180px] bg-[#0b0e14] relative overflow-hidden flex items-center shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] transition-opacity duration-500 ${showEpicWin ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute left-0 top-0 w-1/4 h-full bg-gradient-to-r from-[#14151f] to-transparent z-20 pointer-events-none"></div>
            <div className="absolute right-0 top-0 w-1/4 h-full bg-gradient-to-l from-[#14151f] to-transparent z-20 pointer-events-none"></div>
            
            {/* Winner Line Indicator */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[6px] bg-yellow-400 -translate-x-1/2 z-30 shadow-[0_0_20px_rgba(250,204,21,1)]">
               <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[15px] border-t-yellow-400"></div>
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[15px] border-b-yellow-400"></div>
            </div>

            {gameState !== 'betting' ? (
              <div className="absolute left-1/2 flex items-center h-full will-change-transform"
                   style={{
                     transform: `translateX(calc(-60px + ${offset}px))`,
                     transition: gameState === 'rolling' ? 'transform 8s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none'
                   }}
              >
                {spinnerItems.map((item, idx) => (
                  <div key={idx} className="w-[120px] h-[120px] flex-shrink-0 flex items-center justify-center px-2">
                    <div className="w-full h-full rounded-2xl border-[4px] overflow-hidden shadow-2xl relative bg-[#1c1f2e] transition-all" style={{borderColor: item.color}}>
                      <div className="absolute inset-0 opacity-30 mix-blend-screen" style={{backgroundColor: item.color}}></div>
                      <img src={item.avatar} className="w-full h-full object-cover relative z-10" alt="avatar"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full flex justify-center items-center gap-6 opacity-60 px-4 overflow-hidden">
                {groupedPlayers.length === 0 && (
                    <div className="text-[#555b82] font-black tracking-widest uppercase text-lg border border-[#252839] border-dashed px-10 py-4 rounded-2xl">Be the first to bet!</div>
                )}
                {groupedPlayers.slice(0, 8).map((p, i) => (
                  <div key={i} className="w-20 h-20 rounded-2xl border-4 overflow-hidden animate-float shrink-0 bg-[#1c1f2e] relative" style={{borderColor: p.color, animationDelay: `${i * 0.2}s`}}>
                    <div className="absolute inset-0 opacity-20" style={{backgroundColor: p.color}}></div>
                    <img src={p.avatar} className="w-full h-full object-cover grayscale" alt="waiting"/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PLAYERS LIST (GROUPED) */}
        <h3 className="text-white font-black text-2xl uppercase tracking-widest mb-6 ml-2">Players in Pot</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groupedPlayers.map((player, idx) => {
            const chance = ((player.bet / potTotal) * 100).toFixed(2);
            const isWinner = winner?.id === player.id && gameState === 'finished';
            
            return (
              <div key={idx} className={`bg-[#14151f]/80 backdrop-blur-sm border-2 ${isWinner ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.3)] scale-[1.02]' : 'border-[#252839]'} rounded-2xl p-6 flex flex-col gap-4 transition-all relative overflow-hidden group`}>
                
                <div className="absolute left-0 top-0 bottom-0 w-2" style={{backgroundColor: player.color}}></div>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{background: `radial-gradient(circle at left, ${player.color} 0%, transparent 50%)`}}></div>

                <div className="flex items-center gap-5">
                    <div className="relative">
                      {idx === 0 && <span className="absolute -top-4 -left-3 text-3xl z-20 drop-shadow-lg rotate-[-20deg]">👑</span>}
                      <div className={`w-16 h-16 rounded-full border-[3px] overflow-hidden bg-[#0b0e14] relative z-10 ${isWinner ? 'border-yellow-400' : ''}`} style={!isWinner ? {borderColor: player.color} : {}}>
                        <img src={player.avatar} className="w-full h-full object-cover" alt="p_avatar"/>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-xl truncate">{player.name}</p>
                      <p className="text-[#8f9ac6] font-bold text-sm flex items-center gap-2 mt-1">
                        <RedCoin cls="w-4 h-4"/> {formatValue(player.bet)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`bg-[#0b0e14] border-2 ${isWinner ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-[#252839]'} px-5 py-3 rounded-xl flex items-center gap-1`}>
                        <span className={`font-black text-xl ${isWinner ? 'text-yellow-400' : 'text-white'}`}>{chance}%</span>
                      </div>
                    </div>
                </div>

                {/* Player's Bets Thumbnails */}
                {player.pets && player.pets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-[#0b0e14]/50 rounded-xl border border-[#252839]/50 w-max max-w-full overflow-hidden">
                        {player.pets.slice(0, 10).map((pet, i) => (
                            <div key={i} className="w-10 h-10 rounded-lg border border-[#3f4354] bg-[#14151f] overflow-hidden hover:scale-110 transition-transform shadow-md" title={pet.nombre}>
                                <img src={pet.imagen} className="w-full h-full object-contain p-1" alt="pet"/>
                            </div>
                        ))}
                        {player.pets.length > 10 && (
                            <div className="w-10 h-10 rounded-lg border border-[#3f4354] flex items-center justify-center text-white text-xs font-black bg-[#252839] shadow-md">
                                +{player.pets.length - 10}
                            </div>
                        )}
                    </div>
                )}

              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f4354; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6C63FF; }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-float { animation: floatItem 4s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes floatItem { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
      `}} />
    </div>
  );
}
