"use client";
import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

// --- HELPERS Y UI ---
const formatValue = (val) => {
  if (val === "O/C") return "O/C";
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const imgMonedaHeads = '/heads.png';
const imgMonedaTails = '/tails.png';

// Helper para extraer las pets
const extractPets = (apuesta) => {
    if (!apuesta) return [];
    if (Array.isArray(apuesta)) return apuesta; 
    if (apuesta.detalle_completo && Array.isArray(apuesta.detalle_completo)) return apuesta.detalle_completo; 
    if (apuesta.items && Array.isArray(apuesta.items) && typeof apuesta.items[0] === 'object') return apuesta.items; 
    return [];
};

const formatGameToUI = (dbGame) => {
    return {
        id: dbGame.id,
        creador_id: dbGame.creador_id,
        retador_id: dbGame.retador_id,
        host: dbGame.datos_partida?.host_name || 'Player',
        avatar: dbGame.datos_partida?.avatar_creador || '/default-avatar.png',
        lado: dbGame.datos_partida?.lado_creador || 'Heads',
        petsHost: extractPets(dbGame.apuesta_creador),
        valorTotalHost: dbGame.datos_partida?.valor_total || 0,
        estado: dbGame.estado,
        challenger: dbGame.datos_partida?.challenger_name || 'Challenger',
        avatarChallenger: dbGame.datos_partida?.avatar_challenger || '/default-avatar.png',
        petsChallenger: extractPets(dbGame.apuesta_retador),
        resultado: dbGame.resultado || null,
        creado_en: dbGame.creado_en,
        datos_partida_raw: dbGame.datos_partida || {}
    };
};

const playAudio = (src, vol = 0.5) => {
    try {
        const audio = new Audio(src);
        audio.volume = vol;
        audio.play().catch(() => {});
    } catch (e) {}
};

// --- MINI PET GRID COMPONENT PARA ARENA ---
const MiniPetGrid = ({ pets }) => {
    if(!pets || pets.length === 0) return null;
    return (
        <div className="flex justify-center flex-wrap gap-1 mt-3 w-full max-w-[140px] md:max-w-[180px] animate-fade-in">
            {pets.slice(0, 8).map((p,i) => (
                <div key={i} className="w-7 h-7 md:w-9 md:h-9 bg-[#0b0e14] border border-[#252839] rounded-md shadow-inner flex items-center justify-center p-0.5 hover:scale-110 hover:border-[#6C63FF] transition-all" title={p.nombre || p.name}>
                    <img src={p.image_url || p.imagen || p.url} className="w-full h-full object-contain drop-shadow-md" alt="pet"/>
                </div>
            ))}
            {pets.length > 8 && <div className="w-7 h-7 md:w-9 md:h-9 bg-[#0b0e14] border border-[#252839] rounded-md flex items-center justify-center text-[#8f9ac6] text-[9px] font-black shadow-inner">+{pets.length - 8}</div>}
        </div>
    )
};

export default function BloxypotCoinflip() {
  const [currentUser, setCurrentUser] = useState(null);
  const [misPets, setMisPets] = useState([]);
  const [vistaActual, setVistaActual] = useState('lobby'); 
  
  // ANTI-LAG
  const [visiblePetsCount, setVisiblePetsCount] = useState(60);
  
  // Estados de Animación
  const [cuentaRegresiva, setCuentaRegresiva] = useState(null);
  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [ganador, setGanador] = useState(null);
  const [mostrarImpacto, setMostrarImpacto] = useState(false);
  const [isSpectatingCompleted, setIsSpectatingCompleted] = useState(false);
  const animacionIniciada = useRef(false);

  // Estados Creador
  const [creatorSelectedPets, setCreatorSelectedPets] = useState([]);
  const [creatorSide, setCreatorSide] = useState(null); 
  const [creatorSearch, setCreatorSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Estados Join/Arena
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null); 
  const [selectedPetsToJoin, setSelectedPetsToJoin] = useState([]);
  const [modalJoinAbierto, setModalJoinAbierto] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Lobby
  const [lobbyGames, setLobbyGames] = useState([]);

  useEffect(() => {
    // 1. INICIALIZAR USUARIO Y MASCOTAS
    const initUserAndInventory = async () => {
        const { data: authData } = await supabase.auth.getUser();
        
        if (authData?.user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', authData.user.id)
                .single();

            setCurrentUser({ 
                id: authData.user.id, 
                username: profile?.username || 'Player',
                avatar_url: profile?.avatar_url || '/default-avatar.png'
            });

            const { data: inventoryData, error } = await supabase
                .from('inventory')
                .select(`id, is_locked, items ( id, name, value, image_url, color )`)
                .eq('user_id', authData.user.id)
                .eq('is_locked', false)
                .limit(3000); 

            if (inventoryData && !error) {
                const mascotasReales = inventoryData.map(inv => ({
                    inventarioId: inv.id, item_id: inv.items.id, nombre: inv.items.name, valor: inv.items.value, image_url: inv.items.image_url, color: inv.items.color
                }));
                setMisPets(mascotasReales.sort((a, b) => b.valor - a.valor));
            } else { setMisPets([]); }
        }
    };
    initUserAndInventory();

    // 2. CARGAR PARTIDAS
    const cargarPartidas = async () => {
      const { data, error } = await supabase.from('partidas').select('*').eq('modo_juego', 'coinflip').in('estado', ['waiting', 'in_progress', 'completed']).order('creado_en', { ascending: false }).limit(30); 
      if (!error && data) setLobbyGames(data.map(formatGameToUI));
    };
    cargarPartidas();

    // 3. REALTIME LOBBY
    const channel = supabase.channel('lobby_coinflip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partidas', filter: "modo_juego=eq.coinflip" }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLobbyGames(prev => [formatGameToUI(payload.new), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const formatted = formatGameToUI(payload.new);
            setLobbyGames(prev => {
                const index = prev.findIndex(g => g.id === formatted.id);
                if (index !== -1) {
                    const newArr = [...prev];
                    newArr[index] = formatted;
                    return newArr;
                }
                return [formatted, ...prev];
            });

            // Si nosotros creamos y alguien se unió:
            setPartidaSeleccionada((prevPartida) => {
                if (prevPartida && prevPartida.id === formatted.id) {
                    if (prevPartida.estado === 'waiting' && formatted.estado === 'completed' && formatted.resultado) {
                        if (currentUser && formatted.creador_id === currentUser.id) {
                           setVistaActual('arena'); 
                           iniciarCinematicaMoneda(formatted);
                        }
                    }
                    return formatted;
                }
                return prevPartida;
            });
          } else if (payload.eventType === 'DELETE') {
            setLobbyGames(prev => prev.filter(game => game.id !== payload.old.id));
            setPartidaSeleccionada((prev) => {
               if(prev && prev.id === payload.old.id) { setVistaActual('lobby'); return null; }
               return prev;
            });
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // --- FUNCIÓN ANTI-LAG ---
  const handleScrollInventario = (e) => {
      const { scrollTop, clientHeight, scrollHeight } = e.target;
      if (scrollHeight - scrollTop <= clientHeight + 100) setVisiblePetsCount(prev => prev + 60);
  };

  // --- LÓGICA DE CREACIÓN ---
  const creatorFilteredPets = useMemo(() => {
    let items = [...misPets];
    if (creatorSearch) items = items.filter(i => i.nombre.toLowerCase().includes(creatorSearch.toLowerCase()));
    return items;
  }, [misPets, creatorSearch]);

  const totalCreatorValue = useMemo(() => creatorSelectedPets.reduce((sum, p) => sum + (typeof p.valor === 'number' ? p.valor : 0), 0), [creatorSelectedPets]);
  
  const toggleCreatorPet = (pet) => {
    if(creatorSelectedPets.some(p => p.inventarioId === pet.inventarioId)) setCreatorSelectedPets(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
    else setCreatorSelectedPets(prev => [...prev, pet]);
  };

  const handleAutoSelectCreate = () => {
    const sorted = [...misPets].sort((a, b) => b.valor - a.valor);
    setCreatorSelectedPets(sorted.slice(0, 3));
  };

  const handleCreateGame = async () => {
      if (!currentUser) return alert("Please log in to play.");
      if (creatorSelectedPets.length === 0) return alert("Please select pets to bet first.");
      if (!creatorSide) return alert("Select Heads or Tails.");
      
      if (isCreating) return;
      setIsCreating(true);

      try {
          const { data: activeGames } = await supabase.from('partidas').select('id').eq('creador_id', currentUser.id).eq('modo_juego', 'coinflip').eq('estado', 'waiting');
          if (activeGames && activeGames.length >= 1) {
              alert("You already have a game waiting in the lobby. Cancel it first if you want to create a new one!");
              setVistaActual('lobby');
              setIsCreating(false);
              return;
          }

          const petIds = creatorSelectedPets.map(p => p.inventarioId);
          const { error: errLock } = await supabase.from('inventory').update({ is_locked: true }).in('id', petIds);
          if (errLock) throw new Error("Error locking pets.");

          setMisPets(prev => prev.filter(p => !petIds.includes(p.inventarioId)));

          const datosPartida = { host_name: currentUser.username, avatar_creador: currentUser.avatar_url, lado_creador: creatorSide, valor_total: totalCreatorValue };

          const { data: nuevaPartida, error } = await supabase.from('partidas').insert({
              modo_juego: 'coinflip', creador_id: currentUser.id, apuesta_creador: creatorSelectedPets, datos_partida: datosPartida, estado: 'waiting'
          }).select().single();

          if (error) throw error;

          setCreatorSelectedPets([]);
          setCreatorSide(null);
          
          const uiGame = formatGameToUI(nuevaPartida);
          setPartidaSeleccionada(uiGame);
          setVistaActual('esperando'); 
          
      } catch (err) {
          console.error("Error creating coinflip:", err);
          alert("Error: " + err.message);
      } finally {
          setIsCreating(false);
      }
  };

  // --- LÓGICA DE CANCELACIÓN ---
  const cancelarPartida = async (gameId) => {
      if (!currentUser || isCanceling) return;
      setIsCanceling(true);
      
      try {
          const { data: partida, error: fetchErr } = await supabase.from('partidas').select('*').eq('id', gameId).single();
          if (fetchErr || !partida) {
              setLobbyGames(prev => prev.filter(g => g.id !== gameId));
              setVistaActual('lobby');
              setIsCanceling(false);
              return;
          }

          if (partida.estado !== 'waiting') {
              alert("This game cannot be canceled anymore (Someone joined!).");
              setIsCanceling(false);
              return;
          }

          // FORZAMOS LA DEVOLUCIÓN DE LAS PETS
          const petsDelCreador = extractPets(partida.apuesta_creador);
          const petIds = petsDelCreador.map(p => p.inventarioId || p.id).filter(Boolean);
          
          if (petIds.length > 0) {
              const { error: unlockErr } = await supabase.from('inventory').update({ is_locked: false }).in('id', petIds);
              if (unlockErr) console.error("Unlock error (Might already be unlocked):", unlockErr);
          }

          // DESTRUIMOS LA PARTIDA SÍ O SÍ
          const { error: delErr } = await supabase.from('partidas').delete().eq('id', gameId);
          if (delErr) throw delErr;
          
          // Actualización UI inmediata para evitar ghosting visual
          setLobbyGames(prev => prev.filter(g => g.id !== gameId));
          setPartidaSeleccionada(null);
          setVistaActual('lobby');
          alert("Game canceled! Pets are back in your inventory.");
          
          // Refrescar inventario local
          const { data: inventoryData } = await supabase.from('inventory').select(`id, is_locked, items ( id, name, value, image_url, color )`).eq('user_id', currentUser.id).eq('is_locked', false).limit(3000); 
          if (inventoryData) {
              setMisPets(inventoryData.map(inv => ({ inventarioId: inv.id, item_id: inv.items.id, nombre: inv.items.name, valor: inv.items.value, image_url: inv.items.image_url, color: inv.items.color })).sort((a, b) => b.valor - a.valor));
          }

      } catch (err) {
          console.error("Cancel error:", err);
          alert("Error deleting game: " + err.message);
      } finally {
          setIsCanceling(false);
      }
  };

  // --- LÓGICA JOIN ---
  const abrirModalJoin = (juego) => { 
      setSelectedPetsToJoin([]); 
      setVisiblePetsCount(60);
      setPartidaSeleccionada(juego); 
      setModalJoinAbierto(true); 
  };
  
  const verPartida = (juego) => {
      setPartidaSeleccionada(juego);
      setVistaActual('arena');
      animacionIniciada.current = false;
      setCuentaRegresiva(null);
      
      if (juego.estado === 'completed' && juego.resultado) {
          const caraFinal = juego.resultado.cara_moneda || (juego.resultado.lado === 'creador_gana' ? juego.lado : (juego.lado === 'Heads' ? 'Tails' : 'Heads'));
          setGirando(false);
          setGanador(caraFinal);
          setMostrarImpacto(true);
          setIsSpectatingCompleted(true); // Fix 3D Snap Bug para espectadores
          setRotacion(caraFinal === 'Heads' ? 0 : 180);
      } else {
          setGirando(false);
          setGanador(null);
          setMostrarImpacto(false);
          setIsSpectatingCompleted(false);
          setRotacion(0);
      }
  };

  const totalSeleccionadoToJoin = useMemo(() => selectedPetsToJoin.reduce((sum, p) => sum + (typeof p.valor === 'number' ? p.valor : 0), 0), [selectedPetsToJoin]);
  const dataJoinValidacion = useMemo(() => {
    if (!partidaSeleccionada) return { valida: false, diferenciaPrc: 0 };
    const vH = partidaSeleccionada.valorTotalHost;
    const minP = vH * 0.98; const maxP = vH * 1.02; 
    const valida = totalSeleccionadoToJoin >= minP && totalSeleccionadoToJoin <= maxP;
    return { valida, diferenciaPrc: totalSeleccionadoToJoin > 0 ? (((totalSeleccionadoToJoin - vH) / vH) * 100).toFixed(2) : 0, minVal: minP, maxVal: maxP };
  }, [totalSeleccionadoToJoin, partidaSeleccionada]);

  const toggleSelectPetJoin = (pet) => {
      if(selectedPetsToJoin.some(p => p.inventarioId === pet.inventarioId)) setSelectedPetsToJoin(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
      else setSelectedPetsToJoin(prev => [...prev, pet]);
  };

  const handleAutoSelectJoin = () => {
    if (!partidaSeleccionada) return;
    const maxVal = partidaSeleccionada.valorTotalHost * 1.02;
    const minVal = partidaSeleccionada.valorTotalHost * 0.98;
    let currentSum = 0; let selected = [];
    for (let pet of misPets) {
        if (currentSum + pet.valor <= maxVal) { currentSum += pet.valor; selected.push(pet); }
        if (currentSum >= minVal && currentSum <= maxVal) break;
    }
    setSelectedPetsToJoin(selected);
  };

  const confirmarUnionYJugar = async () => {
    if (!dataJoinValidacion.valida) return alert("Pets are not within the allowed value range.");
    if (isJoining) return; 
    setIsJoining(true);

    try {
      const nuevosDatosPartida = { ...partidaSeleccionada.datos_partida_raw, challenger_name: currentUser.username, avatar_challenger: currentUser.avatar_url };
      const resultadoMoneda = Math.random() < 0.5 ? 'Heads' : 'Tails';
      const ganaCreador = resultadoMoneda === partidaSeleccionada.lado;
      
      const ganadorId = ganaCreador ? partidaSeleccionada.creador_id : currentUser.id;
      const ladoGanadorStatus = ganaCreador ? 'creador_gana' : 'retador_gana';
      const resultadoPartida = { ganador: ganadorId, lado: ladoGanadorStatus, cara_moneda: resultadoMoneda };

      const { error } = await supabase.from('partidas')
        .update({ retador_id: currentUser.id, apuesta_retador: selectedPetsToJoin, estado: 'completed', resultado: resultadoPartida, datos_partida: nuevosDatosPartida })
        .eq('id', partidaSeleccionada.id);

      if (error) throw error;

      // TRANSFERENCIA DE PROPIEDAD EXACTA (Previene clonación y respeta serials)
      const hostPetIds = partidaSeleccionada.petsHost.map(p => p.inventarioId || p.id).filter(Boolean);
      const challengerPetIds = selectedPetsToJoin.map(p => p.inventarioId);
      const allPetIdsInGame = [...hostPetIds, ...challengerPetIds];

      await supabase.from('inventory').update({ user_id: ganadorId, is_locked: false }).in('id', allPetIdsInGame);

      const idsA_Bloquear = selectedPetsToJoin.map(p => p.inventarioId);
      setMisPets(prev => prev.filter(p => !idsA_Bloquear.includes(p.inventarioId)));
      
      setModalJoinAbierto(false); 
      setVistaActual('arena'); 

      const uiData = formatGameToUI({
          ...partidaSeleccionada, retador_id: currentUser.id, apuesta_retador: selectedPetsToJoin, estado: 'completed', resultado: resultadoPartida, datos_partida: nuevosDatosPartida
      });
      
      setPartidaSeleccionada(uiData);
      setIsSpectatingCompleted(false);
      iniciarCinematicaMoneda(uiData);

    } catch (err) {
      console.error("Fatal Error Joining:", err);
      alert("Error: " + err.message);
    } finally {
      setIsJoining(false);
    }
  };

  // --- ANIMACIONES ÉPICAS ARENA ---
  const iniciarCinematicaMoneda = (datosPartida) => {
    if (animacionIniciada.current) return; 
    animacionIniciada.current = true;
    
    setGirando(false); setGanador(null); setMostrarImpacto(false); setIsSpectatingCompleted(false); setCuentaRegresiva(3);
    
    let contador = 3;
    playAudio('/sounds/click.mp3', 0.5);
    
    const intervalo = setInterval(() => {
        contador -= 1;
        if (contador > 0) {
            setCuentaRegresiva(contador);
            playAudio('/sounds/click.mp3', 0.5);
        } else {
            clearInterval(intervalo);
            setCuentaRegresiva(null);
            
            const caraFinal = datosPartida.resultado?.cara_moneda || (datosPartida.resultado?.lado === 'creador_gana' ? datosPartida.lado : (datosPartida.lado === 'Heads' ? 'Tails' : 'Heads'));

            setGirando(true);
            playAudio('/sounds/spin.mp3', 0.7);
            
            setTimeout(() => {
              setRotacion(prevRotacion => {
                const ganaHeadsVisual = caraFinal === 'Heads';
                const vueltasBase = prevRotacion + 3600; 
                const nuevaRot = ganaHeadsVisual ? vueltasBase + (360 - (vueltasBase % 360)) : vueltasBase + (180 - (vueltasBase % 360)) + 360;
                
                setTimeout(() => { 
                    setGirando(false); setGanador(caraFinal); playAudio('/sounds/win.mp3', 0.8);
                    
                    const flash = document.createElement('div');
                    flash.className = "fixed inset-0 bg-white z-[999] pointer-events-none transition-opacity duration-300 opacity-0";
                    document.body.appendChild(flash);
                    setTimeout(() => flash.style.opacity = "0.8", 10);
                    setTimeout(() => { flash.style.opacity = "0"; setTimeout(() => flash.remove(), 300); }, 150);

                    setTimeout(() => setMostrarImpacto(true), 50);
                }, 4000);

                return nuevaRot;
              });
            }, 100);
        }
    }, 1000);
  };

  // --- COMPONENTES VISUALES ---
  const AvatarVS = ({ img, side, isWaiting = false, isWinner = false, isLoser = false }) => (
    <div className={`relative box-border h-16 w-16 md:h-24 md:w-24 rounded-full border-2 md:border-[4px] border-solid bg-[#1C1F2E] transition-all duration-500 shrink-0 
        ${isWaiting ? 'border-[#2F3347] border-dashed opacity-60' : 
          isWinner ? (side === 'Heads' ? 'border-[#facc15] shadow-[0_0_50px_rgba(250,204,21,1)] z-20' : 'border-[#a855f7] shadow-[0_0_50px_rgba(168,85,247,1)] z-20') : 
          isLoser ? 'border-[#252839]' :
          (side === 'Heads' ? 'border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.3)]')}`}>
      <div className="block h-full w-full overflow-hidden rounded-full bg-[#141323] flex items-center justify-center text-xl">
        {isWaiting ? '?' : <img src={img} className="block w-full h-full object-cover" alt="avatar"/>}
      </div>
      {!isWaiting && (
        <div className={`absolute right-0 top-0 h-6 w-6 md:h-10 md:w-10 overflow-hidden rounded-full translate-x-1/4 -translate-y-1/4 shadow-md bg-[#0b0e14] border-2 md:border-4 ${side === 'Heads' ? 'border-[#facc15]' : 'border-[#a855f7]'}`}>
          <img className="block w-full h-full object-contain p-1" src={side === 'Heads' ? imgMonedaHeads : imgMonedaTails} alt={side} />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white font-sans p-4 md:p-8 relative overflow-hidden">
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#6C63FF] opacity-10 blur-[150px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#ef4444] opacity-5 blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* LOBBY VIEW */}
        {vistaActual === 'lobby' && (
          <div className="w-full animate-fade-in">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
              <div className="flex items-center gap-4 rounded-2xl p-6 border border-[#252839] bg-[#14151f] shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#6C63FF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-white text-3xl font-black">{lobbyGames.filter(g => g.estado === 'waiting').length}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mt-1">Active Rooms</span>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl p-6 border border-[#252839] bg-[#14151f] shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#ef4444]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-white text-3xl font-black flex items-center gap-2"><RedCoin cls="w-7 h-7"/> {formatValue(lobbyGames.filter(g => g.estado === 'waiting').reduce((acc, g) => acc + g.valorTotalHost, 0))}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mt-1">Total Value</span>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl p-6 border border-[#252839] bg-[#14151f] shadow-lg relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-r from-[#22c55e]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex flex-col relative z-10">
                  <span className="text-white text-3xl font-black">{lobbyGames.length}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mt-1">Total Games</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-[#14151f] p-4 rounded-2xl border border-[#252839]">
               <h2 className="text-xl font-black uppercase tracking-widest text-white ml-2">Live Coinflip</h2>
               <button onClick={() => {setVistaActual('crear'); setVisiblePetsCount(60);}} className="w-full md:w-auto cursor-pointer py-3 px-8 text-sm font-black rounded-xl border border-[#5E55D9]/50 bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:shadow-[0_0_30px_rgba(108,99,255,0.6)] transition-all uppercase tracking-widest hover:scale-105 active:scale-95">
                 CREATE GAME
               </button>
            </div>

            <div className="flex flex-col gap-3">
              {lobbyGames.length === 0 && (
                  <div className="text-center text-[#555b82] py-20 font-black uppercase tracking-widest text-sm bg-[#14151f] rounded-2xl border border-[#252839] border-dashed">No games available. Be the first to create one!</div>
              )}
              {lobbyGames.map((game, idx) => (
                <div key={game.id} className={`relative grid grid-cols-1 xl:grid-cols-[auto_1fr_auto_auto] items-center gap-4 md:gap-6 rounded-2xl border py-4 px-6 transition-all animate-fade-in ${game.estado === 'completed' ? 'border-[#252839] bg-[#0b0e14] opacity-70 grayscale-[30%]' : (currentUser && game.creador_id === currentUser.id && game.estado === 'waiting' ? 'border-[#ef4444]/50 bg-[#14151f]' : 'border-[#252839] bg-[#14151f] hover:border-[#3f4354] shadow-lg hover:shadow-xl')}`} style={{animationDelay: `${idx * 0.05}s`}}>
                  
                  {game.estado === 'completed' && <div className="absolute top-0 left-0 bg-[#252839] text-[#8f9ac6] text-[9px] font-black uppercase px-3 py-1 rounded-tl-2xl rounded-br-lg tracking-widest z-10">Finished</div>}
                  {game.estado === 'in_progress' && <div className="absolute top-0 left-0 bg-[#6C63FF] text-white text-[9px] font-black uppercase px-3 py-1 rounded-tl-2xl rounded-br-lg tracking-widest shadow-[0_0_10px_rgba(108,99,255,0.5)] z-10 animate-pulse">Rolling...</div>}
                  {game.estado === 'waiting' && currentUser && game.creador_id === currentUser.id && <div className="absolute top-0 left-0 bg-[#ef4444] text-white text-[9px] font-black uppercase px-3 py-1 rounded-tl-2xl rounded-br-lg tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.5)] z-10">Your Game</div>}

                  <div className="flex items-center gap-4 justify-center xl:justify-start mt-2 xl:mt-0">
                    <AvatarVS img={game.avatar} side={game.lado} />
                    <strong className="text-xl font-black text-[#555b82] italic px-2">VS</strong>
                    {game.estado === 'waiting' ? (
                        <AvatarVS isWaiting={true} />
                    ) : (
                        <AvatarVS img={game.avatarChallenger} side={game.lado === 'Heads' ? 'Tails' : 'Heads'} />
                    )}
                  </div>

                  <div className="flex justify-center xl:justify-start py-2">
                    <div className="flex items-center ml-2">
                      {game.petsHost?.map((pet, i) => {
                        if (i >= 5) return null;
                        return (
                        <div key={i} className="relative box-border block h-12 w-12 md:h-14 md:w-14 rounded-lg border border-[#252839] bg-[#0b0e14] overflow-hidden -ml-3 shadow-[0_0_10px_rgba(0,0,0,0.5)] group hover:-translate-y-2 hover:z-50 transition-transform" style={{zIndex: 10 - i}}>
                          <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                          <img src={pet.image_url || pet.url || pet.imagen} className="block w-full h-full object-contain scale-110 drop-shadow-md relative z-10" alt="pet"/>
                        </div>
                      )})}
                      {game.petsHost?.length > 5 && (
                        <div className="relative box-border flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-lg border border-[#252839] bg-[#0b0e14] overflow-hidden -ml-3 z-[5]">
                          <img src={game.petsHost[5].image_url || game.petsHost[5].imagen || game.petsHost[5].url} className="block w-full h-full object-contain blur-[3px] opacity-30" alt="pet"/>
                          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xs drop-shadow-md bg-black/50 backdrop-blur-[1px]">+{game.petsHost.length - 5}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center w-full xl:w-40 justify-self-center bg-[#0b0e14] py-2 rounded-xl border border-[#252839]">
                    <p className={`inline-flex items-center gap-2 text-xl font-black drop-shadow-md ${game.estado === 'completed' ? 'text-[#8f9ac6]' : 'text-white'}`}>
                      <RedCoin cls="w-5 h-5"/> <span>{formatValue(game.valorTotalHost * (game.estado === 'completed' ? 2 : 1))}</span>
                    </p>
                    {game.estado === 'waiting' && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#555b82] mt-1">
                        Range: {formatValue(game.valorTotalHost * 0.98)} - {formatValue(game.valorTotalHost * 1.02)}
                        </p>
                    )}
                  </div>

                  <div className="flex justify-center xl:justify-end gap-3 w-full mt-2 xl:mt-0">
                    {game.estado === 'waiting' && currentUser && game.creador_id === currentUser.id && (
                        <button onClick={() => cancelarPartida(game.id)} disabled={isCanceling} className="w-full xl:w-28 cursor-pointer py-3 text-xs font-black rounded-xl border border-red-500/50 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50">
                          {isCanceling ? '...' : 'CANCEL'}
                        </button>
                    )}

                    {game.estado === 'waiting' && currentUser && game.creador_id !== currentUser.id && (
                        <button onClick={() => abrirModalJoin(game)} className="w-full xl:w-28 cursor-pointer py-3 text-xs font-black rounded-xl border border-[#22c55e]/50 bg-[#22c55e]/10 text-[#4ade80] hover:bg-[#22c55e] hover:text-[#0b0e14] shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all uppercase tracking-widest hover:scale-105 active:scale-95">
                          JOIN
                        </button>
                    )}
                    
                    {game.estado !== 'waiting' && (
                        <button onClick={() => verPartida(game)} className="w-full xl:w-28 cursor-pointer py-3 text-xs font-black rounded-xl border border-[#252839] bg-[#0b0e14] text-[#8f9ac6] hover:bg-[#252839] hover:text-white transition-all uppercase tracking-widest hover:scale-105 active:scale-95">
                          VIEW
                        </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CREATE VIEW */}
        {vistaActual === 'crear' && (
           <div className="w-full animate-fade-in">
             <button onClick={() => {setVistaActual('lobby'); setCreatorSelectedPets([]);}} className="text-[#8f9ac6] hover:text-white font-black text-xs tracking-widest uppercase flex items-center gap-2 transition-colors mb-6 bg-[#14151f] px-6 py-3 rounded-xl border border-[#252839] hover:border-[#4a506b]">
               ← Return to Lobby
             </button>
             
             <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-2/3 flex flex-col gap-4">
                    <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-6 shadow-xl h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white text-lg font-black uppercase tracking-widest">Your Inventory</h3>
                            <button onClick={handleAutoSelectCreate} className="text-[10px] font-black uppercase tracking-widest bg-[#0b0e14] hover:bg-[#252839] text-[#8f9ac6] hover:text-white px-4 py-2 rounded-lg border border-[#252839] transition-colors">
                                Auto Select Top 3
                            </button>
                        </div>
                        <input type="text" placeholder="Search items..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-[#6C63FF] mb-6 transition-colors" />
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 flex-1 content-start" onScroll={handleScrollInventario}>
                            {creatorFilteredPets.slice(0, visiblePetsCount).map(pet => {
                                const isSelected = creatorSelectedPets.some(p => p.inventarioId === pet.inventarioId);
                                return (
                                    <div key={pet.inventarioId} onClick={() => toggleCreatorPet(pet)} className={`relative bg-[#0b0e14] border-2 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-1 ${isSelected ? 'border-[#6C63FF] shadow-[0_0_20px_rgba(108,99,255,0.3)] bg-gradient-to-b from-[#6C63FF]/10 to-transparent' : 'border-[#252839] hover:border-[#4a506b]'}`}>
                                        {isSelected && <div className="absolute top-2 right-2 w-3 h-3 bg-[#6C63FF] rounded-full shadow-[0_0_10px_#6C63FF]"></div>}
                                        <img src={pet.image_url} className="w-14 h-14 object-contain mb-3 drop-shadow-lg" alt="pet"/>
                                        <div className="text-[9px] text-center w-full truncate font-black uppercase" style={{color: pet.color || '#8f9ac6'}}>{pet.nombre}</div>
                                        <div className="text-[10px] font-black text-white flex items-center justify-center gap-1 mt-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</div>
                                    </div>
                                )
                            })}
                            {creatorFilteredPets.length === 0 && (
                                <div className="col-span-full text-center text-[#555b82] py-10 font-bold text-sm">No pets found in your inventory.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-6 shadow-xl sticky top-4">
                        <h3 className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2">Total Bet Value</h3>
                        <div className="text-4xl font-black text-white flex items-center gap-3 py-6 bg-[#0b0e14] rounded-xl border border-[#252839] mb-8 justify-center shadow-inner">
                            <RedCoin cls="w-8 h-8"/> {formatValue(totalCreatorValue)}
                        </div>

                        <h3 className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-3">Choose Your Side</h3>
                        <div className="flex gap-4 mb-8">
                            <button onClick={() => setCreatorSide('Heads')} className={`flex-1 flex flex-col items-center justify-center py-6 rounded-xl border-2 transition-all group ${creatorSide === 'Heads' ? 'border-[#facc15] bg-gradient-to-b from-[#facc15]/20 to-transparent shadow-[0_0_20px_rgba(250,204,21,0.2)] scale-105' : 'border-[#252839] bg-[#0b0e14] hover:border-[#facc15]/50'}`}>
                                <img src={imgMonedaHeads} className="w-16 h-16 object-contain mb-3 drop-shadow-xl group-hover:scale-110 transition-transform" alt="Heads" />
                                <span className={`font-black tracking-widest uppercase text-xs ${creatorSide === 'Heads' ? 'text-[#facc15]' : 'text-[#8f9ac6]'}`}>Heads</span>
                            </button>
                            <button onClick={() => setCreatorSide('Tails')} className={`flex-1 flex flex-col items-center justify-center py-6 rounded-xl border-2 transition-all group ${creatorSide === 'Tails' ? 'border-[#a855f7] bg-gradient-to-b from-[#a855f7]/20 to-transparent shadow-[0_0_20px_rgba(168,85,247,0.2)] scale-105' : 'border-[#252839] bg-[#0b0e14] hover:border-[#a855f7]/50'}`}>
                                <img src={imgMonedaTails} className="w-16 h-16 object-contain mb-3 drop-shadow-xl group-hover:scale-110 transition-transform" alt="Tails" />
                                <span className={`font-black tracking-widest uppercase text-xs ${creatorSide === 'Tails' ? 'text-[#a855f7]' : 'text-[#8f9ac6]'}`}>Tails</span>
                            </button>
                        </div>

                        <button 
                          onClick={handleCreateGame} 
                          disabled={isCreating || creatorSelectedPets.length === 0 || !creatorSide}
                          className="w-full py-4 rounded-xl font-black text-white uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:shadow-[0_0_30px_rgba(108,99,255,0.6)] hover:scale-[1.02] bg-gradient-to-r from-[#6C63FF] to-[#5147D9] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                            {isCreating ? 'CREATING...' : 'CREATE MATCH'}
                        </button>
                    </div>
                </div>
             </div>
           </div>
        )}

        {/* WAITING VIEW (Cuando creas y esperas) */}
        {vistaActual === 'esperando' && partidaSeleccionada && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
                <div className="bg-[#14151f] border-2 border-[#252839] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-10 max-w-sm w-full flex flex-col items-center text-center">
                    <div className="relative w-32 h-32 mb-8">
                        <div className="absolute inset-0 rounded-full border-4 border-[#252839] border-t-[#6C63FF] animate-spin shadow-[0_0_20px_#6C63FF]"></div>
                        <img src={partidaSeleccionada.avatar} className="w-full h-full rounded-full object-cover p-2" alt="Tú" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#0b0e14] shadow-lg overflow-hidden border-2 border-[#252839]">
                            <img src={partidaSeleccionada.lado === 'Heads' ? imgMonedaHeads : imgMonedaTails} className="w-full h-full object-contain p-1" alt="Side" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-md">Waiting</h2>
                    <p className="text-[#8f9ac6] mb-10 font-bold text-sm">Waiting for a challenger to match your bet of <span className="text-white flex items-center justify-center gap-1 mt-2"><RedCoin/> {formatValue(partidaSeleccionada.valorTotalHost)}</span></p>
                    
                    <button onClick={() => setVistaActual('lobby')} className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-[#252839] hover:bg-[#3f4354] text-white mb-3">
                        Minimize to Lobby
                    </button>
                    
                    <button onClick={() => cancelarPartida(partidaSeleccionada.id)} disabled={isCanceling} className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] disabled:opacity-50">
                        {isCanceling ? 'CANCeling...' : 'Cancel Match'}
                    </button>
                </div>
            </div>
        )}

        {/* ARENA VIEW (El combate épico) */}
        {vistaActual === 'arena' && partidaSeleccionada && (() => {
            // Lógica para determinar quién se desliza a dónde
            const hostGana = mostrarImpacto && ganador === partidaSeleccionada.lado;
            const challengerGana = mostrarImpacto && ganador !== partidaSeleccionada.lado && ganador !== null;

            return (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <button onClick={() => {setVistaActual('lobby'); animacionIniciada.current = false;}} className="self-start text-[#8f9ac6] hover:text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors mb-8 bg-[#14151f] px-6 py-3 rounded-xl border border-[#252839] hover:border-[#4a506b] z-50">
              ← Exit Arena
            </button>
            
            {/* CONTENEDOR PRINCIPAL ARENA (Avatars, Textos y Mascotas) */}
            <div className="flex items-start justify-between w-full max-w-5xl bg-[#14151f] p-8 md:p-12 rounded-[3rem] border border-[#252839] shadow-2xl mb-16 relative overflow-hidden h-[320px]">
                <div className="absolute inset-0 bg-gradient-to-r from-[#facc15]/5 via-transparent to-[#a855f7]/5 pointer-events-none"></div>
                
                {/* HOST (Izquierda) */}
                <div className={`flex flex-col items-center gap-2 relative z-20 w-1/3 transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${hostGana ? 'translate-x-[100%] scale-125 pt-4' : challengerGana ? '-translate-x-[50%] opacity-0 scale-75' : 'translate-x-0'}`}>
                    <AvatarVS 
                        img={partidaSeleccionada.avatar} 
                        side={partidaSeleccionada.lado} 
                        isWinner={hostGana}
                        isLoser={challengerGana}
                    />
                    <span className={`font-black text-lg text-center truncate w-full transition-colors duration-500 mt-2 ${hostGana ? 'text-white drop-shadow-md' : 'text-white'}`}>{partidaSeleccionada.host}</span>
                    <span className="text-[#facc15] font-black text-[10px] uppercase tracking-widest bg-[#facc15]/10 px-3 py-1 rounded-full border border-[#facc15]/20">Host</span>
                    {/* EXHIBICIÓN DE PETS DEL HOST */}
                    <div className={`transition-opacity duration-500 ${mostrarImpacto ? 'opacity-0' : 'opacity-100'}`}>
                       <MiniPetGrid pets={partidaSeleccionada.petsHost} />
                    </div>
                </div>

                {/* VS AND TOTAL VALUE (Centro) */}
                <div className={`flex flex-col items-center justify-start pt-6 w-1/3 relative z-10 transition-opacity duration-500 ${mostrarImpacto ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="text-4xl md:text-5xl font-black text-[#252839] italic">VS</div>
                    <div className="mt-4 flex items-center gap-2 text-xl md:text-3xl font-black text-white bg-[#0b0e14] px-4 py-2 md:px-6 md:py-3 rounded-2xl border border-[#252839] shadow-inner">
                       <RedCoin cls="w-5 h-5 md:w-8 md:h-8"/> {formatValue(partidaSeleccionada.valorTotalHost * 2)}
                    </div>
                </div>

                {/* CHALLENGER (Derecha) */}
                <div className={`flex flex-col items-center gap-2 relative z-20 w-1/3 transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${challengerGana ? '-translate-x-[100%] scale-125 pt-4' : hostGana ? 'translate-x-[50%] opacity-0 scale-75' : 'translate-x-0'}`}>
                    {partidaSeleccionada.estado === 'in_progress' || partidaSeleccionada.estado === 'completed' ? (
                        <>
                           <AvatarVS 
                              img={partidaSeleccionada.avatarChallenger} 
                              side={partidaSeleccionada.lado === 'Heads' ? 'Tails' : 'Heads'} 
                              isWinner={challengerGana}
                              isLoser={hostGana}
                           />
                           <span className={`font-black text-lg text-center truncate w-full transition-colors duration-500 mt-2 ${challengerGana ? 'text-white drop-shadow-md' : 'text-white'}`}>{partidaSeleccionada.challenger}</span>
                           <span className="text-[#a855f7] font-black text-[10px] uppercase tracking-widest bg-[#a855f7]/10 px-3 py-1 rounded-full border border-[#a855f7]/20">Challenger</span>
                           {/* EXHIBICIÓN DE PETS DEL CHALLENGER */}
                           <div className={`transition-opacity duration-500 ${mostrarImpacto ? 'opacity-0' : 'opacity-100'}`}>
                              <MiniPetGrid pets={partidaSeleccionada.petsChallenger} />
                           </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center pt-4">
                           <AvatarVS isWaiting={true} />
                           <span className="text-[#8f9ac6] font-bold text-sm mt-4">Waiting...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* COINFLIP ANIMATION STAGE (Forzado CSS 3D Seguro) */}
            <div className="relative flex justify-center items-center h-48 md:h-64 mb-16 w-full -mt-20 z-30">
              {cuentaRegresiva !== null && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 animate-ping-slow">
                      <span className="text-[150px] font-black text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.8)] opacity-90">{cuentaRegresiva}</span>
                  </div>
              )}
              
              <div className={`absolute inset-0 bg-${ganador === 'Heads' ? '[#facc15]' : '[#a855f7]'} blur-[120px] rounded-full transition-all duration-700 ease-out z-0 pointer-events-none ${mostrarImpacto ? 'opacity-40 scale-[2.5]' : 'opacity-0 scale-50'}`}></div>
              
              <div className={`relative w-40 h-40 md:w-56 md:h-56 perspective-[1200px] z-10 ${cuentaRegresiva !== null ? 'opacity-10 blur-md scale-90' : 'opacity-100'}`}
                   style={{ transform: girando ? 'translateY(-100px) scale(1.4)' : (mostrarImpacto ? 'translateY(40px) scale(1)' : 'translateY(0px) scale(1)'), transition: girando ? 'transform 2.5s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'transform 0.8s cubic-bezier(0.5, 0, 0.2, 1)' }}
              >
                {/* LA MONEDA 3D - FIXED CSS */}
                <div className="w-full h-full relative preserve-3d drop-shadow-[0_30px_30px_rgba(0,0,0,0.8)]"
                  style={{ transition: isSpectatingCompleted ? 'none' : (girando ? 'transform 4s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'transform 0.5s ease-out'), transform: `rotateY(${rotacion}deg) ${girando ? 'rotateX(20deg)' : 'rotateX(0deg)'}` }}
                >
                  {/* LADO FRONTAL (HEADS) */}
                  <div className={`absolute inset-0 backface-hidden rounded-full border-[6px] md:border-[8px] bg-[#14151f] flex items-center justify-center transition-all duration-300 ${mostrarImpacto && ganador === 'Heads' ? 'border-[#facc15] shadow-[0_0_100px_rgba(250,204,21,1)]' : 'border-[#252839] shadow-inner'}`}
                       style={{ transform: 'rotateY(0deg)' }}>
                    <img src={imgMonedaHeads} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" alt="Heads" />
                  </div>

                  {/* LADO TRASERO (TAILS) */}
                  <div className={`absolute inset-0 backface-hidden rounded-full border-[6px] md:border-[8px] bg-[#14151f] flex items-center justify-center transition-all duration-300 ${mostrarImpacto && ganador === 'Tails' ? 'border-[#a855f7] shadow-[0_0_100px_rgba(168,85,247,1)]' : 'border-[#252839] shadow-inner'}`}
                       style={{ transform: 'rotateY(180deg)' }}>
                    <img src={imgMonedaTails} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" alt="Tails" />
                  </div>
                </div>
              </div>
            </div>

            <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-[0.2em] min-h-[60px] transition-all duration-500 z-40 ${mostrarImpacto ? (ganador === 'Heads' ? 'text-[#facc15] drop-shadow-[0_0_30px_#facc15] animate-bounce-in' : 'text-[#a855f7] drop-shadow-[0_0_30px_#a855f7] animate-bounce-in') : 'text-white'}`}>
              {cuentaRegresiva !== null ? 'PREPARING' : (ganador ? `${ganador} WINS!` : (girando ? 'FLIPPING' : (partidaSeleccionada.estado === 'waiting' ? 'WAITING' : 'READY')))}
            </h2>
          </div>
          );
        })()}

      </div>

      {/* JOIN MODAL */}
      {modalJoinAbierto && partidaSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#14151f] border border-[#252839] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-[#252839] bg-[#0b0e14]">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                ⚔️ JOIN MATCH <span className="text-[#555b82] text-xs">#{partidaSeleccionada.id.toString().substring(0,6)}</span>
              </h2>
              <button onClick={() => setModalJoinAbierto(false)} className="text-[#555b82] hover:text-white transition-colors text-2xl">&times;</button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-2/3 p-6 overflow-y-auto custom-scrollbar border-r border-[#252839] bg-[#14151f]" onScroll={handleScrollInventario}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[#8f9ac6] text-sm font-black uppercase tracking-widest">Your Inventory</h3>
                        <button onClick={handleAutoSelectJoin} className="text-[10px] bg-[#0b0e14] hover:bg-[#252839] text-[#8f9ac6] hover:text-white px-4 py-2 rounded-lg border border-[#252839] transition-colors font-black uppercase tracking-widest">
                            Auto Match Value
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {misPets.slice(0, visiblePetsCount).map(pet => {
                            const isSelected = selectedPetsToJoin.some(p => p.inventarioId === pet.inventarioId);
                            return (
                                <div key={pet.inventarioId} onClick={() => toggleSelectPetJoin(pet)} className={`relative bg-[#0b0e14] border-2 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all hover:-translate-y-1 ${isSelected ? 'border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-gradient-to-b from-[#22c55e]/10 to-transparent' : 'border-[#252839] hover:border-[#4a506b]'}`}>
                                    {isSelected && <div className="absolute top-2 right-2 w-3 h-3 bg-[#22c55e] rounded-full shadow-[0_0_10px_#22c55e]"></div>}
                                    <img src={pet.image_url} className="w-12 h-12 object-contain mb-2 drop-shadow-md" alt="pet"/>
                                    <div className="text-[9px] text-center w-full truncate text-[#8f9ac6] font-black uppercase">{pet.nombre}</div>
                                    <div className="text-[10px] font-black text-white flex items-center gap-1 mt-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</div>
                                </div>
                            )
                        })}
                        {misPets.length === 0 && (
                            <div className="col-span-full text-center text-[#555b82] py-10 font-bold text-sm">You don't have available pets.</div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-1/3 p-8 bg-[#0b0e14] flex flex-col justify-between">
                    <div>
                        <div className="text-center mb-8">
                            <img src={partidaSeleccionada.avatar} className="w-20 h-20 rounded-full border-4 border-[#252839] mx-auto mb-4 object-cover" alt="Host"/>
                            <p className="text-white font-black text-lg">{partidaSeleccionada.host}</p>
                            <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mt-1">is waiting with <span className="text-white">{partidaSeleccionada.lado}</span></p>
                        </div>
                        <h3 className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2">Target Value to Match</h3>
                        <div className="text-2xl font-black text-white flex items-center justify-center gap-2 py-4 bg-[#14151f] rounded-xl border border-[#252839] mb-8 shadow-inner">
                            <RedCoin cls="w-6 h-6"/> {formatValue(partidaSeleccionada.valorTotalHost)}
                        </div>
                        <h3 className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2">Your Selected Value</h3>
                        <div className={`text-3xl font-black flex items-center justify-center gap-2 py-5 rounded-xl border-2 transition-colors mb-2 ${dataJoinValidacion.valida ? 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.2)] scale-105' : 'text-white bg-[#14151f] border-[#252839]'}`}>
                            <RedCoin cls="w-8 h-8"/> {formatValue(totalSeleccionadoToJoin)}
                        </div>
                        <div className={`text-center text-xs font-black uppercase tracking-widest mb-6 ${dataJoinValidacion.valida ? 'text-[#22c55e]' : 'text-red-500'}`}>
                            {dataJoinValidacion.diferenciaPrc > 0 ? '+' : ''}{dataJoinValidacion.diferenciaPrc}% Difference
                        </div>
                    </div>
                    <button 
                        onClick={confirmarUnionYJugar} 
                        disabled={!dataJoinValidacion.valida || isJoining}
                        className={`w-full py-4 rounded-xl font-black text-white uppercase tracking-widest transition-all ${dataJoinValidacion.valida && !isJoining ? 'bg-[#22c55e] hover:bg-[#16a34a] text-black shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105' : 'bg-[#14151f] text-[#555b82] border border-[#252839] cursor-not-allowed'}`}
                    >
                        {isJoining ? 'JOINING...' : 'CONFIRM & PLAY'}
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* CLASES MÁGICAS PARA 3D COMPATIBLE Y ANIMACIONES */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a506b; }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        
        /* 3D SAFE FIXES */
        .perspective-[1200px] { perspective: 1200px; -webkit-perspective: 1200px; }
        .preserve-3d { transform-style: preserve-3d; -webkit-transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-ping-slow { animation: pingSlow 1s cubic-bezier(0, 0, 0.2, 1) forwards; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pingSlow {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}} />
    </div>
  );
}
