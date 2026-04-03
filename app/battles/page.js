"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

// --- HELPERS VISUALES ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function BattlesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('lobby'); // 'lobby' | 'create' | 'arena'
  const [activeBattle, setActiveBattle] = useState(null);
  const [battles, setBattles] = useState([]);
const [modalTipAbierto, setModalTipAbierto] = useState(false);
const abrirModalTip = () => setModalTipAbierto(true);
  // Estados Creador
  const [selectedCases, setSelectedCases] = useState([]);
  const [playerCount, setPlayerCount] = useState(2); 
  const [isCreating, setIsCreating] = useState(false); 

  // Estados Arena
  const [currentRound, setCurrentRound] = useState(-1);
  const [battleResults, setBattleResults] = useState(null);
  const [isJoining, setIsJoining] = useState(false); 
  const resolvingRef = useRef(false);

  // Cajas Disponibles
  const [availableCases, setAvailableCases] = useState([]);  
  
  useEffect(() => {
    const loadCasesForBattles = async () => {
      const { data, error } = await supabase.from('cases').select('id, name, price, image_url, items, color');
      if (data && !error) {
        setAvailableCases(data);
      }
    };
    loadCasesForBattles();
  }, []);
  
  useEffect(() => {
    // 1. Obtener Usuario
    const initUser = async () => {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', authData.user.id).single();
            setCurrentUser({ id: authData.user.id, username: profile?.username || 'Player', avatar_url: profile?.avatar_url || '/default-avatar.png' });
        } else {
            let tempId = localStorage.getItem('temp_user_id');
            if (!tempId) { tempId = crypto.randomUUID(); localStorage.setItem('temp_user_id', tempId); }
            setCurrentUser({ id: tempId, username: 'Guest_' + tempId.substring(0,4), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + tempId });
        }
    };
    initUser();

    // 2. Cargar Batallas
    const cargarPartidas = async () => {
      const { data } = await supabase.from('partidas').select('*').eq('modo_juego', 'battles').in('estado', ['waiting', 'in_progress', 'completed']).order('creado_en', { ascending: false }).limit(20);
      if (data) setBattles(data);
    };
    cargarPartidas();

    // 3. Suscripción a Realtime
    const channel = supabase.channel('battles_lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.battles" }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBattles(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setBattles(prev => {
                const arr = [...prev];
                const idx = arr.findIndex(g => g.id === payload.new.id);
                if (idx !== -1) arr[idx] = payload.new; else arr.unshift(payload.new);
                return arr;
            });
            
            // Si la partida que estamos viendo en la Arena se actualiza
            setActiveBattle(prev => {
                if (prev && prev.id === payload.new.id) {
                    if (prev.estado === 'waiting' && payload.new.estado === 'in_progress') {
                        iniciarResolucionBatalla(payload.new);
                    } else if (payload.new.estado === 'completed' && !resolvingRef.current) {
                        setBattleResults(payload.new.resultado);
                        // ARMADURA ANTI-CRASH:
                        setCurrentRound((payload.new.datos_partida?.cases || []).length); 
                    }
                    return payload.new;
                }
                return prev;
            });
          } else if (payload.eventType === 'DELETE') {
            setBattles(prev => prev.filter(g => g.id !== payload.old.id));
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- LÓGICA DE CREACIÓN ---
  const addCase = (caja) => {
    if (selectedCases.length >= 10) return alert("Maximum 10 cases per battle!");
    setSelectedCases([...selectedCases, { ...caja, uniqueId: crypto.randomUUID() }]);
  };
  const removeCase = (uniqueId) => setSelectedCases(selectedCases.filter(c => c.uniqueId !== uniqueId));
  const totalCost = selectedCases.reduce((sum, caja) => sum + caja.price, 0);

  const handleCreate = async () => {
    if (selectedCases.length === 0) return alert("Add at least one case!");
    if (!currentUser) return alert("Loading user...");
    if (isCreating) return; 
    setIsCreating(true);

    try {
      const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', currentUser.id).single();
      if (profile.saldo_verde < totalCost) {
          alert("No tienes suficiente Saldo Verde.");
          setIsCreating(false); return;
      }
      await supabase.from('profiles').update({ saldo_verde: profile.saldo_verde - totalCost }).eq('id', currentUser.id);

      const datosPartida = { 
          cases: selectedCases,
          playerCount: playerCount,
          players: [{ id: currentUser.id, name: currentUser.username, avatar: currentUser.avatar_url }],
          cost: totalCost
      };

      const { data: nuevaPartida, error } = await supabase.from('partidas').insert({
          modo_juego: 'battles',
          creador_id: currentUser.id,
          apuesta_creador: [], 
          datos_partida: datosPartida,
          estado: 'waiting'
      }).select().single();

      if (error) throw error;

      setSelectedCases([]);
      setView('arena');
      setActiveBattle(nuevaPartida);
      setBattleResults(null);
      setCurrentRound(-1);
    } catch (err) {
      console.error("Error creando:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const joinBattle = async (battle) => {
    // ARMADURA ANTI-CRASH:
    const battleCases = battle.datos_partida?.cases || [];
    const currentPlayers = battle.datos_partida?.players || [];

    if (battle.estado === 'completed' || battle.estado === 'in_progress') {
        setActiveBattle(battle);
        if(battle.resultado) setBattleResults(battle.resultado);
        setCurrentRound(battleCases.length);
        setView('arena'); return;
    }
    
    if (currentPlayers.some(p => p.id === currentUser.id)) {
        setActiveBattle(battle); setView('arena'); return;
    }

    if (isJoining) return;
    setIsJoining(true);

    try {
      const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', currentUser.id).single();
      if (profile.saldo_verde < (battle.datos_partida?.cost || 0)) {
          alert("Saldo Verde insuficiente para unirse.");
          setIsJoining(false); return;
      }
      await supabase.from('profiles').update({ saldo_verde: profile.saldo_verde - (battle.datos_partida?.cost || 0) }).eq('id', currentUser.id);

      const userInfo = { id: currentUser.id, name: currentUser.username, avatar: currentUser.avatar_url };
      const newPlayers = [...currentPlayers, userInfo];
      const isFull = newPlayers.length === (battle.datos_partida?.playerCount || 2);

      const { data: updatedBattle, error } = await supabase.from('partidas').update({
          datos_partida: { ...battle.datos_partida, players: newPlayers },
          retador_id: currentUser.id,
          apuesta_retador: [], 
          estado: isFull ? 'in_progress' : 'waiting'
      }).eq('id', battle.id).select().single();

      if (error) throw error;

      setActiveBattle(updatedBattle);
      setView('arena');
      setBattleResults(null);
      setCurrentRound(-1);

      if (isFull) {
          iniciarResolucionBatalla(updatedBattle);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsJoining(false);
    }
  };

  const iniciarResolucionBatalla = async (battle) => {
      if (resolvingRef.current) return;
      resolvingRef.current = true;

      const rounds = [];
      const playerTotals = {};
      
      // ARMADURA ANTI-CRASH:
      const battlePlayers = battle.datos_partida?.players || [];
      const battleCases = battle.datos_partida?.cases || [];

      if (battlePlayers.length === 0 || battleCases.length === 0) {
          resolvingRef.current = false;
          return;
      }

      battlePlayers.forEach(p => playerTotals[p.id] = 0);

      battleCases.forEach((caja, roundIdx) => {
          battlePlayers.forEach(p => {
              const randomItem = caja.items[Math.floor(Math.random() * caja.items.length)];
              const valorItem = randomItem.price || randomItem.value || 0;
              
              rounds.push({
                  round: roundIdx,
                  player_id: p.id,
                  item: { name: randomItem.name, valor: valorItem, img: randomItem.image_url, color: randomItem.color, chance: randomItem.chance || 10 }
              });
              playerTotals[p.id] += valorItem;
          });
      });

      let ganador_id = battlePlayers[0].id;
      let maxVal = playerTotals[ganador_id];
      battlePlayers.forEach(p => {
          if (playerTotals[p.id] > maxVal) {
              maxVal = playerTotals[p.id];
              ganador_id = p.id;
          }
      });

      const resultado = { ganador_id, rounds, totals: playerTotals };

      await supabase.from('partidas').update({
          estado: 'completed',
          resultado: resultado
      }).eq('id', battle.id);

      const { data: winnerProf } = await supabase.from('profiles').select('saldo_verde').eq('id', ganador_id).single();
      let totalGanancia = 0;
      Object.values(playerTotals).forEach(v => totalGanancia += v);
      await supabase.from('profiles').update({ saldo_verde: winnerProf.saldo_verde + totalGanancia }).eq('id', ganador_id);

      setBattleResults(resultado);
      let r = 0;
      const totalRounds = battleCases.length;
      const interval = setInterval(() => {
          setCurrentRound(r);
          r++;
          if (r > totalRounds) {
              clearInterval(interval);
              resolvingRef.current = false;
          }
      }, 1500);
  };

  const getPlayerItemForRound = (playerId, roundIndex) => {
      if (!battleResults || !battleResults.rounds) return null;
      const roll = battleResults.rounds.find(r => r.round === roundIndex && r.player_id === playerId);
      return roll ? roll.item : null;
  };

  const getPlayerVisualTotal = (playerId) => {
      if (!battleResults || !battleResults.rounds || currentRound < 0) return 0;
      let total = 0;
      for (let i = 0; i <= currentRound; i++) {
          const item = getPlayerItemForRound(playerId, i);
          if (item) total += item.valor;
      }
      return total;
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* =========================================
            VISTA 1: LOBBY DE BATALLAS
        ========================================= */}
        {view === 'lobby' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ef4444] to-[#f87171] drop-shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-3">
                  ⚔️ Case Battles
                </h1>
                <p className="text-[#8f9ac6] font-bold mt-2">Go head-to-head. Winner takes all items.</p>
              </div>
              <button 
                onClick={() => setView('create')}
                className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] hover:-translate-y-1"
              >
                Create Battle
              </button>
            </div>

            <div className="space-y-4">
              {battles.length === 0 && <p className="text-[#8f9ac6] text-center py-10">No active battles. Create one!</p>}
              
              {battles.map((battle) => {
                  const isCompleted = battle.estado === 'completed';
                  // ARMADURA ANTI-CRASH APLICADA AQUÍ:
                  const pData = battle.datos_partida || {};
                  const battleCases = pData.cases || [];
                  const battlePlayers = pData.players || [];
                  
                  return (
                  <div key={battle.id} className={`bg-[#1c1f2e] border ${isCompleted ? 'border-[#252839] opacity-80' : 'border-[#252839] hover:border-[#ef4444]/50'} rounded-2xl p-4 flex flex-col xl:flex-row items-center gap-6 transition-all shadow-lg group relative`}>
                    
                    {isCompleted && <div className="absolute top-0 left-0 bg-[#252839] text-[#8f9ac6] text-[9px] font-black uppercase px-2 py-0.5 rounded-tl-2xl rounded-br-lg tracking-widest">Finished</div>}

                    {/* Jugadores */}
                    <div className="flex items-center gap-2 w-full xl:w-auto justify-center xl:justify-start pt-4 xl:pt-0">
                      {Array.from({ length: pData.playerCount || 2 }).map((_, idx) => {
                        const user = battlePlayers[idx];
                        const isWinner = isCompleted && battle.resultado?.ganador_id === user?.id;
                        
                        return (
                        <div key={idx} className="relative flex items-center">
                          {isWinner && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl z-20 drop-shadow-md">👑</span>}
                          {user ? (
                            <div className={`w-12 h-12 rounded-full border-2 ${isWinner ? 'border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.5)]' : 'border-[#ef4444]'} overflow-hidden bg-[#141323] z-10`}>
                              <img src={user.avatar} className="w-full h-full object-cover" alt="player"/>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#555b82] flex items-center justify-center bg-[#141323]/50 z-10">
                              <span className="text-[#555b82] font-black">?</span>
                            </div>
                          )}
                        </div>
                      )})}
                    </div>

                    {/* Cajas a abrir */}
                    <div className="flex-1 w-full bg-[#141323] border border-[#252839] rounded-xl p-3 flex items-center gap-3 overflow-x-auto custom-scrollbar">
                      {battleCases.map((caja, idx) => (
                        <div key={idx} className="relative w-12 h-12 shrink-0 bg-[#1c1f2e] border border-[#252839] rounded-lg flex items-center justify-center">
                          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${caja.color || '#fff'} 0%, transparent 70%)` }}></div>
                          <img src={caja.image_url} className="w-8 h-8 object-contain drop-shadow-md z-10" alt="case" style={{filter: `drop-shadow(0 0 5px ${caja.color || '#fff'}80)`}}/>
                        </div>
                      ))}
                      <span className="text-[#555b82] font-black text-xs ml-2 shrink-0">{battleCases.length} Rounds</span>
                    </div>

                    {/* Costo y Botón */}
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
                      <div className="text-center sm:text-right">
                        <p className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest">Total Cost</p>
                        <p className={`text-xl font-black flex items-center gap-1.5 ${isCompleted ? 'text-[#8f9ac6]' : 'text-white'}`}><GreenCoin cls="w-5 h-5"/> {formatValue(pData.cost || 0)}</p>
                      </div>
                      <button 
                        onClick={() => joinBattle(battle)}
                        disabled={isJoining}
                        className={`w-full sm:w-32 py-3 border font-black rounded-xl text-xs uppercase tracking-widest transition-all ${isCompleted ? 'bg-[#2a2e44] text-[#8f9ac6] border-[#3f4354] hover:bg-[#32364f]' : 'bg-[#2a2e44] hover:bg-gradient-to-r hover:from-[#ef4444] hover:to-[#dc2626] border-[#3f4354] hover:border-transparent text-white shadow-md group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'} disabled:opacity-50`}
                      >
                        {isJoining ? 'Wait...' : (isCompleted ? 'View Battle' : (battlePlayers.some(p => p.id === currentUser?.id) ? 'View' : 'Join Battle'))}
                      </button>
                    </div>
                  </div>
              )})}
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 2: CREAR BATALLA
        ========================================= */}
        {view === 'create' && (
          <div className="animate-fade-in">
            <button onClick={() => setView('lobby')} className="w-max text-[#8f9ac6] hover:text-[#ef4444] font-bold text-sm flex items-center gap-1 transition-colors bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] mb-6">
              &lsaquo; Back to Lobby
            </button>

            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* PANEL IZQ: CONFIG Y TOTAL */}
              <div className="w-full lg:w-1/3 flex flex-col gap-6">
                <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
                  <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Players</h3>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(num => (
                      <button 
                        key={num} onClick={() => setPlayerCount(num)}
                        className={`flex-1 py-3 rounded-xl border-2 font-black text-lg transition-all ${playerCount === num ? 'bg-[#ef4444]/10 border-[#ef4444] text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-[#141323] border-[#252839] text-[#555b82] hover:border-[#3f4354]'}`}
                      >
                        {num}P
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Selected Cases</h3>
                    <span className="text-[#555b82] text-xs font-black">{selectedCases.length}/10</span>
                  </div>

                  <div className="flex-1 min-h-[150px] bg-[#141323] border border-[#252839] rounded-xl p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar mb-6">
                    {selectedCases.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[#555b82] font-bold text-sm text-center px-4">
                        Click cases on the right to add them to your battle.
                      </div>
                    ) : (
                      selectedCases.map((caja, idx) => (
                        <div key={caja.uniqueId} className="bg-[#1c1f2e] border border-[#252839] rounded-lg p-2 flex items-center gap-3 animate-fade-in">
                          <span className="text-[#555b82] font-black text-xs w-4">{idx + 1}</span>
                          <div className="w-8 h-8 relative shrink-0">
                            <img src={caja.image_url} className="w-full h-full object-contain drop-shadow-md z-10 relative" alt="case"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs truncate" style={{color: caja.color}}>{caja.name}</p>
                            <p className="text-[#8f9ac6] font-black text-[10px] flex items-center gap-1"><GreenCoin cls="w-2.5 h-2.5"/> {formatValue(caja.price)}</p>
                          </div>
                          <button onClick={() => removeCase(caja.uniqueId)} className="text-[#ef4444] hover:bg-[#ef4444]/20 p-1.5 rounded-md transition-colors">✖</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-[#252839] pt-4">
                    <div className="flex justify-between items-end mb-4">
                      <span className="text-[#8f9ac6] font-bold uppercase tracking-widest text-xs">Total Cost:</span>
                      <span className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
                        <GreenCoin cls="w-6 h-6"/> {formatValue(totalCost)}
                      </span>
                    </div>
                    <button onClick={handleCreate} disabled={selectedCases.length === 0 || isCreating} className="w-full py-4 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(239,68,68,0.4)] disabled:opacity-50 disabled:grayscale hover:-translate-y-1">
                      {isCreating ? 'Creating...' : 'Call to Battle'}
                    </button>
                  </div>
                </div>
              </div>

              {/* PANEL DER: TIENDA CAJAS */}
              <div className="w-full lg:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
                <h3 className="text-white text-lg font-black uppercase tracking-widest mb-6">Available Cases</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {availableCases.map((caja) => (
                    <div key={caja.id} onClick={() => addCase(caja)} className="bg-[#141323] border border-[#252839] hover:border-[#ef4444] rounded-xl p-4 flex flex-col items-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(239,68,68,0.15)] group relative">
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: `radial-gradient(circle at center, ${caja.color} 0%, transparent 70%)` }}></div>
                      <img src={caja.image_url} className="w-16 h-16 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform mb-3 relative z-10" alt={caja.name} style={{filter: `drop-shadow(0 0 10px ${caja.color}60)`}}/>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1 text-center z-10">{caja.name}</h4>
                      <p className="text-[#3AFF4E] font-black text-xs flex items-center gap-1 z-10"><GreenCoin cls="w-3 h-3"/> {formatValue(caja.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================
            VISTA 3: ARENA (LA BATALLA)
        ========================================= */}
        {view === 'arena' && activeBattle && (
          <div className="animate-fade-in flex flex-col min-h-[70vh]">
             <button onClick={() => setView('lobby')} className="w-max text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-1 transition-colors bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] mb-6">
              &lsaquo; Back to Battles
            </button>
            
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-2xl flex-1 flex flex-col overflow-hidden">
                
                {/* HEADER ARENA */}
                <div className="flex justify-between items-center mb-8 border-b border-[#252839] pb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-1">Battle Arena</h2>
                        {/* ARMADURA ANTI-CRASH APLICADA AQUÍ */}
                        <p className="text-[#8f9ac6] font-bold text-sm">{(activeBattle.datos_partida?.cases || []).length} Rounds • Total Value: <span className="text-[#3AFF4E]"><GreenCoin/> {formatValue(activeBattle.datos_partida?.cost || 0)}</span></p>
                    </div>
                    {activeBattle.estado === 'waiting' && (
                        <div className="flex items-center gap-3 bg-[#141323] border border-[#2F3347] px-4 py-2 rounded-lg animate-pulse">
                            <span className="w-3 h-3 rounded-full bg-[#facc15]"></span>
                            <span className="text-[#facc15] font-black text-sm tracking-widest uppercase">Waiting for players ({(activeBattle.datos_partida?.players || []).length}/{activeBattle.datos_partida?.playerCount || 2})</span>
                        </div>
                    )}
                    {currentRound >= (activeBattle.datos_partida?.cases || []).length && (
                        <div className="flex items-center gap-3 bg-[#141323] border border-[#3AFF4E] px-4 py-2 rounded-lg">
                            <span className="text-[#3AFF4E] font-black text-lg tracking-widest uppercase">Battle Completed</span>
                        </div>
                    )}
                </div>

                {/* COLUMNAS DE JUGADORES */}
                <div className="flex-1 grid gap-4 relative" style={{ gridTemplateColumns: `repeat(${activeBattle.datos_partida?.playerCount || 2}, minmax(0, 1fr))` }}>
                    
                    {Array.from({ length: activeBattle.datos_partida?.playerCount || 2 }).map((_, pIdx) => {
                        const player = (activeBattle.datos_partida?.players || [])[pIdx];
                        const isWinner = battleResults && battleResults.ganador_id === player?.id && currentRound >= (activeBattle.datos_partida?.cases || []).length;
                        const currentTotal = player ? getPlayerVisualTotal(player.id) : 0;

                        return (
                        <div key={pIdx} className={`flex flex-col bg-[#141323] border ${isWinner ? 'border-[#facc15] shadow-[0_0_30px_rgba(250,204,21,0.2)]' : 'border-[#252839]'} rounded-xl overflow-hidden relative transition-all`}>
                            
                            {/* Cabecera Jugador */}
                            <div className={`p-4 border-b ${isWinner ? 'border-[#facc15] bg-[#facc15]/10' : 'border-[#252839] bg-[#1c1f2e]'} flex flex-col items-center relative z-20`}>
                                {isWinner && <span className="absolute top-2 text-2xl drop-shadow-md z-30 animate-bounce">👑</span>}
                                {player ? (
                                    <>
                                        <div className={`w-16 h-16 rounded-full border-2 ${isWinner ? 'border-[#facc15]' : 'border-[#ef4444]'} overflow-hidden bg-[#0b0e14] mb-3`}>
                                            <img src={player.avatar} className="w-full h-full object-cover" alt={player.name}/>
                                        </div>
                                        <h3 className="font-black text-white truncate w-full text-center text-sm mb-1">{player.name}</h3>
                                        <div className="bg-[#0b0e14] border border-[#2F3347] rounded-md px-3 py-1 flex items-center gap-1">
                                            <GreenCoin cls="w-4 h-4"/>
                                            <span className={`font-black ${isWinner ? 'text-[#facc15]' : 'text-white'}`}>{formatValue(currentTotal)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#555b82] flex items-center justify-center bg-[#0b0e14] mb-3">
                                            <span className="text-[#555b82] font-black text-xl">?</span>
                                        </div>
                                        <h3 className="font-black text-[#555b82] text-sm mb-1">Waiting...</h3>
                                    </>
                                )}
                            </div>

                            {/* Rondas (Cajas/Items) */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2 relative">
                                {(activeBattle.datos_partida?.cases || []).map((caja, rIdx) => {
                                    const revealedItem = player && rIdx <= currentRound ? getPlayerItemForRound(player.id, rIdx) : null;
                                    const isCurrentSpinning = activeBattle.estado !== 'waiting' && rIdx === currentRound && !revealedItem;

                                    return (
                                    <div key={rIdx} className={`h-28 rounded-lg border relative flex items-center justify-center overflow-hidden transition-all ${revealedItem ? 'border-[#3f4354] bg-[#1c1f2e]' : 'border-[#252839] bg-[#0b0e14]'}`}>
                                        
                                        {!revealedItem && !isCurrentSpinning && (
                                            <div className="opacity-40 grayscale flex flex-col items-center">
                                                <img src={caja.image_url} className="w-10 h-10 object-contain drop-shadow-md" alt="case"/>
                                            </div>
                                        )}

                                        {isCurrentSpinning && (
                                            <div className="flex flex-col items-center animate-pulse">
                                                <img src={caja.image_url} className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-bounce" alt="case" style={{filter: `drop-shadow(0 0 10px ${caja.color}80)`}}/>
                                                <span className="text-[10px] font-black text-[#8f9ac6] mt-2 uppercase">Unboxing...</span>
                                            </div>
                                        )}

                                        {revealedItem && (
                                            <div className="w-full h-full flex flex-col items-center justify-center animate-fade-in relative group">
                                                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${revealedItem.color} 0%, transparent 70%)` }}></div>
                                                <div className="absolute top-1 right-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-[#0b0e14]/80 border border-[#252839] text-white z-10">{revealedItem.chance}%</div>
                                                <img src={revealedItem.img || revealedItem.image_url} className="w-14 h-14 object-contain drop-shadow-lg z-10 group-hover:scale-110 transition-transform" alt="item"/>
                                                <p className="text-[10px] font-bold truncate w-full text-center px-1 z-10 mt-1" style={{color: revealedItem.color}}>{revealedItem.name}</p>
                                                <p className="text-white font-black text-[10px] flex items-center gap-1 z-10"><GreenCoin cls="w-2.5 h-2.5"/> {formatValue(revealedItem.valor)}</p>
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
