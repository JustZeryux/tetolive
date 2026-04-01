"use client";
import { useState, useMemo, useEffect } from 'react';
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

export default function BloxypotCoinflip() {
  const [misPets, setMisPets] = useState([]);
  const [vistaActual, setVistaActual] = useState('lobby'); 
  const [girando, setGirando] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [ganador, setGanador] = useState(null);

  // Estados Creador
  const [creatorSelectedPets, setCreatorSelectedPets] = useState([]);
  const [creatorSide, setCreatorSide] = useState(null); 
  const [creatorSearch, setCreatorSearch] = useState('');

  // Estados Join/Arena
  const [partidaSeleccionada, setPartidaSeleccionada] = useState(null); 
  const [selectedPetsToJoin, setSelectedPetsToJoin] = useState([]);
  const [modalJoinAbierto, setModalJoinAbierto] = useState(false);

  // Lobby Fake (Para que haya contra quién jugar)
  const [lobbyGames, setLobbyGames] = useState([
    { 
      id: 1, 
      host: 'Zeryux', 
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zeryux', 
      lado: 'Heads', 
      petsHost: [
        {img: 'https://cdn.bgsi.gg/items/giant-robot.png', color: '#facc15', valor: 25000000, nombre: 'Giant Robot'},
        {img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', color: '#a855f7', valor: 5000000, nombre: 'QUE FOFO'},
      ], 
      valorTotalHost: 30000000, 
      estado: 'waiting',
      challenger: null,
      petsChallenger: []
    }
  ]);

  useEffect(() => {
    const iniciales = [];
    for(let i = 0; i < 25; i++) {
      const p = PETS_DATABASE[Math.floor(Math.random() * PETS_DATABASE.length)];
      if(p) iniciales.push({ ...p, inventarioId: Date.now() + i });
    }
    // Ordenar inventario por defecto (mayor a menor)
    setMisPets(iniciales.sort((a, b) => b.valor - a.valor));
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
    // Selecciona las 3 mascotas más caras automáticamente
    const sorted = [...misPets].sort((a, b) => b.valor - a.valor);
    setCreatorSelectedPets(sorted.slice(0, 3));
  };

  const handleCreateGame = () => {
    if (creatorSelectedPets.length === 0 || !creatorSide) return alert("Select side and pets!");
    const newGame = { 
        id: Date.now(), 
        host: 'NinjaUser (You)', 
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NinjaUser', 
        lado: creatorSide, 
        petsHost: creatorSelectedPets, 
        valorTotalHost: totalCreatorValue, 
        estado: 'waiting',
        challenger: null,
        petsChallenger: [] 
    };
    setLobbyGames([newGame, ...lobbyGames]);
    setVistaActual('lobby'); 
    setCreatorSelectedPets([]); 
    setCreatorSide(null);
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
      setGirando(false);
      setGanador(null);
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
    
    // Lógica Greedy: Trata de sumar mascotas hasta llegar al rango
    for (let pet of misPets) {
        if (currentSum + pet.valor <= maxVal) {
            currentSum += pet.valor;
            selected.push(pet);
        }
        if (currentSum >= minVal && currentSum <= maxVal) break;
    }
    setSelectedPetsToJoin(selected);
  };

  const confirmarUnionYJugar = () => {
    if (!dataJoinValidacion.valida) return alert("Pets are outside the 2% range!");
    
    const partidaActualizada = {
        ...partidaSeleccionada,
        challenger: 'NinjaUser (You)',
        petsChallenger: selectedPetsToJoin,
        estado: 'playing' // Cambiamos el estado
    };
    
    // ¡FIX CRÍTICO! Actualizamos el array global para que el Lobby lo refleje
    setLobbyGames(prev => prev.map(g => g.id === partidaActualizada.id ? partidaActualizada : g));
    
    setPartidaSeleccionada(partidaActualizada);
    setModalJoinAbierto(false); 
    setVistaActual('arena'); 
    setGirando(true); 
    setGanador(null);

    // Animación de la moneda
    setTimeout(() => {
      setRotacion(prevRotacion => {
        const ganaHeads = Math.random() < 0.5;
        const vueltasBase = prevRotacion + 3600; // Da 10 vueltas
        const nuevaRot = ganaHeads ? vueltasBase + (360 - (vueltasBase % 360)) : vueltasBase + (180 - (vueltasBase % 360)) + 360;
        
        setTimeout(() => { 
            setGirando(false); 
            setGanador(ganaHeads ? 'Heads' : 'Tails'); 
        }, 3500);

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
            {/* Stats Superiores */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-6">
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(108, 99, 255, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black">{lobbyGames.length}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Active Rooms</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(239, 68, 68, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black flex items-center gap-2"><RedCoin cls="w-6 h-6"/> {formatValue(lobbyGames.reduce((acc, g) => acc + g.valorTotalHost, 0))}</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Total Value</span>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg p-4 border border-[#252839]" style={{background: 'radial-gradient(circle at 100% 100%, rgba(108, 99, 255, 0.15) 0%, transparent 80%), #1c1f2e'}}>
                <div className="flex flex-col">
                  <span className="text-white text-2xl font-black">24</span>
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Total Items</span>
                </div>
              </div>
            </div>

            {/* Controles: CREATE GAME */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => setVistaActual('crear')} className="flex-1 md:flex-none cursor-pointer h-[38px] px-6 text-sm font-bold rounded-md border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_15px_rgba(108,99,255,0.3)] hover:opacity-90 transition-all uppercase tracking-wider hover:scale-105">
                  Create Game
                </button>
              </div>
            </div>

            {/* LISTA DE PARTIDAS (Lobby) */}
            <div className="flex flex-col gap-2">
              {lobbyGames.map((game, idx) => (
                <div key={game.id} className="relative grid grid-cols-1 xl:grid-cols-[auto_1fr_auto_auto] items-center gap-4 md:gap-6 rounded-lg border border-[#252839] bg-[#1c1f2e] py-3 px-4 md:pl-6 md:pr-4 transition-all hover:border-[#3f4354] animate-fade-in" style={{animationDelay: `${idx * 0.05}s`}}>
                  
                  {/* Host VS Challenger */}
                  <div className="flex items-center gap-3 justify-center xl:justify-start">
                    <AvatarVS img={game.avatar} side={game.lado} />
                    <strong className="text-lg font-black text-[#555b82] italic">VS</strong>
                    {game.estado === 'playing' ? (
                        <AvatarVS img="https://api.dicebear.com/7.x/avataaars/svg?seed=NinjaUser" side={game.lado === 'Heads' ? 'Tails' : 'Heads'} />
                    ) : (
                        <AvatarVS isWaiting={true} />
                    )}
                  </div>

                  {/* Stacking Pets */}
                  <div className="flex justify-center xl:justify-start py-2">
                    <div className="flex items-center ml-2">
                      {game.petsHost.slice(0, 5).map((pet, i) => (
                        <div key={i} className="relative box-border block h-12 w-12 md:h-14 md:w-14 rounded-md border-2 border-[#2F3347] bg-[#141323] overflow-hidden -ml-4 transition-transform duration-200 hover:-translate-y-2 hover:border-[#6C63FF] shadow-lg group cursor-pointer" style={{zIndex: 10 - i}}>
                          <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                          <img src={pet.img} className="block w-full h-full object-contain scale-110 drop-shadow-md group-hover:scale-125 transition-transform" alt="pet"/>
                        </div>
                      ))}
                      {game.petsHost.length > 5 && (
                        <div className="relative box-border flex items-center justify-center h-12 w-12 md:h-14 md:w-14 rounded-md border-2 border-[#2F3347] bg-[#141323] overflow-hidden -ml-4 z-[5] cursor-pointer">
                          <img src={game.petsHost[5].img} className="block w-full h-full object-contain blur-[2px] opacity-40" alt="pet"/>
                          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm drop-shadow-md bg-black/40">+{game.petsHost.length - 5}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Total Value */}
                  <div className="text-center w-full xl:w-32 justify-self-center">
                    <p className="inline-flex items-center gap-2 text-xl font-black text-white drop-shadow-md">
                      <RedCoin cls="w-5 h-5 md:w-6 md:h-6"/> <span>{formatValue(game.valorTotalHost)}</span>
                    </p>
                    <p className="text-xs font-bold text-[#8f9ac6] mt-0.5">
                      {formatValue(game.valorTotalHost * 0.98)} - {formatValue(game.valorTotalHost * 1.02)}
                    </p>
                  </div>

                  {/* BOTONES FUNCIONALES (Join & View) */}
                  <div className="flex justify-center xl:justify-end gap-2 w-full mt-2 xl:mt-0">
                    {game.estado === 'waiting' && (
                        <button onClick={() => abrirModalJoin(game)} className="w-full xl:w-24 cursor-pointer h-[34px] px-5 text-sm font-bold rounded-md border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_10px_rgba(108,99,255,0.25)] hover:shadow-[0_4px_15px_rgba(108,99,255,0.4)] transition-all uppercase tracking-widest hover:-translate-y-0.5">
                        JOIN
                        </button>
                    )}
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
                {/* Panel Izquierdo: Selección y Checkout */}
                <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <div className="bg-[#1c1f2e] border border-[#252839] rounded-xl p-6 shadow-lg">
                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4 border-b border-[#252839] pb-2">1. Choose your Side</h3>
                        <div className="flex gap-4 mb-6">
                            <button onClick={() => setCreatorSide('Heads')} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${creatorSide === 'Heads' ? 'bg-[#facc15]/10 border-[#facc15] shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'bg-[#141323] border-[#2F3347] hover:border-[#3f4354]'}`}>
                                <img src={imgMonedaHeads} className="w-12 h-12 drop-shadow-lg" alt="Heads" />
                                <span className={`font-black uppercase tracking-widest text-xs ${creatorSide === 'Heads' ? 'text-[#facc15]' : 'text-[#8f9ac6]'}`}>Heads</span>
                            </button>
                            <button onClick={() => setCreatorSide('Tails')} className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${creatorSide === 'Tails' ? 'bg-[#a855f7]/10 border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'bg-[#141323] border-[#2F3347] hover:border-[#3f4354]'}`}>
                                <img src={imgMonedaTails} className="w-12 h-12 drop-shadow-lg" alt="Tails" />
                                <span className={`font-black uppercase tracking-widest text-xs ${creatorSide === 'Tails' ? 'text-[#a855f7]' : 'text-[#8f9ac6]'}`}>Tails</span>
                            </button>
                        </div>

                        <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4 border-b border-[#252839] pb-2">2. Game Summary</h3>
                        <div className="flex justify-between items-center bg-[#141323] p-4 rounded-xl border border-[#2F3347] mb-6 shadow-inner">
                            <span className="text-[#8f9ac6] font-bold text-sm">Total Value:</span>
                            <span className="text-white font-black text-xl flex items-center gap-1.5"><RedCoin/> {formatValue(totalCreatorValue)}</span>
                        </div>

                        <button onClick={handleCreateGame} disabled={!creatorSide || creatorSelectedPets.length === 0} className="w-full cursor-pointer py-4 text-sm font-black rounded-xl border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_15px_rgba(108,99,255,0.3)] hover:shadow-[0_4px_20px_rgba(108,99,255,0.5)] transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale hover:-translate-y-1">
                            CREATE GAME
                        </button>
                    </div>
                </div>

                {/* Panel Derecho: Inventario con AUTO SELECT */}
                <div className="w-full md:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-xl p-6 shadow-lg flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <h3 className="text-white font-black text-lg uppercase tracking-widest">Your Inventory</h3>
                        <div className="flex gap-2">
                            {/* Botón Auto Select */}
                            <button onClick={handleAutoSelectCreate} className="bg-[#2a2e44] hover:bg-[#3f4354] border border-[#3f4354] text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
                                ⚡ Auto Select
                            </button>
                            <input type="text" placeholder="Search pet..." value={creatorSearch} onChange={e => setCreatorSearch(e.target.value)} className="bg-[#141323] border border-[#2F3347] rounded-lg px-4 py-2 text-sm text-white focus:border-[#6C63FF] outline-none transition-colors w-32 md:w-auto" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {creatorFilteredPets.map((pet) => {
                            const isSelected = creatorSelectedPets.some(p => p.inventarioId === pet.inventarioId);
                            return (
                                <div key={pet.inventarioId} onClick={() => toggleCreatorPet(pet)} className={`relative bg-[#141323] border ${isSelected ? 'border-[#6C63FF] shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'border-[#2F3347]'} rounded-xl overflow-hidden flex flex-col aspect-[3/4] cursor-pointer hover:border-[#6C63FF]/50 transition-all transform ${isSelected ? '-translate-y-1' : ''}`}>
                                    <div className="absolute inset-0 opacity-[0.1]" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                                    
                                    {/* Efecto visual al seleccionar */}
                                    {isSelected && (
                                      <div className="absolute inset-0 bg-[#6C63FF]/20 z-10 pointer-events-none flex items-center justify-center">
                                          <div className="bg-[#6C63FF] rounded-full p-1 shadow-lg">
                                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                          </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex-1 p-2 flex items-center justify-center z-20"><img src={pet.img} className="drop-shadow-lg object-contain" alt="pet"/></div>
                                    <div className="w-full text-center pb-2 z-20 bg-gradient-to-t from-[#141323] to-transparent">
                                        <p className="text-[#8f9ac6] text-[10px] font-bold truncate px-1">{pet.nombre}</p>
                                        <p className="text-white font-black text-xs mt-0.5 flex items-center justify-center gap-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
             </div>
           </div>
        )}

        {/* =========================================
            VISTA 3: ARENA (El enfrentamiento)
        ========================================= */}
        {vistaActual === 'arena' && partidaSeleccionada && (
            <div className="w-full flex flex-col items-center justify-center min-h-[70vh] animate-fade-in relative">
                
                {/* Botón Volver */}
                <button onClick={() => setVistaActual('lobby')} className="absolute top-0 left-0 text-[#8f9ac6] hover:text-[#6C63FF] font-bold text-sm flex items-center gap-1 transition-colors bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] z-50 hover:bg-[#252839]">
                    &lsaquo; Back to Lobby
                </button>

                {/* Banner de Victoria */}
                {ganador && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-[#1c1f2e] border border-[#facc15] px-12 py-4 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.3)] animate-bounce text-center">
                        <p className="text-[#facc15] font-black uppercase tracking-widest text-sm mb-1">WINNER</p>
                        <p className="text-3xl font-black text-white flex items-center gap-3">
                            <img src={ganador === 'Heads' ? imgMonedaHeads : imgMonedaTails} className="w-8 h-8" alt={ganador}/> {ganador}
                        </p>
                    </div>
                )}

                <div className="flex w-full max-w-5xl justify-between items-center relative mt-16 md:mt-0">
                    
                    {/* Lado Izquierdo (Host) */}
                    <div className={`w-[35%] flex flex-col items-center transition-opacity duration-500 ${ganador && ganador !== partidaSeleccionada.lado ? 'opacity-30 grayscale' : ''}`}>
                        <div className="relative mb-6">
                            <div className={`w-32 h-32 rounded-full border-4 ${partidaSeleccionada.lado === 'Heads' ? 'border-[#facc15] shadow-[0_0_30px_rgba(250,204,21,0.3)]' : 'border-[#a855f7] shadow-[0_0_30px_rgba(168,85,247,0.3)]'} overflow-hidden bg-[#141323]`}>
                                <img src={partidaSeleccionada.avatar} className="w-full h-full object-cover" alt="host"/>
                            </div>
                            <img src={partidaSeleccionada.lado === 'Heads' ? imgMonedaHeads : imgMonedaTails} className="absolute -bottom-4 -right-4 w-12 h-12 drop-shadow-lg bg-[#0b0e14] rounded-full" alt="coin"/>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-1">{partidaSeleccionada.host}</h2>
                        <p className="text-[#8f9ac6] font-bold tracking-widest uppercase text-sm flex items-center gap-1"><RedCoin/> {formatValue(partidaSeleccionada.valorTotalHost)}</p>
                        
                        <div className="grid grid-cols-3 gap-2 mt-6">
                            {partidaSeleccionada.petsHost.slice(0,6).map((pet, i) => (
                                <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-lg p-2 flex items-center justify-center">
                                    <img src={pet.img} className="w-10 h-10 object-contain drop-shadow-md" alt="pet"/>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CENTRO: LA MONEDA 3D */}
                    <div className="w-[30%] flex justify-center items-center relative z-20">
                        <div className="relative w-40 h-40 md:w-56 md:h-56 perspective-1000">
                            <div 
                                className="w-full h-full relative preserve-3d transition-transform"
                                style={{
                                    transitionDuration: girando ? '3.5s' : '0s',
                                    transitionTimingFunction: 'cubic-bezier(0.1, 0.7, 0.1, 1)',
                                    transform: `rotateY(${rotacion}deg)`
                                }}
                            >
                                {/* Cara Frontal (Heads) */}
                                <div className="absolute w-full h-full backface-hidden rounded-full border-4 border-[#facc15] bg-[#0b0e14] shadow-[0_0_40px_rgba(250,204,21,0.4)] flex items-center justify-center">
                                    <img src={imgMonedaHeads} className="w-[80%] h-[80%] object-contain drop-shadow-xl" alt="Heads" />
                                </div>
                                {/* Cara Trasera (Tails) */}
                                <div className="absolute w-full h-full backface-hidden rounded-full border-4 border-[#a855f7] bg-[#0b0e14] shadow-[0_0_40px_rgba(168,85,247,0.4)] flex items-center justify-center rotate-y-180">
                                    <img src={imgMonedaTails} className="w-[80%] h-[80%] object-contain drop-shadow-xl" alt="Tails" />
                                </div>
                                <div className="absolute w-full h-full rounded-full bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300" style={{ transform: 'translateZ(-2px)', zIndex: -1 }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Lado Derecho (Challenger) */}
                    <div className={`w-[35%] flex flex-col items-center transition-opacity duration-500 ${ganador && ganador === partidaSeleccionada.lado ? 'opacity-30 grayscale' : ''}`}>
                        {partidaSeleccionada.challenger ? (
                            <>
                                <div className="relative mb-6">
                                    <div className={`w-32 h-32 rounded-full border-4 ${partidaSeleccionada.lado === 'Heads' ? 'border-[#a855f7] shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 'border-[#facc15] shadow-[0_0_30px_rgba(250,204,21,0.3)]'} overflow-hidden bg-[#141323]`}>
                                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=NinjaUser" className="w-full h-full object-cover" alt="challenger"/>
                                    </div>
                                    <img src={partidaSeleccionada.lado === 'Heads' ? imgMonedaTails : imgMonedaHeads} className="absolute -bottom-4 -left-4 w-12 h-12 drop-shadow-lg bg-[#0b0e14] rounded-full" alt="coin"/>
                                </div>
                                <h2 className="text-2xl font-black text-white mb-1">{partidaSeleccionada.challenger}</h2>
                                <p className="text-[#8f9ac6] font-bold tracking-widest uppercase text-sm flex items-center gap-1"><RedCoin/> {formatValue(partidaSeleccionada.petsChallenger.reduce((acc,p)=>acc+p.valor,0))}</p>
                                
                                <div className="grid grid-cols-3 gap-2 mt-6">
                                    {partidaSeleccionada.petsChallenger.slice(0,6).map((pet, i) => (
                                        <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-lg p-2 flex items-center justify-center">
                                            <img src={pet.img} className="w-10 h-10 object-contain drop-shadow-md" alt="pet"/>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            // Vista de "Esperando Jugador"
                            <div className="flex flex-col items-center justify-center h-full opacity-50">
                                <div className="w-32 h-32 rounded-full border-4 border-[#2F3347] border-dashed flex items-center justify-center bg-[#141323] mb-6 animate-pulse">
                                    <span className="text-4xl text-[#2F3347]">?</span>
                                </div>
                                <h2 className="text-xl font-black text-[#8f9ac6] uppercase tracking-widest">Waiting for Player</h2>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* =========================================
          MODAL JOIN (El Modal de Validación 2%)
      ========================================= */}
      {modalJoinAbierto && partidaSeleccionada && (
        <div className="fixed inset-0 bg-[#0b0e14]/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)]">
            
            <div className="flex justify-between items-center p-6 border-b border-[#252839] bg-[#141323]">
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Join Game VS {partidaSeleccionada.host}</h2>
              <button onClick={() => setModalJoinAbierto(false)} className="text-[#8f9ac6] hover:text-white text-3xl leading-none">&times;</button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Panel Izq: Host Bet */}
                <div className="w-full md:w-1/3 bg-[#141323] p-6 border-r border-[#252839] overflow-y-auto">
                    <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Host is betting:</h3>
                    <div className="flex justify-between items-center bg-[#1c1f2e] p-4 rounded-xl border border-[#2F3347] mb-6 shadow-inner">
                        <span className="text-white font-black text-xl flex items-center gap-1.5"><RedCoin/> {formatValue(partidaSeleccionada.valorTotalHost)}</span>
                        <img src={partidaSeleccionada.lado === 'Heads' ? imgMonedaHeads : imgMonedaTails} className="w-8 h-8 drop-shadow-lg" alt="coin" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {partidaSeleccionada.petsHost.map((pet, i) => (
                            <div key={i} className="bg-[#1c1f2e] border border-[#2F3347] rounded-lg p-2 flex flex-col items-center shadow-sm">
                                <img src={pet.img} className="w-10 h-10 object-contain drop-shadow-md mb-1" alt="pet"/>
                                <span className="text-[9px] text-[#8f9ac6] font-bold">{formatValue(pet.valor)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Panel Der: Tu Inventario y AUTO SELECT */}
                <div className="w-full md:w-2/3 p-6 flex flex-col h-full bg-[#1c1f2e]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-black text-lg uppercase tracking-widest">Select your pets</h3>
                        <div className="flex items-center gap-4">
                            <span className="text-[#8f9ac6] text-[10px] font-bold uppercase tracking-widest bg-[#141323] px-3 py-1.5 rounded-md border border-[#2F3347]">
                                Req: {formatValue(dataJoinValidacion.minVal)} - {formatValue(dataJoinValidacion.maxVal)}
                            </span>
                            <button onClick={handleAutoSelectJoin} className="bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-[0_2px_10px_rgba(108,99,255,0.3)] hover:shadow-[0_4px_15px_rgba(108,99,255,0.5)] transition-all flex items-center gap-2 cursor-pointer">
                                ⚡ Auto Select
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[300px]">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {misPets.map((pet) => {
                                const isSelected = selectedPetsToJoin.some(p => p.inventarioId === pet.inventarioId);
                                return (
                                    <div key={pet.inventarioId} onClick={() => toggleSelectPetJoin(pet)} className={`relative bg-[#141323] border ${isSelected ? 'border-[#3AFF4E] shadow-[0_0_15px_rgba(58,255,78,0.2)]' : 'border-[#2F3347]'} rounded-xl overflow-hidden flex flex-col aspect-[3/4] cursor-pointer hover:border-[#6C63FF]/50 transition-all transform ${isSelected ? '-translate-y-1' : ''}`}>
                                        <div className="absolute inset-0 opacity-[0.1]" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
                                        
                                        {/* Efecto Checkmark en Join */}
                                        {isSelected && (
                                          <div className="absolute inset-0 bg-[#3AFF4E]/10 z-10 pointer-events-none flex items-center justify-center">
                                              <div className="bg-[#3AFF4E] rounded-full p-1 shadow-lg">
                                                  <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                              </div>
                                          </div>
                                        )}

                                        <div className="flex-1 p-2 flex items-center justify-center z-20"><img src={pet.img} className="drop-shadow-lg object-contain" alt="pet"/></div>
                                        <div className="w-full text-center pb-2 z-20 bg-gradient-to-t from-[#141323] to-transparent">
                                            <p className="text-[#8f9ac6] text-[10px] font-bold truncate px-1">{pet.nombre}</p>
                                            <p className="text-white font-black text-xs mt-0.5 flex items-center justify-center gap-1"><RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Barra de validación y confirmación */}
                    <div className="mt-6 pt-6 border-t border-[#252839] flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[#8f9ac6] text-[10px] font-bold uppercase tracking-widest mb-1">Your Total Bet:</span>
                            <span className={`text-2xl font-black flex items-center gap-2 ${dataJoinValidacion.valida ? 'text-[#3AFF4E] drop-shadow-[0_0_10px_rgba(58,255,78,0.5)]' : 'text-[#ef4444]'}`}>
                                <RedCoin cls="w-6 h-6"/> {formatValue(totalSeleccionadoToJoin)}
                            </span>
                            <span className={`text-xs font-bold mt-1 ${dataJoinValidacion.valida ? 'text-[#3AFF4E]' : 'text-[#ef4444]'}`}>
                                {dataJoinValidacion.diferenciaPrc > 0 ? '+' : ''}{dataJoinValidacion.diferenciaPrc}% Difference
                            </span>
                        </div>
                        <button onClick={confirmarUnionYJugar} disabled={!dataJoinValidacion.valida} className="w-full md:w-auto px-10 py-4 text-sm font-black rounded-xl border border-[#5E55D9]/40 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_2px_15px_rgba(108,99,255,0.3)] hover:shadow-[0_4px_20px_rgba(108,99,255,0.5)] transition-all uppercase tracking-widest disabled:opacity-50 disabled:grayscale hover:-translate-y-1">
                            CONFIRM JOIN
                        </button>
                    </div>
                </div>
            </div>

          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2F3347; border-radius: 10px; }
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}