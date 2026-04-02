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
  // === ESTADOS DE USUARIO ===
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cargando, setCargando] = useState(true);

  // === ESTADOS DEL JUEGO ===
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win' | 'lose'
  
  const [minesLocation, setMinesLocation] = useState([]);
  const [revealedTiles, setRevealedTiles] = useState([]);
  const [multiplier, setMultiplier] = useState(1.00);

  // === CARGA INICIAL DE SUPABASE ===
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

  // === LÓGICA DE MULTIPLICADOR MODO CASINO ===
  const calculateMultiplier = (mines, hits) => {
    if (hits === 0) return 1.00;
    let mult = 1.0;
    for (let i = 0; i < hits; i++) {
      mult *= (25 - i) / (25 - mines - i);
    }
    // Retenemos un 5% de la casa (House Edge) para que sea realista
    return parseFloat((mult * 0.95).toFixed(2));
  };

  // === CONTROLES DEL JUEGO ===
  const startGame = async () => {
    if (!currentUser || !userProfile) return alert("Inicia sesión para jugar.");
    if (betAmount <= 0) return alert("La apuesta debe ser mayor a 0.");
    if (betAmount > userProfile.saldo_verde) return alert("No tienes suficientes monedas.");
    if (mineCount < 1 || mineCount > 24) return alert("Las minas deben estar entre 1 y 24.");

    // Cobrar la apuesta localmente (Aquí deberías llamar a tu API/Supabase para restar saldo real)
    setUserProfile(prev => ({ ...prev, saldo_verde: prev.saldo_verde - betAmount }));

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
  };

  const handleTileClick = (index) => {
    if (!isPlaying || isGameOver || revealedTiles.includes(index)) return;

    const newRevealed = [...revealedTiles, index];
    setRevealedTiles(newRevealed);

    if (minesLocation.includes(index)) {
      // BOOM! Perdió
      setIsPlaying(false);
      setIsGameOver(true);
      setGameResult('lose');
    } else {
      // Gema! Sube multiplicador
      const hits = newRevealed.length;
      const newMult = calculateMultiplier(mineCount, hits);
      setMultiplier(newMult);

      // Si abrió todas las gemas posibles
      if (hits === 25 - mineCount) {
        cashout(newMult);
      }
    }
  };

  const cashout = (finalMultiplier = multiplier) => {
    if (!isPlaying || isGameOver || revealedTiles.length === 0) return;

    const winAmount = Math.floor(betAmount * finalMultiplier);
    
    // Pagar ganancias localmente (Aquí deberías llamar a tu API/Supabase para sumar saldo real)
    setUserProfile(prev => ({ ...prev, saldo_verde: prev.saldo_verde + winAmount }));

    setIsPlaying(false);
    setIsGameOver(true);
    setGameResult('win');
  };

  // === PANTALLA DE CARGA ===
  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#22c55e]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Minas...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Luces Ambientales */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#22c55e]/10 to-transparent blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col lg:flex-row gap-8">
        
        {/* =========================================
            PANEL DE CONTROLES (IZQUIERDA)
        ========================================= */}
        <div className="w-full lg:w-1/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-8 text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              Mines
            </h2>

            {/* Saldo Actual */}
            <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 mb-6 flex justify-between items-center shadow-inner">
              <span className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider">Tu Saldo</span>
              <span className="font-black text-lg text-white flex items-center gap-2">
                <GreenCoin /> {formatValue(userProfile?.saldo_verde || 0)}
              </span>
            </div>

            {/* Monto de Apuesta */}
            <div className="mb-6">
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Monto de Apuesta</label>
              <div className="flex bg-[#0b0e14] border border-[#252839] rounded-xl overflow-hidden focus-within:border-[#22c55e] focus-within:shadow-[0_0_15px_rgba(34,197,94,0.2)] transition-all">
                <div className="pl-4 flex items-center justify-center bg-[#1c1f2e] border-r border-[#252839]">
                  <GreenCoin cls="w-5 h-5" />
                </div>
                <input 
                  type="number" 
                  disabled={isPlaying}
                  value={betAmount} 
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-white font-bold p-3 outline-none"
                />
                <button onClick={() => setBetAmount(prev => Math.max(1, Math.floor(prev / 2)))} disabled={isPlaying} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">1/2</button>
                <button onClick={() => setBetAmount(prev => prev * 2)} disabled={isPlaying} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">2x</button>
                <button onClick={() => setBetAmount(userProfile?.saldo_verde || 0)} disabled={isPlaying} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs text-[#22c55e] transition-colors">MAX</button>
              </div>
            </div>

            {/* Cantidad de Minas */}
            <div className="mb-8">
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Minas (1-24)</label>
              <select 
                disabled={isPlaying}
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

          {/* Botón Principal (Jugar / Cobrar) */}
          {!isPlaying ? (
            <button 
              onClick={startGame}
              className="w-full py-5 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all"
            >
              Apostar
            </button>
          ) : (
            <button 
              onClick={() => cashout(multiplier)}
              className="w-full py-5 rounded-2xl font-black text-xl text-white uppercase tracking-widest bg-gradient-to-r from-[#eab308] to-[#ca8a04] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transition-all flex flex-col items-center justify-center leading-tight"
            >
              <span>Retirar Ganancia</span>
              <span className="text-sm opacity-90"><GreenCoin cls="w-4 h-4"/> {Math.floor(betAmount * multiplier).toLocaleString()}</span>
            </button>
          )}
        </div>

        {/* =========================================
            TABLERO DE JUEGO (DERECHA)
        ========================================= */}
        <div className="w-full lg:w-2/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 lg:p-10 shadow-2xl flex flex-col items-center justify-center relative min-h-[500px]">
          
          {/* Teto de Fondo sutil */}
          <img 
            src="/teto.png" 
            alt="Teto Decoración" 
            className="absolute left-10 bottom-10 w-72 opacity-[0.15] pointer-events-none drop-shadow-[0_0_20px_rgba(34,197,94,0.5)] z-0"
            onError={(e) => e.target.style.display = 'none'}
          />

          {/* Info del Multiplicador Actual */}
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

          {/* Grid 5x5 */}
          <div className="grid grid-cols-5 gap-3 sm:gap-4 w-full max-w-[500px] aspect-square relative z-10">
            {[...Array(25)].map((_, i) => {
              const isRevealed = revealedTiles.includes(i);
              const isMine = minesLocation.includes(i);
              
              // Estado Visual de la celda
              let bgClass = "bg-[#252839] hover:bg-[#2F3347] border-[#3b405a]"; // Default cerrado
              let content = null;

              if (isRevealed || isGameOver) {
                if (isMine) {
                  // Bomba revelada
                  bgClass = isRevealed ? "bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "bg-red-500/10 border-red-500/50 opacity-50";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-bounce-in">💣</span>;
                } else {
                  // Gema revelada
                  bgClass = "bg-[#22c55e]/20 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.3)]";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-bounce-in">💎</span>;
                }
              }

              return (
                <button
                  key={i}
                  disabled={!isPlaying || isGameOver || isRevealed}
                  onClick={() => handleTileClick(i)}
                  className={`w-full h-full rounded-xl sm:rounded-2xl border-b-4 flex items-center justify-center transition-all duration-200 ${bgClass} ${isPlaying && !isRevealed && !isGameOver ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:border-b-0' : 'cursor-default'}`}
                >
                  {content}
                </button>
              );
            })}

            {/* Overlays de Victoria / Derrota */}
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
