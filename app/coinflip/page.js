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

const formatGameToUI = (dbGame) => {
    return {
        id: dbGame.id,
        creador_id: dbGame.creador_id,
        retador_id: dbGame.retador_id,
        host: dbGame.datos_partida?.host_name || 'Player',
        avatar: dbGame.datos_partida?.avatar_creador || '/default-avatar.png',
        lado: dbGame.datos_partida?.lado_creador || 'Heads',
        petsHost: dbGame.apuesta_creador || [],
        valorTotalHost: dbGame.datos_partida?.valor_total || 0,
        estado: dbGame.estado,
        challenger: dbGame.datos_partida?.challenger_name || 'Challenger',
        avatarChallenger: dbGame.datos_partida?.avatar_challenger || '/default-avatar.png',
        petsChallenger: dbGame.apuesta_retador || [],
        resultado: dbGame.resultado || null,
        creado_en: dbGame.creado_en,
        datos_partida_raw: dbGame.datos_partida || {}
    };
};

export default function BloxypotCoinflip() {
  const [currentUser, setCurrentUser] = useState(null);
  const [misPets, setMisPets] = useState([]);
  const [vistaActual, setVistaActual] = useState('lobby'); 
  
  // Estados de Animación y Partida
  const [cuentaRegresiva, setCuentaRegresiva] = useState(null);
  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [ganador, setGanador] = useState(null);
  const [mostrarImpacto, setMostrarImpacto] = useState(false);
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
                .select(`
                    id,
                    is_locked,
                    items ( id, name, value, image_url, color )
                `)
                .eq('user_id', authData.user.id)
                .eq('is_locked', false);

            if (inventoryData && !error) {
                const mascotasReales = inventoryData.map(inv => ({
                    inventarioId: inv.id,
                    item_id: inv.items.id,
                    nombre: inv.items.name,
                    valor: inv.items.value,
                    image_url: inv.items.image_url, 
                    color: inv.items.color
                }));
                setMisPets(mascotasReales.sort((a, b) => b.valor - a.valor));
            } else {
                setMisPets([]); 
            }
        }
    };

    initUserAndInventory();

    // 2. CARGAR PARTIDAS
    const cargarPartidas = async () => {
      const { data, error } = await supabase
        .from('partidas')
        .select('*')
        .eq('modo_juego', 'coinflip')
        .in('estado', ['waiting', 'in_progress', 'completed'])
        .order('creado_en', { ascending: false })
        .limit(30); 
      
      if (!error && data) {
        setLobbyGames(data.map(formatGameToUI));
      }
    };

    cargarPartidas();

    // 3. REALTIME LOBBY (EL CREADOR DETECTA QUE ALGUIEN SE UNIÓ)
    const channel = supabase.channel('lobby_coinflip')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'partidas',
          filter: "modo_juego=eq.coinflip" 
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const formatted = formatGameToUI(payload.new);
            setLobbyGames(prev => [formatted, ...prev]);
            
          } else if (payload.eventType === 'UPDATE') {
            const formatted = formatGameToUI(payload.new);
            
            // Actualizar lista
            setLobbyGames(prev => {
                const index = prev.findIndex(g => g.id === formatted.id);
                if (index !== -1) {
                    const newArr = [...prev];
                    newArr[index] = formatted;
                    return newArr;
                }
                return [formatted, ...prev];
            });

            // MAGIA DEL CREADOR: Si la partida se completó y tú eres el creador, arranca tu animación
            setPartidaSeleccionada((prevPartida) => {
                if (prevPartida && prevPartida.id === formatted.id) {
                    // Verificamos si pasó de esperando a completado por el servidor
                    if (prevPartida.estado === 'waiting' && formatted.estado === 'completed' && formatted.resultado) {
                        
                        // Solo mandamos a la arena si el usuario es el creador de esta partida
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
               if(prev && prev.id === payload.old.id) {
                   setVistaActual('lobby');
                   return null;
               }
               return prev;
            });
          }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]); // Dependencia agregada para que Realtime lea bien quién somos

  // --- LÓGICA DE CREACIÓN ---
  const creatorFilteredPets = useMemo(() => {
    let items = [...misPets];
    if (creatorSearch) items = items.filter(i => i.nombre.toLowerCase().includes(creatorSearch.toLowerCase()));
    return items;
  }, [misPets, creatorSearch]);

  const totalCreatorValue = useMemo(() => creatorSelectedPets.reduce((sum, p) => sum + (typeof p.valor === 'number' ? p.valor : 0), 0), [creatorSelectedPets]);
  
  const toggleCreatorPet = (pet) => {
    if(creatorSelectedPets.some(p => p.inventarioId === pet.inventarioId)) {
        setCreatorSelectedPets(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
    } else {
        setCreatorSelectedPets(prev => [...prev, pet]);
    }
  };

  const handleAutoSelectCreate = () => {
    const sorted = [...misPets].sort((a, b) => b.valor - a.valor);
    setCreatorSelectedPets(sorted.slice(0, 3));
  };

  const handleCreateGame = async () => {
    if (!currentUser) return alert("Debes iniciar sesión.");
    if (creatorSelectedPets.length === 0) return alert("Debes seleccionar al menos una pet.");
    if (!creatorSide) return alert("Debes elegir Heads o Tails.");
    if (isCreating) return;

    setIsCreating(true);

    const valorTotal = creatorSelectedPets.reduce((sum, pet) => sum + pet.valor, 0);

    const datosPartidaIniciales = {
        lado_creador: creatorSide,
        valor_total: valorTotal,
        host_name: currentUser.username,
        avatar_creador: currentUser.avatar_url
    };

    const { data: nuevaPartida, error } = await supabase
        .from('partidas')
        .insert({
            modo_juego: 'coinflip',
            creador_id: currentUser.id,
            apuesta_creador: { items: creatorSelectedPets }, 
            datos_partida: datosPartidaIniciales,
            estado: 'waiting'
        })
        .select()
        .single();

    if (!error && nuevaPartida) {
        // Bloqueamos las mascotas temporalmente para UI
        const idsA_Bloquear = creatorSelectedPets.map(p => p.inventarioId);
        setMisPets(prev => prev.filter(p => !idsA_Bloquear.includes(p.inventarioId)));

        const uiData = formatGameToUI(nuevaPartida);
        setPartidaSeleccionada(uiData);
        setVistaActual('esperando'); 
        setCreatorSelectedPets([]); 
        setCreatorSide(null);
    } else {
        console.error("Error al crear partida:", error);
        alert("Hubo un error al crear la partida.");
    }
    
    setIsCreating(false);
  };

  const cancelarPartida = async () => {
      if (!partidaSeleccionada) return;
      await supabase.from('partidas').delete().eq('id', partidaSeleccionada.id);
      
      setMisPets(prev => {
          const recuperadas = partidaSeleccionada.petsHost?.items || [];
          const merged = [...prev, ...recuperadas];
          const uniqueIds = new Set();
          return merged.filter(pet => {
              const isDuplicate = uniqueIds.has(pet.inventarioId);
              uniqueIds.add(pet.inventarioId);
              return !isDuplicate;
          }).sort((a,b) => b.valor - a.valor);
      });

      setVistaActual('lobby');
      setPartidaSeleccionada(null);
  };

  // --- LÓGICA JOIN ---
  const abrirModalJoin = (juego) => { 
      setSelectedPetsToJoin([]); 
      setPartidaSeleccionada(juego); 
      setModalJoinAbierto(true); 
  };
  
  const verPartida = (juego) => {
      setPartidaSeleccionada(juego);
      setVistaActual('arena');
      animacionIniciada.current = false;
      setCuentaRegresiva(null);
      
      if (juego.estado === 'completed' && juego.resultado) {
          setGirando(false);
          setGanador(juego.resultado.lado === 'creador_gana' ? juego.lado : (juego.lado === 'Heads' ? 'Tails' : 'Heads'));
          setMostrarImpacto(true);
          setRotacion(ganador === 'Heads' ? 0 : 180);
      } else {
          setGirando(false);
          setGanador(null);
          setMostrarImpacto(false);
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
      if(selectedPetsToJoin.some(p => p.inventarioId === pet.inventarioId)) {
          setSelectedPetsToJoin(prev => prev.filter(p => p.inventarioId !== pet.inventarioId));
      } else {
          setSelectedPetsToJoin(prev => [...prev, pet]);
      }
  };

  const handleAutoSelectJoin = () => {
    if (!partidaSeleccionada) return;
    const targetValue = partidaSeleccionada.valorTotalHost;
    const minVal = targetValue * 0.98;
    const maxVal = targetValue * 1.02;
    
    let currentSum = 0;
    let selected = [];
    
    for (let pet of misPets) {
        if (currentSum + pet.valor <= maxVal) {
            currentSum += pet.valor;
            selected.push(pet);
        }
        if (currentSum >= minVal && currentSum <= maxVal) break;
    }
    setSelectedPetsToJoin(selected);
  };

const confirmarUnionYJugar = async () => {
    if (!dataJoinValidacion.valida) return alert("Las mascotas no están en el rango del 2% permitido.");
    if (isJoining) return; 
    setIsJoining(true);

    try {
      const nuevosDatosPartida = {
          ...partidaSeleccionada.datos_partida_raw,
          challenger_name: currentUser.username,
          avatar_challenger: currentUser.avatar_url
      };

      const apuestaParaServidor = {
        items: selectedPetsToJoin.map(p => p.inventarioId), 
        detalle_completo: selectedPetsToJoin 
      };

      // ==========================================
      // MAGIA 50/50 REAL (JUSTICIA ABSOLUTA)
      // ==========================================
      const resultadoMoneda = Math.random() < 0.5 ? 'Heads' : 'Tails'; // 50% de probabilidad real
      const ganaCreador = resultadoMoneda === partidaSeleccionada.lado; // Gana el host si cae lo que eligió
      
      const ganadorId = ganaCreador ? partidaSeleccionada.creador_id : currentUser.id;
      const ladoGanadorStatus = ganaCreador ? 'creador_gana' : 'retador_gana';

      const resultadoPartida = {
          ganador: ganadorId,
          lado: ladoGanadorStatus,
          cara_moneda: resultadoMoneda
      };

      // UN SOLO UPDATE A LA BASE DE DATOS (Sin usar el RPC amañado)
      const { error } = await supabase.from('partidas')
        .update({ 
            retador_id: currentUser.id,
            apuesta_retador: apuestaParaServidor,
            estado: 'completed',
            resultado: resultadoPartida,
            datos_partida: nuevosDatosPartida 
        })
        .eq('id', partidaSeleccionada.id);

      if (error) {
        console.error("Error uniendo:", error);
        alert("Esta partida ya no está disponible o hay un error de seguridad.");
        setIsJoining(false);
        return;
      }

      // ==========================================
      // LÓGICA DE PAGO (ENTREGAR LAS MASCOTAS AL GANADOR)
      // ==========================================
      const itemsAInsertar = [];
      const petsDelHost = partidaSeleccionada.petsHost?.items || []; 
      
      if (!ganaCreador) {
          // GANA EL RETADOR (TÚ): Recibes tus pets + las del host
          selectedPetsToJoin.forEach(p => itemsAInsertar.push({ user_id: currentUser.id, item_id: p.item_id }));
          petsDelHost.forEach(p => itemsAInsertar.push({ user_id: currentUser.id, item_id: p.item_id || p.id }));
      } else {
          // GANA EL CREADOR (HOST): Se lleva tus pets + las suyas
          selectedPetsToJoin.forEach(p => itemsAInsertar.push({ user_id: partidaSeleccionada.creador_id, item_id: p.item_id }));
          petsDelHost.forEach(p => itemsAInsertar.push({ user_id: partidaSeleccionada.creador_id, item_id: p.item_id || p.id }));
      }

      if (itemsAInsertar.length > 0) {
          await supabase.from('inventory').insert(itemsAInsertar);
      }
      // ==========================================

      // Bloquear mascotas visualmente de tu lado
      const idsA_Bloquear = selectedPetsToJoin.map(p => p.inventarioId);
      setMisPets(prev => prev.filter(p => !idsA_Bloquear.includes(p.inventarioId)));
      
      setModalJoinAbierto(false); 
      setVistaActual('arena'); 

      const uiData = formatGameToUI({
          ...partidaSeleccionada,
          retador_id: currentUser.id,
          apuesta_retador: apuestaParaServidor,
          estado: 'completed',
          resultado: resultadoPartida,
          datos_partida: nuevosDatosPartida
      });
      
      setPartidaSeleccionada(uiData);
      iniciarCinematicaMoneda(uiData);

    } catch (err) {
      console.error("Error fatal:", err);
    } finally {
      setIsJoining(false);
    }
  };

  // --- ANIMACIONES ARENA (MODIFICADA PARA LEER DEL SERVIDOR) ---
  const iniciarCinematicaMoneda = (datosPartida) => {
    if (animacionIniciada.current) return; 
    animacionIniciada.current = true;
    
    setGirando(false); 
    setGanador(null);
    setMostrarImpacto(false);
    
    setCuentaRegresiva(3);
    let contador = 3;
    
    const intervalo = setInterval(() => {
        contador -= 1;
        if (contador > 0) {
            setCuentaRegresiva(contador);
        } else {
            clearInterval(intervalo);
            setCuentaRegresiva(null);
            
            // EL SERVIDOR YA DECIDIÓ, APLICAMOS LA ANIMACIÓN DIRECTO
            const ladoServidor = datosPartida.resultado?.lado; // 'creador_gana' o 'retador_gana'
            
            // Traducimos al texto visual de 'Heads' o 'Tails' basado en lo que eligió el creador
            const ganaCreador = ladoServidor === 'creador_gana';
            let servidorLadoGanador = 'Heads';
            
            if (ganaCreador) {
                servidorLadoGanador = datosPartida.lado; // Si el host eligió Heads y ganó, la moneda será Heads
            } else {
                servidorLadoGanador = datosPartida.lado === 'Heads' ? 'Tails' : 'Heads'; 
            }

            setGirando(true);
            
            setTimeout(() => {
              setRotacion(prevRotacion => {
                const ganaHeadsVisual = servidorLadoGanador === 'Heads';
                const vueltasBase = prevRotacion + 3600; 
                const nuevaRot = ganaHeadsVisual ? vueltasBase + (360 - (vueltasBase % 360)) : vueltasBase + (180 - (vueltasBase % 360)) + 360;
                
                setTimeout(() => { 
                    setGirando(false); 
                    setGanador(servidorLadoGanador); 
                    setTimeout(() => setMostrarImpacto(true), 150);
                }, 4000);

                return nuevaRot;
              });
            }, 100);

        }
    }, 1000);
  };


  // --- COMPONENTES VISUALES ---
  const AvatarVS = ({ img, side, isWaiting = false }) => (
    <div className={`relative box-border h-12 w-12 md:h-14 md:w-14 rounded-full border-2 md:border-[3px] border-solid bg-[#1C1F2E] transition-colors shrink-0 ${isWaiting ? 'border-[#2F3347] border-dashed opacity-60' : side === 'Heads' ? 'border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.3)]'}`}>
      <div className="block h-full w-full overflow-hidden rounded-full bg-[#141323] flex items-center justify-center text-xl">
        {isWaiting ? '?' : <img src={img} className="block w-full h-full object-cover" alt="avatar"/>}
      </div>
      {!isWaiting && (
        <div className="absolute right-0 top-0 h-5 w-5 md:h-6 md:w-6 overflow-hidden rounded-full translate-x-1/4 -translate-y-1/4 shadow-md bg-[#0b0e14]">
          <img className="block w-full h-full object-contain p-0.5" src={side === 'Heads' ? imgMonedaHeads : imgMonedaTails} alt={side} />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white font-sans p-4 md:p-8 relative overflow-hidden">
      
      {/* Background FX Fijo */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#6C63FF] opacity-10 blur-[150px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#ef4444] opacity-5 blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* =========================================
            VISTA 1: LOBBY
        ========================================= */}
        {vistaActual === 'lobby' && (
          <div className="w-full animate-fade-in">
            {/* Header / Stats */}
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
               <button onClick={() => setVistaActual('crear')} className="w-full md:w-auto cursor-pointer py-3 px-8 text-sm font-black rounded-xl border border-[#5E55D9]/50 bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:shadow-[0_0_30px_rgba(108,99,255,0.6)] transition-all uppercase tracking-widest hover:scale-105 active:scale-95">
                 CREATE GAME
               </button>
            </div>

            <div className="flex flex-col gap-3">
              {lobbyGames.length === 0 && (
                  <div className="text-center text-[#555b82] py-20 font-black uppercase tracking-widest text-sm bg-[#14151f] rounded-2xl border border-[#252839] border-dashed">No games available. Be the first to create one!</div>
              )}
              {lobbyGames.map((game, idx) => (
                <div key={game.id} className={`relative grid grid-cols-1 xl:grid-cols-[auto_1fr_auto_auto] items-center gap-4 md:gap-6 rounded-2xl border py-4 px-6 transition-all animate-fade-in ${game.estado === 'completed' ? 'border-[#252839] bg-[#0b0e14] opacity-70 grayscale-[30%]' : 'border-[#252839] bg-[#14151f] hover:border-[#3f4354] shadow-lg hover:shadow-xl'}`} style={{animationDelay: `${idx * 0.05}s`}}>
                  
                  {game.estado === 'completed' && <div className="absolute top-0 left-0 bg-[#252839] text-[#8f9ac6] text-[9px] font-black uppercase px-3 py-1 rounded-tl-2xl rounded-br-lg tracking-widest">Finished</div>}
                  {game.estado === 'in_progress' && <div className="absolute top-0 left-0 bg-[#6C63FF] text-white text-[9px] font-black uppercase px-3 py-1 rounded-tl-2xl rounded-br-lg tracking-widest shadow-[0_0_10px_rgba(108,99,255,0.5)]">Rolling...</div>}

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
                      {game.petsHost?.items?.slice(0, 5).map((pet, i) => (
                        <div key={i} className="relative box-border block h-12 w-12 md:h-14 md:w-14 rounded-lg border border-[#252839] bg-[#0b0e14] overflow-hidden -ml-3 shadow-[0_0_10px_rgba(0,0,0,0.5)] group hover:-translate-y-2 hover:z-50 transition-transform" style={{zIndex: 10 - i}}>
                          <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                          <img src={pet.image_url} className="block w-full h-full object-contain scale-110 drop-shadow-md relative z-10" alt="pet"/>
                        </div>
                      ))}
                      {game.petsHost?.items?.length > 5 && (
                        <div className="relative box-border flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-lg border border-[#252839] bg-[#0b0e14] overflow-hidden -ml-3 z-[5]">
                          <img src={game.petsHost.items[5].image_url} className="block w-full h-full object-contain blur-[3px] opacity-30" alt="pet"/>
                          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xs drop-shadow-md bg-black/50 backdrop-blur-[1px]">+{game.petsHost.items.length - 5}</span>
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
                    {game.estado === 'waiting' && currentUser && game.creador_id !== currentUser.id && (
                        <button onClick={() => abrirModalJoin(game)} className="w-full xl:w-28 cursor-pointer py-3 text-xs font-black rounded-xl border border-[#22c55e]/50 bg-[#22c55e]/10 text-[#4ade80] hover:bg-[#22c55e] hover:text-[#0b0e14] shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all uppercase tracking-widest">
                          JOIN
                        </button>
                    )}
                    
                    <button onClick={() => verPartida(game)} className="w-full xl:w-28 cursor-pointer py-3 text-xs font-black rounded-xl border border-[#252839] bg-[#0b0e14] text-[#8f9ac6] hover:bg-[#252839] hover:text-white transition-all uppercase tracking-widest">
                      VIEW
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 2: CREATE GAME
        ========================================= */}
        {vistaActual === 'crear' && (
           <div className="w-full animate-fade-in">
             <button onClick={() => {setVistaActual('lobby'); setCreatorSelectedPets([]);}} className="text-[#8f9ac6] hover:text-white font-black text-xs tracking-widest uppercase flex items-center gap-2 transition-colors mb-6 bg-[#14151f] px-6 py-3 rounded-xl border border-[#252839] hover:border-[#4a506b]">
               ← Return to Lobby
             </button>
             
             <div className="flex flex-col md:flex-row gap-8">
                {/* Lado Izquierdo: Inventario */}
                <div className="w-full md:w-2/3 flex flex-col gap-4">
                    <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-6 shadow-xl h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white text-lg font-black uppercase tracking-widest">Your Inventory</h3>
                            <button onClick={handleAutoSelectCreate} className="text-[10px] font-black uppercase tracking-widest bg-[#0b0e14] hover:bg-[#252839] text-[#8f9ac6] hover:text-white px-4 py-2 rounded-lg border border-[#252839] transition-colors">
                                Auto Select Top 3
                            </button>
                        </div>
                        <input type="text" placeholder="Search items..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-[#6C63FF] mb-6 transition-colors" />
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 flex-1 content-start">
                            {creatorFilteredPets.map(pet => {
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

                {/* Lado Derecho: Controles */}
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
                            {isCreating ? 'Creating...' : 'CREATE MATCH'}
                        </button>
                    </div>
                </div>
             </div>
           </div>
        )}

        {/* =========================================
            VISTA DE ESPERA (MODAL CREATOR)
        ========================================= */}
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
                    <p className="text-[#8f9ac6] mb-10 font-bold text-sm">Waiting for a challenger to match your bet of <span className="text-white"><RedCoin/> {formatValue(partidaSeleccionada.valorTotalHost)}</span></p>
                    
                    <button 
                        onClick={cancelarPartida} 
                        className="w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-black text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    >
                        Cancel Match
                    </button>
                </div>
            </div>
        )}

        {/* =========================================
            VISTA 3: ARENA (LA MONEDA EN 3D)
        ========================================= */}
        {vistaActual === 'arena' && partidaSeleccionada && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-4">
            <button onClick={() => {setVistaActual('lobby'); animacionIniciada.current = false;}} className="self-start text-[#8f9ac6] hover:text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors mb-8 bg-[#14151f] px-6 py-3 rounded-xl border border-[#252839] hover:border-[#4a506b]">
              ← Exit Arena
            </button>
            
            {/* Cabecera de Versus */}
            <div className="flex items-center justify-between w-full max-w-3xl bg-[#14151f] p-8 rounded-[2rem] border border-[#252839] shadow-2xl mb-16 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#facc15]/5 via-transparent to-[#a855f7]/5"></div>
                
                <div className="flex flex-col items-center gap-3 relative z-10 w-1/3">
                    <AvatarVS img={partidaSeleccionada.avatar} side={partidaSeleccionada.lado} />
                    <span className="text-white font-black text-lg text-center truncate w-full">{partidaSeleccionada.host}</span>
                    <span className="text-[#facc15] font-black text-xs uppercase tracking-widest">Host</span>
                </div>
                
                <div className="flex flex-col items-center w-1/3 relative z-10">
                    <div className="text-4xl font-black text-[#252839] italic">VS</div>
                    <div className="mt-4 flex items-center gap-2 text-2xl font-black text-white bg-[#0b0e14] px-4 py-2 rounded-xl border border-[#252839]">
                       <RedCoin cls="w-6 h-6"/> {formatValue(partidaSeleccionada.valorTotalHost * 2)}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-3 relative z-10 w-1/3">
                    {partidaSeleccionada.estado === 'in_progress' || partidaSeleccionada.estado === 'completed' ? (
                        <>
                           <AvatarVS img={partidaSeleccionada.avatarChallenger} side={partidaSeleccionada.lado === 'Heads' ? 'Tails' : 'Heads'} />
                           <span className="text-white font-black text-lg text-center truncate w-full">{partidaSeleccionada.challenger}</span>
                           <span className="text-[#a855f7] font-black text-xs uppercase tracking-widest">Challenger</span>
                        </>
                    ) : (
                        <>
                           <AvatarVS isWaiting={true} />
                           <span className="text-[#8f9ac6] font-bold text-lg">Waiting...</span>
                        </>
                    )}
                </div>
            </div>

            {/* CONTENEDOR PRINCIPAL DE ANIMACIÓN Y FÍSICAS */}
            <div className="relative flex justify-center items-center h-64 mb-16 w-full">
              
              {cuentaRegresiva !== null && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 animate-pulse">
                      <span className="text-[150px] font-black text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.5)] opacity-90">
                          {cuentaRegresiva}
                      </span>
                  </div>
              )}

              <div className={`absolute inset-0 bg-${ganador === 'Heads' ? '[#facc15]' : '[#a855f7]'} blur-[100px] rounded-full transition-all duration-700 ease-out z-0 ${mostrarImpacto ? 'opacity-40 scale-[2]' : 'opacity-0 scale-50'}`}></div>

              <div className={`relative w-48 h-48 md:w-64 md:h-64 perspective-[1200px] z-10 ${cuentaRegresiva !== null ? 'opacity-20 blur-sm' : 'opacity-100'}`}
                   style={{
                     transform: girando ? 'translateY(-100px) scale(1.2)' : 'translateY(0px) scale(1)',
                     transition: girando ? 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)' : 'transform 0.8s cubic-bezier(0.5, 0, 0.2, 1)'
                   }}
              >
                <div className="w-full h-full relative preserve-3d"
                  style={{
                    transitionDuration: girando ? '4s' : '0s', 
                    transitionTimingFunction: 'cubic-bezier(0.1, 0.8, 0.1, 1)', 
                    transform: `rotateY(${rotacion}deg)`
                  }}
                >
                  {/* Cara Heads */}
                  <div className={`absolute w-full h-full backface-hidden rounded-full border-[6px] bg-[#14151f] flex items-center justify-center transition-colors duration-300 ${mostrarImpacto && ganador === 'Heads' ? 'border-[#facc15] shadow-[0_0_80px_rgba(250,204,21,1)]' : 'border-[#252839] shadow-2xl'}`}>
                    <img src={imgMonedaHeads} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" alt="Heads" />
                  </div>
                  
                  {/* Cara Tails */}
                  <div className={`absolute w-full h-full backface-hidden rounded-full border-[6px] bg-[#14151f] flex items-center justify-center transition-colors duration-300 ${mostrarImpacto && ganador === 'Tails' ? 'border-[#a855f7] shadow-[0_0_80px_rgba(168,85,247,1)]' : 'border-[#252839] shadow-2xl'}`}
                       style={{ transform: 'rotateY(180deg)' }}>
                    <img src={imgMonedaTails} className="w-[85%] h-[85%] object-contain drop-shadow-2xl" alt="Tails" />
                  </div>
                </div>
              </div>
            </div>

            <h2 className={`text-4xl font-black uppercase tracking-[0.3em] min-h-[50px] transition-all duration-500 ${mostrarImpacto ? (ganador === 'Heads' ? 'text-[#facc15] drop-shadow-[0_0_20px_#facc15]' : 'text-[#a855f7] drop-shadow-[0_0_20px_#a855f7]') : 'text-white'}`}>
              {cuentaRegresiva !== null ? 'PREPARING' : (ganador ? `${ganador} WINS!` : (girando ? 'FLIPPING' : (partidaSeleccionada.estado === 'waiting' ? 'WAITING' : 'READY')))}
            </h2>
          </div>
        )}

      </div>

      {/* =========================================
          MODAL JOIN
      ========================================= */}
      {modalJoinAbierto && partidaSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#14151f] border border-[#252839] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-[#252839] bg-[#0b0e14]">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                ⚔️ JOIN MATCH <span className="text-[#555b82] text-xs">#{partidaSeleccionada.id.toString().substring(0,6)}</span>
              </h2>
              <button onClick={() => setModalJoinAbierto(false)} className="text-[#555b82] hover:text-white transition-colors text-2xl">
                &times;
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Inventario para Unirse */}
                <div className="w-full md:w-2/3 p-6 overflow-y-auto custom-scrollbar border-r border-[#252839] bg-[#14151f]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[#8f9ac6] text-sm font-black uppercase tracking-widest">Your Inventory</h3>
                        <button onClick={handleAutoSelectJoin} className="text-[10px] bg-[#0b0e14] hover:bg-[#252839] text-[#8f9ac6] hover:text-white px-4 py-2 rounded-lg border border-[#252839] transition-colors font-black uppercase tracking-widest">
                            Auto Match Value
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {misPets.map(pet => {
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

                {/* Panel lateral de confirmación */}
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
                        <div className={`text-3xl font-black flex items-center justify-center gap-2 py-5 rounded-xl border-2 transition-colors mb-2 ${dataJoinValidacion.valida ? 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.2)]' : 'text-white bg-[#14151f] border-[#252839]'}`}>
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

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4a506b; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .perspective-[1200px] { perspective: 1200px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
