"use client";
import { useState, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase'; 
import PETS_DATABASE_RAW from '../data/pets_bgsi.json';

// --- LIMPIEZA DE DATOS ---
const PETS_DATABASE = PETS_DATABASE_RAW
  .filter(pet => pet && pet.valor !== 0 && pet.valor !== "0" && pet.valor !== null)
  .map(pet => {
    let valorCorregido = pet.valor;
    if (typeof valorCorregido === 'number') {
      if (valorCorregido < 10) valorCorregido = Math.round(valorCorregido * 1000000); 
      else if (valorCorregido < 1000) valorCorregido = Math.round(valorCorregido * 1000); 
    }
    return { ...pet, valor: valorCorregido };
  });

const formatValue = (val) => {
  if (val === "O/C") return "O/C";
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R" onError={e=>e.target.style.display='none'}/>;

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
        datos_partida_raw: dbGame.datos_partida || {} // Necesario para no borrar datos al hacer UPDATE
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

  // Estados Join/Arena
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null); 
  const [selectedPetsToJoin, setSelectedPetsToJoin] = useState([]);
  const [modalJoinAbierto, setModalJoinAbierto] = useState(false);

  // Lobby Conectado a Supabase
  const [lobbyGames, setLobbyGames] = useState([]);

  useEffect(() => {
    // 0. Obtener Usuario Actual y su PERFIL REAL
    const initUser = async () => {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            // Ir a la tabla perfiles (Ajusta 'perfiles' si tu tabla se llama diferente, ej. 'profiles' o 'users')
            const { data: profile } = await supabase
                .from('perfiles')
                .select('username, avatar_url')
                .eq('id', authData.user.id)
                .single();

            setCurrentUser({ 
                id: authData.user.id, 
                username: profile?.username || 'Player',
                avatar_url: profile?.avatar_url || '/default-avatar.png'
            });
        } else {
            // Mock temporal si no estás logueado para que puedas probar
            let tempId = localStorage.getItem('temp_user_id');
            if (!tempId) { tempId = crypto.randomUUID(); localStorage.setItem('temp_user_id', tempId); }
            setCurrentUser({ id: tempId, username: 'Guest_' + tempId.substring(0,4), avatar_url: '/default-avatar.png' });
        }
    };
    initUser();

    // 1. Cargar inventario (Mantenemos generación por ahora)
    const iniciales = [];
    for(let i = 0; i < 25; i++) {
      const p = PETS_DATABASE[Math.floor(Math.random() * PETS_DATABASE.length)];
      if(p) iniciales.push({ ...p, inventarioId: Date.now() + i });
    }
    setMisPets(iniciales.sort((a, b) => b.valor - a.valor));

    // 2. Cargar partidas reales (Waiting, In_progress y Completed para el historial)
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

    // 3. Suscripción a Realtime
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
            
            // Actualizar en el lobby
            setLobbyGames(prev => {
                const index = prev.findIndex(g => g.id === formatted.id);
                if (index !== -1) {
                    const newArr = [...prev];
                    newArr[index] = formatted;
                    return newArr;
                }
                return [formatted, ...prev];
            });

            // Si ALGUIEN está viendo la partida O si tú eres el creador esperando
            setPartidaSeleccionada((prevPartida) => {
                if (prevPartida && prevPartida.id === formatted.id) {
                    // Si pasó a in_progress y tú estabas esperando (o viendo)
                    if (prevPartida.estado === 'waiting' && formatted.estado === 'in_progress') {
                        setVistaActual('arena'); // Quita la ventana negra de espera
                        iniciarCinematicaMoneda(formatted);
                    }
                    return formatted;
                }
                return prevPartida;
            });

          } else if (payload.eventType === 'DELETE') {
            setLobbyGames(prev => prev.filter(game => game.id !== payload.old.id));
            
            // Si te borraron la partida mientras esperabas (o la cancelaste tú)
            setPartidaSeleccionada((prev) => {
               if(prev && prev.id === payload.old.id) {
                   setVistaActual('lobby');
                   return null;
               }
               return prev;
            });
          }
      }).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- LÓGICA DEL CREADOR ---
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
    if (!currentUser) return alert("Cargando usuario...");
    if (creatorSelectedPets.length === 0 || !creatorSide) return alert("Select side and pets!");
    
    const newGameData = {
        modo_juego: 'coinflip',
        creador_id: currentUser.id,
        apuesta_creador: creatorSelectedPets,
        datos_partida: { 
            lado_creador: creatorSide,
            avatar_creador: currentUser.avatar_url,
            host_name: currentUser.username,
            valor_total: totalCreatorValue
        },
        estado: 'waiting'
    };

    const { data, error } = await supabase.from('partidas').insert([newGameData]).select().single();

    if (error) {
        console.error("Error al crear partida:", error);
        alert("Error connecting to database.");
    } else {
        // Lanzar la "ventanita negra" de espera y guardar la partida actual
        const uiData = formatGameToUI(data);
        setPartidaSeleccionada(uiData);
        setVistaActual('esperando'); 
        setCreatorSelectedPets([]); 
        setCreatorSide(null);
    }
  };

  const cancelarPartida = async () => {
      if (!partidaSeleccionada) return;
      // Borramos de la DB
      await supabase.from('partidas').delete().eq('id', partidaSeleccionada.id);
      setVistaActual('lobby');
      setPartidaSeleccionada(null);
  };

  // --- LÓGICA DE JOIN / ARENA ---
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
      
      // Si la partida ya estaba terminada, mostrar el resultado final directamente
      if (juego.estado === 'completed' && juego.resultado) {
          setGirando(false);
          setGanador(juego.resultado.lado_ganador);
          setMostrarImpacto(true);
          setRotacion(juego.resultado.lado_ganador === 'Heads' ? 0 : 180);
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
    if (!dataJoinValidacion.valida) return alert("Pets are outside the 2% range!");
    
    // Inyectamos nuestros datos de perfil reales en el JSONB
    const nuevosDatosPartida = {
        ...partidaSeleccionada.datos_partida_raw,
        challenger_name: currentUser.username,
        avatar_challenger: currentUser.avatar_url
    };

    const { data, error } = await supabase
      .from('partidas')
      .update({ 
        retador_id: currentUser.id,
        apuesta_retador: selectedPetsToJoin,
        estado: 'in_progress',
        datos_partida: nuevosDatosPartida
      })
      .eq('id', partidaSeleccionada.id)
      .select()
      .single();

    if (error) {
      console.error("Error uniendo:", error);
      return alert("Partida ya no está disponible.");
    }
    
    const uiData = formatGameToUI(data);
    setPartidaSeleccionada(uiData);
    setModalJoinAbierto(false); 
    setVistaActual('arena'); 

    // Iniciamos la animación localmente para el que se une
    iniciarCinematicaMoneda(uiData);
  };

  const iniciarCinematicaMoneda = (datosPartida) => {
    if (animacionIniciada.current) return; 
    animacionIniciada.current = true;
    
    setGirando(false); 
    setGanador(null);
    setMostrarImpacto(false);
    
    // 1. Iniciar Cuenta Regresiva de 3 Segundos
    setCuentaRegresiva(3);
    let contador = 3;
    
    const intervalo = setInterval(() => {
        contador -= 1;
        if (contador > 0) {
            setCuentaRegresiva(contador);
        } else {
            clearInterval(intervalo);
            setCuentaRegresiva(null);
            // 2. Al terminar el contador, hacer el tiro real
            ejecutarTiroRPC(datosPartida);
        }
    }, 1000);
  };

  const ejecutarTiroRPC = async (datosPartida) => {
    setGirando(true);

    const { data: resultado, error } = await supabase
      .rpc('resolver_partida_coinflip', { p_partida_id: datosPartida.id });

    // Fallback por si la RPC no existe aún
    let ganaHeads = true;
    let servidorLadoGanador = 'Heads';
    
    if (error) {
        console.warn("Usando Random simulado por error RPC.", error);
        ganaHeads = Math.random() < 0.5;
        servidorLadoGanador = ganaHeads ? 'Heads' : 'Tails';
        await supabase.from('partidas').update({ estado: 'completed', resultado: { lado_ganador: servidorLadoGanador } }).eq('id', datosPartida.id);
    } else {
        servidorLadoGanador = resultado.lado_ganador;
        ganaHeads = servidorLadoGanador === 'Heads';
    }

    setTimeout(() => {
      setRotacion(prevRotacion => {
        const vueltasBase = prevRotacion + 3600; 
        const nuevaRot = ganaHeads ? vueltasBase + (360 - (vueltasBase % 360)) : vueltasBase + (180 - (vueltasBase % 360)) + 360;
        
        setTimeout(() => { 
            setGirando(false); 
            setGanador(servidorLadoGanador); 
            setTimeout(() => setMostrarImpacto(true), 150);
        }, 4000);

        return nuevaRot;
      });
    }, 100);
  };

  // --- COMPONENTES VISUALES ---
  const AvatarVS = ({ img, side, isWaiting = false }) => (
    <div className={`relative box-border h-12 w-12 md:h-14 md:w-14 rounded-full border-2 md:border-[3px] border-solid bg-[#1C1F2E] transition-colors shrink-0 ${isWaiting ? 'border-[#2F3347] border-dashed opacity-60' : side === 'Heads' ? 'border-[#facc15]' : 'border-[#a855f7]'}`}>
      <div className="block h-full w-full overflow-hidden rounded-full bg-[#141323] flex items-center justify-center text-xl">
        {isWaiting ? '?' : <img src={img} className="block w-full h-full object-cover" alt="avatar"/>}
      </div>
      {!isWaiting && (
        <div className="absolute right-0 top-0 h-5 w-5 md:h-6 md:w-6 overflow-hidden rounded-full translate-x-1/4 -translate-y-1/4 shadow-md bg-[#0b0e14]">
          <img className="block w-full h-full object-contain" src={side === 'Heads' ? imgMonedaHeads : imgMonedaTails} alt={side} />
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1d202f] via-[#0b0e14] to-[#0b0e14] text-white font-sans p-4 md:p-8 relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* =========================================
            VISTA 1: LOBBY
        ========================================= */}
        {vistaActual === 'lobby' && (
          <div className="w-full animate-fade-in">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-6">
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(108, 99, 255, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black">{lobbyGames.filter(g => g.estado === 'waiting').length}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Active Rooms</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(239, 68, 68, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black flex items-center gap-2"><RedCoin cls="w-6 h-6"/> {formatValue(lobbyGames.filter(g => g.estado === 'waiting').reduce((acc, g) => acc + g.valorTotalHost, 0))}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Total Value</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(108, 99, 255, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black">History</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Live Updates</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setVistaActual('crear')} className="flex-1 md:flex-none cursor-pointer h-[38px] px-6 text-sm font-bold rounded-md border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_15px_rgba(108,99,255,0.3)] hover:opacity-90 transition-all uppercase tracking-wider hover:scale-105">
                  Create Game
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {lobbyGames.length === 0 && (
                  <div className="text-center text-[#8f9ac6] py-10">No games right now. Create one!</div>
              )}
              {lobbyGames.map((game, idx) => (
                <div key={game.id} className={`relative grid grid-cols-1 xl:grid-cols-[auto_1fr_auto_auto] items-center gap-4 md:gap-6 rounded-lg border py-3 px-4 md:pl-6 md:pr-4 transition-all animate-fade-in ${game.estado === 'completed' ? 'border-[#252839] bg-[#141323] opacity-80' : 'border-[#252839] bg-[#1c1f2e] hover:border-[#3f4354]'}`} style={{animationDelay: `${idx * 0.05}s`}}>
                  
                  {/* Etiqueta de Estado Visual */}
                  {game.estado === 'completed' && (
                     <div className="absolute top-0 left-0 bg-[#252839] text-[#8f9ac6] text-[9px] font-black uppercase px-2 py-0.5 rounded-tl-lg rounded-br-lg tracking-widest">Finished</div>
                  )}
                  {game.estado === 'in_progress' && (
                     <div className="absolute top-0 left-0 bg-[#6C63FF] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-tl-lg rounded-br-lg tracking-widest shadow-[0_0_10px_rgba(108,99,255,0.5)]">Rolling...</div>
                  )}

                  <div className="flex items-center gap-3 justify-center xl:justify-start mt-2 xl:mt-0">
                    {/* AVATAR REAL DEL CREADOR */}
                    <AvatarVS img={game.avatar} side={game.lado} />
                    <strong className="text-lg font-black text-[#555b82] italic">VS</strong>
                    
                    {/* AVATAR REAL DEL RETADOR (SI EXISTE) */}
                    {game.estado === 'waiting' ? (
                        <AvatarVS isWaiting={true} />
                    ) : (
                        <AvatarVS img={game.avatarChallenger} side={game.lado === 'Heads' ? 'Tails' : 'Heads'} />
                    )}
                  </div>

                  <div className="flex justify-center xl:justify-start py-2">
                    <div className="flex items-center ml-2">
                      {game.petsHost.slice(0, 5).map((pet, i) => (
                        <div key={i} className="relative box-border block h-12 w-12 md:h-14 md:w-14 rounded-md border-2 border-[#2F3347] bg-[#141323] overflow-hidden -ml-4 shadow-lg group" style={{zIndex: 10 - i}}>
                          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                          <img src={pet.img} className="block w-full h-full object-contain scale-110 drop-shadow-md" alt="pet"/>
                        </div>
                      ))}
                      {game.petsHost.length > 5 && (
                        <div className="relative box-border flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-md border-2 border-[#2F3347] bg-[#141323] overflow-hidden -ml-4 z-[5]">
                          <img src={game.petsHost[5].img} className="block w-full h-full object-contain blur-[2px] opacity-40" alt="pet"/>
                          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm drop-shadow-md bg-black/40">+{game.petsHost.length - 5}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center w-full xl:w-32 justify-self-center">
                    <p className={`inline-flex items-center gap-2 text-xl font-black drop-shadow-md ${game.estado === 'completed' ? 'text-[#8f9ac6]' : 'text-white'}`}>
                      <RedCoin cls="w-5 h-5 md:w-6 md:h-6"/> <span>{formatValue(game.valorTotalHost * (game.estado === 'completed' ? 2 : 1))}</span>
                    </p>
                    {game.estado === 'waiting' && (
                        <p className="text-xs font-bold text-[#8f9ac6] mt-0.5">
                        {formatValue(game.valorTotalHost * 0.98)} - {formatValue(game.valorTotalHost * 1.02)}
                        </p>
                    )}
                  </div>

                  <div className="flex justify-center xl:justify-end gap-2 w-full mt-2 xl:mt-0">
                    {/* Solo muestra JOIN si está en waiting Y el creador NO es el usuario actual */}
                    {game.estado === 'waiting' && currentUser && game.creador_id !== currentUser.id && (
                        <button onClick={() => abrirModalJoin(game)} className="w-full xl:w-24 cursor-pointer h-[34px] px-5 text-sm font-bold rounded-md border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_10px_rgba(108,99,255,0.25)] hover:shadow-[0_4px_15px_rgba(108,99,255,0.4)] transition-all uppercase tracking-widest hover:-translate-y-0.5">
                        JOIN
                        </button>
                    )}
                    
                    {/* El botón VIEW siempre está visible para todas las partidas */}
                    <button onClick={() => verPartida(game)} className="w-full xl:w-24 cursor-pointer h-[34px] px-5 text-sm font-bold rounded-md border border-[#2D314A] bg-[#2a2e44] text-[#E1E4F2] hover:bg-[#32364f] transition-all uppercase tracking-widest hover:-translate-y-0.5">
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
             <button onClick={() => {setVistaActual('lobby'); setCreatorSelectedPets([]);}} className="text-[#8f9ac6] hover:text-[#6C63FF] font-bold text-sm flex items-center gap-1 transition-colors mb-6 bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839]">
               &lsaquo; Back to Lobby
             </button>
             
             <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-2/3 flex flex-col gap-4">
                    <div className="bg-[#1c1f2e] border border-[#252839] rounded-xl p-6 shadow-lg h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest border-b border-[#252839] pb-2 flex-1">Choose your Pets</h3>
                            <button onClick={handleAutoSelectCreate} className="text-xs bg-[#2a2e44] hover:bg-[#32364f] text-[#E1E4F2] px-3 py-1 rounded border border-[#2D314A] transition-colors">
                                Auto Select
                            </button>
                        </div>
                        <input type="text" placeholder="Search pets..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="w-full bg-[#141323] border border-[#2F3347] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-[#6C63FF] mb-4" />
                        
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {creatorFilteredPets.map(pet => {
                                const isSelected = creatorSelectedPets.some(p => p.inventarioId === pet.inventarioId);
                                return (
                                    <div key={pet.inventarioId} onClick={() => toggleCreatorPet(pet)} className={`relative bg-[#141323] border-2 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition-all ${isSelected ? 'border-[#6C63FF] shadow-[0_0_15px_rgba(108,99,255,0.3)]' : 'border-[#2F3347] hover:border-[#4f567a]'}`}>
                                        <img src={pet.img} className="w-12 h-12 object-contain mb-2" alt="pet"/>
                                        <div className="text-[10px] text-center w-full truncate text-[#8f9ac6] font-bold">{pet.nombre}</div>
                                        <div className="text-xs font-black text-white flex items-center gap-1 mt-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <div className="bg-[#1c1f2e] border border-[#252839] rounded-xl p-6 shadow-lg">
                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4 border-b border-[#252839] pb-2">Selected Value</h3>
                        <div className="text-3xl font-black text-white flex items-center justify-center gap-2 py-4 bg-[#141323] rounded-lg border border-[#2F3347]">
                            <RedCoin cls="w-8 h-8"/> {formatValue(totalCreatorValue)}
                        </div>

                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mt-6 mb-4 border-b border-[#252839] pb-2">Choose Side</h3>
                        <div className="flex gap-4">
                            <button onClick={() => setCreatorSide('Heads')} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${creatorSide === 'Heads' ? 'border-[#facc15] bg-[#facc15]/10 shadow-[0_0_20px_rgba(250,204,21,0.2)]' : 'border-[#2F3347] bg-[#141323] hover:border-[#4f567a]'}`}>
                                <img src={imgMonedaHeads} className="w-16 h-16 object-contain mb-2" alt="Heads" />
                                <span className="font-black text-white">HEADS</span>
                            </button>
                            <button onClick={() => setCreatorSide('Tails')} className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${creatorSide === 'Tails' ? 'border-[#a855f7] bg-[#a855f7]/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]' : 'border-[#2F3347] bg-[#141323] hover:border-[#4f567a]'}`}>
                                <img src={imgMonedaTails} className="w-16 h-16 object-contain mb-2" alt="Tails" />
                                <span className="font-black text-white">TAILS</span>
                            </button>
                        </div>

                        <button onClick={handleCreateGame} className="w-full mt-6 h-12 rounded-lg font-black text-white uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(108,99,255,0.4)] hover:scale-[1.02] bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)]">
                            CREATE GAME
                        </button>
                    </div>
                </div>
             </div>
           </div>
        )}

        {/* =========================================
            VISTA DE ESPERA (LA VENTANITA NEGRA P/ EL CREADOR)
        ========================================= */}
        {vistaActual === 'esperando' && partidaSeleccionada && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4">
                <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-8 max-w-sm w-full flex flex-col items-center text-center">
                    
                    {/* Loader con el avatar real */}
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-[#252839] border-t-[#6C63FF] animate-spin"></div>
                        <img src={partidaSeleccionada.avatar} className="w-full h-full rounded-full object-cover p-1.5" alt="Tú" />
                    </div>

                    <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Waiting...</h2>
                    <p className="text-[#8f9ac6] mb-8 font-bold text-sm">Your game is live. Waiting for a challenger to join.</p>
                    
                    <button 
                        onClick={cancelarPartida} 
                        className="w-full h-12 rounded-lg font-black uppercase tracking-widest transition-all bg-red-500/10 border border-red-500/50 hover:bg-red-500/20 text-red-500 hover:text-red-400"
                    >
                        CANCEL GAME
                    </button>
                </div>
            </div>
        )}

        {/* =========================================
            VISTA 3: ARENA (LA MONEDA EN 3D)
        ========================================= */}
        {vistaActual === 'arena' && partidaSeleccionada && (
          <div className="w-full flex flex-col items-center animate-fade-in mt-10">
            <button onClick={() => {setVistaActual('lobby'); animacionIniciada.current = false;}} className="self-start text-[#8f9ac6] hover:text-[#6C63FF] font-bold text-sm flex items-center gap-1 transition-colors mb-6 bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839]">
              &lsaquo; Back to Lobby
            </button>
            
            <div className="flex items-center gap-10 bg-[#1c1f2e] p-6 rounded-2xl border border-[#252839] shadow-2xl mb-12">
                <div className="flex flex-col items-center gap-2">
                    <AvatarVS img={partidaSeleccionada.avatar} side={partidaSeleccionada.lado} />
                    <span className="text-white font-bold">{partidaSeleccionada.host}</span>
                </div>
                <div className="text-3xl font-black text-[#555b82] italic">VS</div>
                <div className="flex flex-col items-center gap-2">
                    {partidaSeleccionada.estado === 'in_progress' || partidaSeleccionada.estado === 'completed' ? (
                        <>
                           <AvatarVS img={partidaSeleccionada.avatarChallenger} side={partidaSeleccionada.lado === 'Heads' ? 'Tails' : 'Heads'} />
                           <span className="text-white font-bold">{partidaSeleccionada.challenger}</span>
                        </>
                    ) : (
                        <>
                           <AvatarVS isWaiting={true} />
                           <span className="text-[#8f9ac6] font-bold">Waiting...</span>
                        </>
                    )}
                </div>
            </div>

            {/* CONTENEDOR PRINCIPAL DE ANIMACIÓN Y FÍSICAS */}
            <div className="relative flex justify-center items-center h-64 mb-10 w-full">
              
              {/* --- OVERLAY CONTADOR --- */}
              {cuentaRegresiva !== null && (
                  <div className="absolute inset-0 flex items-center justify-center z-50 animate-pulse">
                      <span className="text-8xl md:text-[150px] font-black text-white drop-shadow-[0_0_30px_rgba(108,99,255,0.8)] opacity-90">
                          {cuentaRegresiva}
                      </span>
                  </div>
              )}

              {/* Efecto de Impacto Expansivo */}
              <div className={`absolute inset-0 bg-${ganador === 'Heads' ? '[#facc15]' : '[#a855f7]'} blur-[80px] rounded-full transition-all duration-700 ease-out z-0 ${mostrarImpacto ? 'opacity-60 scale-150' : 'opacity-0 scale-50'}`}></div>

              {/* La Moneda con físicas de salto y gravedad */}
              <div className={`relative w-40 h-40 md:w-56 md:h-56 perspective-1000 z-10 ${cuentaRegresiva !== null ? 'opacity-20 blur-sm' : 'opacity-100'}`}
                   style={{
                     transform: girando ? 'translateY(-60px) scale(1.1)' : 'translateY(0px) scale(1)',
                     transition: girando ? 'transform 2s cubic-bezier(0.25, 1, 0.5, 1)' : 'transform 1s cubic-bezier(0.5, 0, 0.2, 1)'
                   }}
              >
                <div className="w-full h-full relative preserve-3d"
                  style={{
                    transitionDuration: girando ? '4s' : '0s', 
                    transitionTimingFunction: 'cubic-bezier(0.1, 0.8, 0.1, 1)', 
                    transform: `rotateY(${rotacion}deg)`
                  }}
                >
                  <div className={`absolute w-full h-full backface-hidden rounded-full border-4 bg-[#0b0e14] flex items-center justify-center transition-colors duration-300 ${mostrarImpacto && ganador === 'Heads' ? 'border-[#facc15] shadow-[0_0_60px_rgba(250,204,21,1)]' : 'border-[#3f4354] shadow-none'}`}>
                    <img src={imgMonedaHeads} className="w-[80%] h-[80%] object-contain drop-shadow-xl" alt="Heads" />
                  </div>
                  
                  <div className={`absolute w-full h-full backface-hidden rounded-full border-4 bg-[#0b0e14] flex items-center justify-center transition-colors duration-300 ${mostrarImpacto && ganador === 'Tails' ? 'border-[#a855f7] shadow-[0_0_60px_rgba(168,85,247,1)]' : 'border-[#3f4354] shadow-none'}`}
                       style={{ transform: 'rotateY(180deg)' }}>
                    <img src={imgMonedaTails} className="w-[80%] h-[80%] object-contain drop-shadow-xl" alt="Tails" />
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-black text-white uppercase tracking-widest mt-4 min-h-[40px]">
              {cuentaRegresiva !== null ? 'PREPARING...' : (ganador ? `${ganador} WINS!` : (girando ? 'FLIPPING...' : (partidaSeleccionada.estado === 'waiting' ? 'WAITING FOR CHALLENGER' : 'READY')))}
            </h2>
          </div>
        )}

      </div>

      {/* =========================================
          MODAL JOIN
      ========================================= */}
      {modalJoinAbierto && partidaSeleccionada && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-[#252839]">
              <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                JOIN GAME <span className="text-[#8f9ac6] text-sm">#{partidaSeleccionada.id.toString().substring(0,6)}</span>
              </h2>
              <button onClick={() => setModalJoinAbierto(false)} className="text-[#8f9ac6] hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                <div className="w-full md:w-2/3 p-6 overflow-y-auto custom-scrollbar border-r border-[#252839]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Your Inventory</h3>
                        <button onClick={handleAutoSelectJoin} className="text-xs bg-[#2a2e44] hover:bg-[#32364f] text-[#E1E4F2] px-3 py-1 rounded border border-[#2D314A] transition-colors">
                            Auto Match
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {misPets.map(pet => {
                            const isSelected = selectedPetsToJoin.some(p => p.inventarioId === pet.inventarioId);
                            return (
                                <div key={pet.inventarioId} onClick={() => toggleSelectPetJoin(pet)} className={`relative bg-[#141323] border-2 rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition-all ${isSelected ? 'border-[#6C63FF] shadow-[0_0_15px_rgba(108,99,255,0.3)]' : 'border-[#2F3347] hover:border-[#4f567a]'}`}>
                                    <img src={pet.img} className="w-12 h-12 object-contain mb-2" alt="pet"/>
                                    <div className="text-[10px] text-center w-full truncate text-[#8f9ac6] font-bold">{pet.nombre}</div>
                                    <div className="text-xs font-black text-white flex items-center gap-1 mt-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="w-full md:w-1/3 p-6 bg-[#141323] flex flex-col justify-between">
                    <div>
                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Target Value</h3>
                        <div className="text-2xl font-black text-white flex items-center justify-center gap-2 py-3 bg-[#1c1f2e] rounded-lg border border-[#252839] mb-6">
                            <RedCoin cls="w-6 h-6"/> {formatValue(partidaSeleccionada.valorTotalHost)}
                        </div>

                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Your Value</h3>
                        <div className={`text-2xl font-black flex items-center justify-center gap-2 py-3 rounded-lg border border-[#252839] mb-2 ${dataJoinValidacion.valida ? 'text-[#facc15] bg-[#facc15]/10 border-[#facc15]' : 'text-white bg-[#1c1f2e]'}`}>
                            <RedCoin cls="w-6 h-6"/> {formatValue(totalSeleccionadoToJoin)}
                        </div>
                        <div className={`text-center text-xs font-bold mb-6 ${dataJoinValidacion.valida ? 'text-[#facc15]' : 'text-red-400'}`}>
                            {dataJoinValidacion.diferenciaPrc > 0 ? '+' : ''}{dataJoinValidacion.diferenciaPrc}% Difference
                        </div>
                    </div>

                    <button 
                        onClick={confirmarUnionYJugar} 
                        disabled={!dataJoinValidacion.valida}
                        className={`w-full h-12 rounded-lg font-black text-white uppercase tracking-widest transition-all ${dataJoinValidacion.valida ? 'bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] shadow-[0_4px_15px_rgba(108,99,255,0.4)] hover:scale-[1.02]' : 'bg-[#2a2e44] text-[#8f9ac6] cursor-not-allowed opacity-50'}`}
                    >
                        CONFIRM JOIN
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
