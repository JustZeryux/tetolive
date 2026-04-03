"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

export default function MinesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [isProcessingDb, setIsProcessingDb] = useState(false); // Para evitar doble click mientras carga Supabase

  // === ESTADOS DEL JUEGO ===
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); 
  
  const [minesLocation, setMinesLocation] = useState([]);
  const [revealedTiles, setRevealedTiles] = useState([]);
  const [multiplier, setMultiplier] = useState(1.00);

  // === CARGA INICIAL ===
  useEffect(() => {
    const fetchData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setCurrentUser(userData.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
        setUserProfile(profile);
      }
      setCargando(false);
    };
    fetchData();
  }, []);

  const calculateMultiplier = (mines, hits) => {
    if (hits === 0) return 1.00;
    let mult = 1.0;
    for (let i = 0; i < hits; i++) {
      mult *= (25 - i) / (25 - mines - i);
    }
    
    // --- SISTEMA DE NERFEO (HOUSE EDGE DINÁMICO) ---
    // Retención base de la casa aumentada al 10% (0.90) en lugar del 5% original
    let houseEdge = 0.90; 

    // Penalización drástica si el usuario elige una cantidad alta de minas (Ej: 20-24 minas)
    if (mines >= 10 && mines <= 19) {
      houseEdge = 0.80; // Retiene 20%
    } else if (mines >= 20) {
      houseEdge = 0.65; // Retiene 35% (Nerf masivo para los que juegan con 23 minas)
    }

    // Penalización adicional progresiva por cada acierto consecutivo
    // Hace que intentar sacar multiplicadores infinitos sea estadísticamente más difícil
    houseEdge -= (hits * 0.01); 

    // Calculamos el multiplicador final
    let finalMultiplier = parseFloat((mult * houseEdge).toFixed(2));

    // Garantizamos que el multiplicador nunca se rompa dando menos de 1x si ya hubo un acierto
    return finalMultiplier <= 1.00 ? 1.01 : finalMultiplier;
  };

  // === INICIAR JUEGO (COBRA A LA BASE DE DATOS) ===
  const startGame = async () => {
    if (!currentUser || !userProfile) return alert("Inicia sesión para jugar.");
    if (betAmount <= 0) return alert("La apuesta debe ser mayor a 0.");
    if (betAmount > userProfile.saldo_verde) return alert("No tienes suficientes monedas.");
    if (mineCount < 1 || mineCount > 24) return alert("Las minas deben estar entre 1 y 24.");

    setIsProcessingDb(true);

    try {
      const nuevoSaldo = userProfile.saldo_verde - betAmount;
      
      // 1. DESCONTAR EN SUPABASE REAL
      const { error } = await supabase
        .from('profiles')
        .update({ saldo_verde: nuevoSaldo })
        .eq('id', currentUser.id);

      if (error) throw error;

      // 2. ACTUALIZAR UI SI EL COBRO FUE EXITOSO
      setUserProfile(prev => ({ ...prev, saldo_verde: nuevoSaldo }));

      // Generar tablero
      let bombArray = [];
      while (bombArray.length < mineCount) {
        let rand = Math.floor(Math.random() * 25);
        if (!bombArray.includes(rand)) bombArray.push(rand);
      }

      setMinesLocation(bombArray);
      setRevealedTiles([]);
      setMultiplier(1.00);
      setIsPlaying(true);
      setIsGameOver(false);
      setGameResult(null);
    } catch (err) {
      console.error(err);
      alert("Error al procesar la apuesta en la base de datos.");
    } finally {
      setIsProcessingDb(false);
    }
  };

  // === CLICKS EN LAS CASILLAS ===
  const handleTileClick = (index) => {
    if (!isPlaying || isGameOver || revealedTiles.includes(index) || isProcessingDb) return;

    const newRevealed = [...revealedTiles, index];
    setRevealedTiles(newRevealed);

    if (minesLocation.includes(index)) {
      // BOOM! Perdió. (Ya se cobró la apuesta al inicio, así que no hacemos nada con la BD).
      setIsPlaying(false);
      setIsGameOver(true);
      setGameResult('lose');
    } else {
      // Gema! Sube multiplicador
      const hits = newRevealed.length;
      const newMult = calculateMultiplier(mineCount, hits);
      setMultiplier(newMult);

      // Si abrió todas las gemas posibles sin tocar bomba (Victoria perfecta)
      if (hits === 25 - mineCount) {
        cashout(newMult);
      }
    }
  };

  // === RETIRAR GANANCIAS (PAGA EN LA BASE DE DATOS) ===
  const cashout = async (finalMultiplier = multiplier) => {
    if (!isPlaying || isGameOver || revealedTiles.length === 0 || isProcessingDb) return;

    setIsProcessingDb(true);
    const winAmount = Math.floor(betAmount * finalMultiplier);
    
    try {
      const nuevoSaldo = userProfile.saldo_verde + winAmount;

      // 1. PAGAR GANANCIAS EN SUPABASE REAL
      const { error } = await supabase
        .from('profiles')
        .update({ saldo_verde: nuevoSaldo })
        .eq('id', currentUser.id);

      if (error) throw error;

      // 2. ACTUALIZAR UI SI EL PAGO FUE EXITOSO
      setUserProfile(prev => ({ ...prev, saldo_verde: nuevoSaldo }));

      setIsPlaying(false);
      setIsGameOver(true);
      setGameResult('win');
    } catch (err) {
      console.error(err);
      alert("Error al guardar tus ganancias en la base de datos.");
    } finally {
      setIsProcessingDb(false);
    }
  };

  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#22c55e]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Minas...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#22c55e]/10 to-transparent blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col lg:flex-row gap-8">
        
        {/* === CONTROLES (IZQUIERDA) === */}
        <div className="w-full lg:w-1/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-8 text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              Mines
            </h2>

            <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 mb-6 flex justify-between items-center shadow-inner">
              <span className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider">Tu Saldo</span>
              <span className="font-black text-lg text-white flex items-center gap-2">
                <GreenCoin /> {formatValue(userProfile?.saldo_verde || 0)}
              </span>
            </div>

            <div className="mb-6">
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Monto de Apuesta</label>
              <div className="flex bg-[#0b0e14] border border-[#252839] rounded-xl overflow-hidden focus-within:border-[#22c55e] focus-within:shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all">
                <div className="pl-4 flex items-center justify-center bg-[#1c1f2e] border-r border-[#252839]">
                  <GreenCoin cls="w-5 h-5" />
                </div>
                <input 
                  type="number" 
                  disabled={isPlaying || isProcessingDb}
                  value={betAmount} 
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-white font-bold p-3 outline-none"
                />
                <button onClick={() => setBetAmount(prev => Math.max(1, Math.floor(prev / 2)))} disabled={isPlaying || isProcessingDb} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">1/2</button>
                <button onClick={() => setBetAmount(prev => prev * 2)} disabled={isPlaying || isProcessingDb} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">2x</button>
                <button onClick={() => setBetAmount(userProfile?.saldo_verde || 0)} disabled={isPlaying || isProcessingDb} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs text-[#22c55e] transition-colors">MAX</button>
              </div>
            </div>

            <div className="mb-8">
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Minas (1-24)</label>
              <select 
                disabled={isPlaying || isProcessingDb}
                value={mineCount} 
                onChange={(e) => setMineCount(Number(e.target.value))}
                className="w-full bg-[#0b0e14] border border-[#252839] text-white font-bold p-4 rounded-xl outline-none focus:border-[#red-500] cursor-pointer appearance-none"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} Minas</option>
                ))}
              </select>
            </div>
          </div>

          {!isPlaying ? (
            <button 
              onClick={startGame}
              disabled={isProcessingDb}
              className={`w-full py-5 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest transition-all ${isProcessingDb ? 'bg-gray-600 opacity-50 cursor-wait' : 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]'}`}
            >
              {isProcessingDb ? 'Conectando...' : 'Apostar'}
            </button>
          ) : (
            <button 
              onClick={() => cashout(multiplier)}
              disabled={isProcessingDb}
              className={`w-full py-5 rounded-2xl font-black text-xl text-white uppercase tracking-widest flex flex-col items-center justify-center leading-tight transition-all ${isProcessingDb ? 'bg-gray-600 opacity-50 cursor-wait' : 'bg-gradient-to-r from-[#eab308] to-[#ca8a04] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)]'}`}
            >
              <span>{isProcessingDb ? 'Cobrando...' : 'Retirar Ganancia'}</span>
              {!isProcessingDb && <span className="text-sm opacity-90"><GreenCoin cls="w-4 h-4"/> {Math.floor(betAmount * multiplier).toLocaleString()}</span>}
            </button>
          )}
        </div>

        {/* === TABLERO DE JUEGO (DERECHA) === */}
        <div className="w-full lg:w-2/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 lg:p-10 shadow-2xl flex flex-col items-center justify-center relative min-h-[500px]">
          
          <img 
            src="/teto.png" 
            alt="Teto" 
            className="absolute left-10 bottom-10 w-72 opacity-[0.15] pointer-events-none drop-shadow-[0_0_20px_rgba(34,197,94,0.5)] z-0"
            onError={(e) => e.target.style.display = 'none'}
          />

          <div className="w-full flex justify-between items-end mb-8 relative z-10">
            <div>
              <p className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-1">Multiplicador</p>
              <p className="text-4xl font-black text-[#22c55e] drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">{multiplier.toFixed(2)}x</p>
            </div>
            <div className="text-right">
              <p className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-1">Ganancia Potencial</p>
              <p className="text-2xl font-black text-white flex items-center gap-2 justify-end">
                <GreenCoin cls="w-6 h-6"/> {Math.floor(betAmount * multiplier).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 sm:gap-4 w-full max-w-[500px] aspect-square relative z-10">
            {[...Array(25)].map((_, i) => {
              const isRevealed = revealedTiles.includes(i);
              const isMine = minesLocation.includes(i);
              
              let bgClass = "bg-[#252839] hover:bg-[#2F3347] border-[#3b405a]"; 
              let content = null;

              if (isRevealed || isGameOver) {
                if (isMine) {
                  bgClass = isRevealed ? "bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "bg-red-500/10 border-red-500/50 opacity-50";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-bounce-in">💣</span>;
                } else {
                  bgClass = "bg-[#22c55e]/20 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.3)]";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-bounce-in">💎</span>;
                }
              }

              return (
                <button
                  key={i}
                  disabled={!isPlaying || isGameOver || isRevealed || isProcessingDb}
                  onClick={() => handleTileClick(i)}
                  className={`w-full h-full rounded-xl sm:rounded-2xl border-b-4 flex items-center justify-center transition-all duration-200 ${bgClass} ${isPlaying && !isRevealed && !isGameOver && !isProcessingDb ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:border-b-0' : 'cursor-default'}`}
                >
                  {content}
                </button>
              );
            })}

            {isGameOver && gameResult === 'win' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl animate-fade-in">
                <div className="bg-[#14151f] border-2 border-[#22c55e] p-8 rounded-3xl text-center shadow-[0_0_50px_rgba(34,197,94,0.4)] transform scale-110">
                  <h3 className="text-3xl font-black text-[#22c55e] uppercase tracking-widest mb-2">¡Retirada Exitosa!</h3>
                  <p className="text-xl font-bold text-white flex items-center justify-center gap-2">
                    Ganaste <GreenCoin cls="w-6 h-6"/> {Math.floor(betAmount * multiplier).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            
            {isGameOver && gameResult === 'lose' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl animate-fade-in">
                <div className="bg-[#14151f] border-2 border-red-500 p-8 rounded-3xl text-center shadow-[0_0_50px_rgba(239,68,68,0.4)] transform scale-110">
                  <h3 className="text-4xl font-black text-red-500 uppercase tracking-widest mb-2">¡BOOM!</h3>
                  <p className="text-lg font-bold text-[#8f9ac6]">Perdiste la apuesta.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
