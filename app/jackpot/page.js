"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function JackpotPage() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estados de Partida Activa
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState('betting'); // 'betting' | 'rolling' | 'finished'
  const [timeLeft, setTimeLeft] = useState(45);
  const [endTime, setEndTime] = useState(null); // Tiempo global del servidor
  const [betAmount, setBetAmount] = useState('');
  
  // Estados de la ruleta
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [winner, setWinner] = useState(null);
  const [players, setPlayers] = useState([]);
  
  const isResolving = useRef(false);

  const potTotal = players.reduce((sum, p) => sum + p.bet, 0);

  // Inicialización (Usuario y Partida Activa)
  useEffect(() => {
    const initData = async () => {
        // 1. Obtener usuario (Real o Simulado)
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            const { data: profile } = await supabase.from('perfiles').select('username, avatar_url').eq('id', authData.user.id).single();
            setCurrentUser({ id: authData.user.id, username: profile?.username || 'Player', avatar_url: profile?.avatar_url || '/default-avatar.png' });
        } else {
            let tempId = localStorage.getItem('temp_user_id');
            if (!tempId) { tempId = crypto.randomUUID(); localStorage.setItem('temp_user_id', tempId); }
            setCurrentUser({ id: tempId, username: 'Guest_' + tempId.substring(0,4), avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + tempId });
        }

        // 2. Buscar si hay un Jackpot activo (waiting)
        const { data: activeGame } = await supabase
            .from('partidas')
            .select('*')
            .eq('modo_juego', 'jackpot')
            .eq('estado', 'waiting')
            .order('creado_en', { ascending: false })
            .limit(1)
            .single();

        if (activeGame) {
            cargarDatosDePartida(activeGame);
        }
    };
    initData();

    // 3. Suscripción Realtime para Jackpot
    const channel = supabase.channel('jackpot_room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.jackpot" }, 
        (payload) => {
          const game = payload.new;
          
          if (payload.eventType === 'INSERT') {
             cargarDatosDePartida(game);
          } else if (payload.eventType === 'UPDATE') {
             // Si la partida sigue abierta, actualizar jugadores
             if (game.estado === 'waiting') {
                 cargarDatosDePartida(game);
             } 
             // Si la partida cambió a 'completed' y no estábamos resolviendo nosotros
             else if (game.estado === 'completed' && game.resultado?.ganador && gameState === 'betting') {
                 iniciarRuletaVisual(game.resultado.ganador, game.datos_partida.players);
             }
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cargarDatosDePartida = (game) => {
      setActiveGameId(game.id);
      setPlayers(game.datos_partida?.players || []);
      setEndTime(game.datos_partida?.endTime || null);
      if (game.estado === 'waiting') {
          setGameState('betting');
          setWinner(null);
          setOffset(0);
      }
  };

  // Lógica del Timer Global Sincronizado
  useEffect(() => {
    if (gameState !== 'betting' || !endTime) return;
    
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0 && activeGameId && !isResolving.current) {
        resolverPartidaGlobal();
      }
    };

    tick(); // Ejecutar de inmediato
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endTime, gameState, activeGameId]);

  // Manejar Depósito
  const handleDeposit = async () => {
    const val = parseInt(betAmount);
    if (isNaN(val) || val <= 0) return alert("Enter a valid bet!");
    if (!currentUser) return alert("Loading user...");
    
    const colorAsignado = ['#10b981', '#ec4899', '#8b5cf6', '#f97316', '#ef4444', '#3b82f6', '#facc15'][Math.floor(Math.random() * 7)];
    
    const myPlayerEntry = {
      id: currentUser.id,
      name: currentUser.username,
      avatar: currentUser.avatar_url,
      bet: val,
      color: colorAsignado
    };

    if (!activeGameId) {
        // Crear nueva sala de Jackpot si no hay ninguna
        const limitTime = new Date(Date.now() + 45000).toISOString(); // 45 segundos
        const { data, error } = await supabase.from('partidas').insert([{
            modo_juego: 'jackpot',
            creador_id: currentUser.id,
            apuesta_creador: val,
            datos_partida: { players: [myPlayerEntry], endTime: limitTime },
            estado: 'waiting'
        }]).select().single();
        
        if (!error && data) {
            setActiveGameId(data.id);
            setEndTime(limitTime);
            setPlayers([myPlayerEntry]);
        }
    } else {
        // Unirse a la sala existente
        const currentPlayers = [...players];
        // Revisar si ya estoy en el pot para sumar mi apuesta, si no, me agrego
        const existIdx = currentPlayers.findIndex(p => p.id === currentUser.id);
        if (existIdx !== -1) {
            currentPlayers[existIdx].bet += val;
        } else {
            currentPlayers.push(myPlayerEntry);
        }
        currentPlayers.sort((a,b) => b.bet - a.bet);

        await supabase.from('partidas').update({
            datos_partida: { players: currentPlayers, endTime: endTime }
        }).eq('id', activeGameId);
    }
    setBetAmount('');
  };

  // Disparar RPC en el servidor
  const resolverPartidaGlobal = async () => {
      isResolving.current = true;
      setGameState('rolling');

      // Llamamos a la función segura
      const { data: result, error } = await supabase.rpc('resolver_partida_jackpot', { p_partida_id: activeGameId });
      
      // Si retorna null o error, es porque otro usuario ya la resolvió en el mismo momento.
      // El Realtime capturará el UPDATE y lanzará la ruleta para nosotros automáticamente.
      if (result && result.ganador) {
          iniciarRuletaVisual(result.ganador, players);
      }
  };

  const iniciarRuletaVisual = (ganadorReal, currentPlayers) => {
    setGameState('rolling');
    setWinner(ganadorReal);

    // Generar cinta de la ruleta (Ponderada por % para que visualmente concuerde con el pot)
    const localPotTotal = currentPlayers.reduce((sum, p) => sum + p.bet, 0);
    const track = [];
    
    for (let i = 0; i < 60; i++) {
      if (i === 45) { 
        track.push(ganadorReal); // El ganador EXACTO dictado por el servidor
      } else {
        // Relleno aleatorio ponderado
        let randomFill = currentPlayers[0];
        const fillTicket = Math.random() * localPotTotal;
        let fillCurrent = 0;
        for (let p of currentPlayers) {
          fillCurrent += p.bet;
          if (fillTicket <= fillCurrent) { randomFill = p; break; }
        }
        track.push(randomFill);
      }
    }
    
    setSpinnerItems(track);
    setOffset(0);

    // Iniciar animación CSS
    setTimeout(() => {
      const ITEM_WIDTH = 100; // Ancho de cada avatar
      const randomOffset = Math.floor(Math.random() * (ITEM_WIDTH - 20)) - (ITEM_WIDTH / 2 - 10);
      const targetOffset = -(45 * ITEM_WIDTH) + randomOffset;
      setOffset(targetOffset);
      
      // Fin de la animación
      setTimeout(() => {
        setGameState('finished');
        setTimeout(() => {
          // Reset para una nueva ronda limpia
          setActiveGameId(null);
          setPlayers([]);
          setEndTime(null);
          setTimeLeft(45);
          setGameState('betting');
          setWinner(null);
          isResolving.current = false;
        }, 5000); // Muestra al ganador por 5 segundos
      }, 6000); // 6 segundos es lo que dura la transición CSS de la ruleta
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md">
            Jackpot 🎰
          </h1>
          <p className="text-[#8f9ac6] font-bold mt-2">Deposit items or Red Value. The higher your bet, the better your chances.</p>
        </div>

        {/* CONTENEDOR PRINCIPAL: RULETA / ESTADO */}
        <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl shadow-xl overflow-hidden mb-8 relative">
          
          {/* Fila Superior: Total del Pozo y Timer */}
          <div className="bg-[#141323] border-b border-[#252839] p-6 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
            
            <div className="flex flex-col items-center md:items-start">
              <span className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Total Pot Value</span>
              <span className="text-4xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <RedCoin cls="w-8 h-8" /> {formatValue(potTotal)}
              </span>
              <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mt-1">{players.length} Players in pot</span>
            </div>

            {/* Timer Central */}
            <div className="flex flex-col items-center justify-center min-w-[120px]">
              {gameState === 'betting' ? (
                <>
                  <div className={`w-20 h-20 rounded-full border-4 border-[#252839] flex items-center justify-center relative shadow-inner mb-2 bg-[#0b0e14] ${players.length === 0 ? 'opacity-50' : ''}`}>
                    <div className="absolute inset-0 rounded-full border-4 border-[#ef4444] transition-all duration-1000 ease-linear" style={{ clipPath: `polygon(50% 50%, 50% 0, ${timeLeft < 22 ? '100% 0' : '100% 100%'}, ${timeLeft < 11 ? '0 100%' : '100% 100%'}, 0 0)`, opacity: players.length > 0 ? 1 : 0}}></div>
                    <span className="text-2xl font-black text-white relative z-10">{players.length > 0 ? `${timeLeft}s` : '∞'}</span>
                  </div>
                  <span className={`text-xs font-black uppercase tracking-widest ${players.length > 0 ? 'text-[#ef4444] animate-pulse' : 'text-[#555b82]'}`}>
                      {players.length > 0 ? 'Rolling Soon' : 'Waiting...'}
                  </span>
                </>
              ) : gameState === 'rolling' ? (
                <div className="text-center">
                  <span className="text-3xl font-black text-[#facc15] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-pulse">Rolling...</span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-[#3AFF4E] text-xs font-black uppercase tracking-widest mb-1 block">Winner takes all!</span>
                  <span className="text-2xl font-black text-white tracking-widest truncate max-w-[150px] inline-block">{winner?.name}</span>
                </div>
              )}
            </div>

            {/* Formulario de Depósito Rápido */}
            <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 w-full md:w-auto">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-2 block text-center md:text-left">Join the Pot</span>
              <div className="flex gap-2">
                <div className="bg-[#1c1f2e] border border-[#252839] rounded-lg flex items-center px-2 focus-within:border-[#ef4444] transition-colors w-full md:w-48">
                  <RedCoin cls="w-4 h-4 mr-2"/>
                  <input 
                    type="number" 
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={gameState !== 'betting'}
                    placeholder="Enter amount..."
                    className="w-full bg-transparent text-white font-bold text-sm outline-none py-2"
                  />
                </div>
                <button 
                  onClick={handleDeposit}
                  disabled={gameState !== 'betting' || !betAmount}
                  className="bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white px-4 rounded-lg font-black text-xs uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:grayscale transition-all"
                >
                  Bet
                </button>
              </div>
            </div>

          </div>

          {/* LA RULETA VISUAL */}
          <div className="w-full h-[160px] bg-[#0b0e14] relative overflow-hidden flex items-center shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]">
            
            <div className="absolute left-0 top-0 w-1/4 h-full bg-gradient-to-r from-[#1c1f2e] to-transparent z-20 pointer-events-none"></div>
            <div className="absolute right-0 top-0 w-1/4 h-full bg-gradient-to-l from-[#1c1f2e] to-transparent z-20 pointer-events-none"></div>

            <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-[#facc15] -translate-x-1/2 z-30 shadow-[0_0_15px_#facc15]">
               <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#facc15]"></div>
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-[#facc15]"></div>
            </div>

            {gameState !== 'betting' ? (
              <div className="absolute left-1/2 flex items-center h-full will-change-transform"
                   style={{
                     transform: `translateX(calc(-50px + ${offset}px))`,
                     transition: gameState === 'rolling' ? 'transform 6s cubic-bezier(0.15, 0.85, 0.15, 1)' : 'none'
                   }}
              >
                {spinnerItems.map((item, idx) => (
                  <div key={idx} className="w-[100px] h-[100px] flex-shrink-0 flex items-center justify-center px-2">
                    <div className="w-full h-full rounded-full border-4 overflow-hidden shadow-lg relative bg-[#1c1f2e]" style={{borderColor: item.color}}>
                      <div className="absolute inset-0 opacity-20" style={{backgroundColor: item.color}}></div>
                      <img src={item.avatar} className="w-full h-full object-cover relative z-10" alt="avatar"/>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full flex justify-center items-center gap-4 opacity-50 px-4 overflow-hidden">
                {players.length === 0 && (
                    <div className="text-[#555b82] font-black tracking-widest uppercase text-sm">Be the first to bet!</div>
                )}
                {players.slice(0, 8).map((p, i) => (
                  <div key={i} className="w-16 h-16 rounded-full border-2 overflow-hidden animate-float shrink-0" style={{borderColor: p.color, animationDelay: `${i * 0.2}s`}}>
                    <img src={p.avatar} className="w-full h-full object-cover grayscale" alt="waiting"/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LISTA DE JUGADORES (Leaderboard del Pozo) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((player, idx) => {
            const chance = ((player.bet / potTotal) * 100).toFixed(2);
            return (
              <div key={idx} className={`bg-[#1c1f2e] border ${winner?.id === player.id && gameState === 'finished' ? 'border-[#3AFF4E] shadow-[0_0_20px_rgba(58,255,78,0.2)]' : 'border-[#252839]'} rounded-xl p-4 flex items-center gap-4 shadow-lg hover:border-[#3f4354] transition-colors relative overflow-hidden group`}>
                
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{backgroundColor: player.color}}></div>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{background: `radial-gradient(circle at left, ${player.color} 0%, transparent 50%)`}}></div>

                <div className="relative">
                  {idx === 0 && <span className="absolute -top-3 -left-2 text-xl z-20 drop-shadow-md rotate-[-20deg]">👑</span>}
                  <div className="w-12 h-12 rounded-full border-2 overflow-hidden bg-[#141323] relative z-10" style={{borderColor: player.color}}>
                    <img src={player.avatar} className="w-full h-full object-cover" alt="p_avatar"/>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{player.name}</p>
                  <p className="text-[#8f9ac6] font-black text-xs flex items-center gap-1 mt-0.5"><RedCoin cls="w-3 h-3"/> {formatValue(player.bet)}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className={`bg-[#0b0e14] border ${winner?.id === player.id && gameState === 'finished' ? 'border-[#3AFF4E]' : 'border-[#252839]'} px-3 py-1.5 rounded-lg flex items-center gap-1`}>
                    <span className={`font-black text-sm ${winner?.id === player.id && gameState === 'finished' ? 'text-[#3AFF4E]' : 'text-white'}`}>{chance}%</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-float { animation: floatItem 3s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatItem { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
      `}} />
    </div>
  );
}
