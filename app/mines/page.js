"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Icono de Moneda Verde para apuestas
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

// Formateador
const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// Matemática de Casino Visual
const calculateMultiplier = (mines, clicks) => {
  if (clicks === 0) return 1.00;
  let multiplier = 0.95; 
  for (let i = 0; i < clicks; i++) {
    multiplier *= (25 - i) / (25 - mines - i);
  }
  return multiplier;
};

export default function MinesGame() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Saldo AHORA CONECTADO A LA BASE DE DATOS REAL (profiles)
  const [saldoVerde, setSaldoVerde] = useState(0); 
  const [betAmount, setBetAmount] = useState(100);
  const [minesCount, setMinesCount] = useState(3);
  
  // Estados del juego
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState('idle'); // 'idle', 'playing', 'cashed_out', 'busted'
  const [grid, setGrid] = useState([]);
  const [safeClicks, setSafeClicks] = useState(0);
  const [shake, setShake] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const initUserAndBalance = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            
            // 1. OBTENER SALDO REAL DE SUPABASE
            const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', user.id).single();
            if (profile) setSaldoVerde(profile.saldo_verde || 0);

            // 2. ESCUCHAR CAMBIOS EN TIEMPO REAL
            supabase.channel('mines_balance_channel')
              .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
                (payload) => setSaldoVerde(payload.new.saldo_verde || 0)
              ).subscribe();

        } else {
            let tempId = localStorage.getItem('temp_user_id');
            if (!tempId) { tempId = crypto.randomUUID(); localStorage.setItem('temp_user_id', tempId); }
            setCurrentUser({ id: tempId });
        }
    };
    initUserAndBalance();
    resetGrid();
  }, []);

  const resetGrid = () => {
    const emptyGrid = Array.from({ length: 25 }, (_, i) => ({ id: i, isMine: false, revealed: false }));
    setGrid(emptyGrid);
  };

  const startGame = async () => {
    if (betAmount > saldoVerde) return alert("❌ Not enough Green Balance!");
    if (betAmount <= 0) return alert("❌ Bet must be greater than 0");
    if (!currentUser) return alert("⏳ Loading user...");

    setIsProcessing(true);

    const { data: partidaId, error } = await supabase.rpc('iniciar_mines', {
        p_usuario_id: currentUser.id,
        p_bet: betAmount,
        p_mines: minesCount
    });

    if (error || !partidaId) {
        setIsProcessing(false);
        return alert("Error connecting to server. Try again.");
    }

    setActiveGameId(partidaId);
    setSaldoVerde(prev => prev - betAmount);
    setSafeClicks(0);
    setGameState('playing');
    resetGrid();
    setIsProcessing(false);
  };

  const handleTileClick = async (index) => {
    if (gameState !== 'playing' || grid[index].revealed || isProcessing) return;

    setIsProcessing(true);

    const { data: resultado, error } = await supabase.rpc('revelar_mina', {
        p_partida_id: activeGameId,
        p_celda: index
    });

    if (error) {
        setIsProcessing(false);
        return console.error("Error validando celda:", error);
    }

    const newGrid = [...grid];
    newGrid[index].revealed = true;

    if (resultado.estado === 'busted') {
      setGameState('busted');
      revealAllServerGrid(resultado.grid, index);
      triggerShake();
      setActiveGameId(null);
    } else if (resultado.estado === 'safe') {
      setGrid(newGrid);
      const newClicks = safeClicks + 1;
      setSafeClicks(newClicks);

      if (newClicks === 25 - minesCount) {
        handleCashout();
      }
    }
    
    setIsProcessing(false);
  };

  const handleCashout = async () => {
    if (gameState !== 'playing' || safeClicks === 0 || isProcessing) return;
    
    setIsProcessing(true);

    const { data: resultado, error } = await supabase.rpc('cashout_mines', {
        p_partida_id: activeGameId
    });

    if (error) {
        setIsProcessing(false);
        return console.error("Error en cashout:", error);
    }

    setGameState('cashed_out');
    revealAllServerGrid(resultado.grid, -1);
    setActiveGameId(null);
    setIsProcessing(false);
  };

  const revealAllServerGrid = (serverGridArray, explodedIndex) => {
    const revealedGrid = grid.map((tile, i) => ({
        id: i,
        revealed: true,
        isMine: serverGridArray[i], 
        exploded: i === explodedIndex 
    }));
    setGrid(revealedGrid);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const currentMultiplier = calculateMultiplier(minesCount, safeClicks);
  const potentialWin = Math.floor(betAmount * currentMultiplier);

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#0b0e14] p-4 md:p-8 animate-fade-in ${shake ? 'animate-shake' : ''}`}>
      <div className="max-w-[1000px] mx-auto">
        
        {/* Header con Saldo Real */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase drop-shadow-md">Mines</h1>
          <div className="bg-[#14171f] border border-[#222630] px-4 py-2 rounded-lg flex items-center gap-2 shadow-inner">
            <span className="text-[#7c8291] text-xs font-bold uppercase">Balance:</span>
            <span className="text-[#22c55e] font-black flex items-center gap-1.5"><GreenCoin cls="w-4 h-4 md:w-5 md:h-5"/> {formatValue(saldoVerde)}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 bg-[#14171f]/80 backdrop-blur-xl border border-[#222630] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          
          <div className="w-full md:w-[35%] flex flex-col gap-6">
            
            <div className="bg-[#0b0e14] border border-[#222630] rounded-xl p-4 shadow-inner">
              <label className="text-[#7c8291] text-xs font-bold uppercase tracking-widest mb-2 block">Bet Amount</label>
              <div className="relative">
                <GreenCoin cls="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"/>
                <input 
                  type="number" 
                  value={betAmount} 
                  onChange={e => setBetAmount(Number(e.target.value))}
                  disabled={gameState === 'playing'}
                  className="w-full bg-[#14171f] text-white font-black text-lg rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-[#22c55e] disabled:opacity-50"
                />
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setBetAmount(prev => Math.floor(prev / 2))} disabled={gameState === 'playing'} className="flex-1 bg-[#1c1f2e] hover:bg-[#252839] py-1.5 rounded text-xs font-bold uppercase transition-colors disabled:opacity-50 text-[#8f9ac6]">1/2</button>
                <button onClick={() => setBetAmount(prev => prev * 2)} disabled={gameState === 'playing'} className="flex-1 bg-[#1c1f2e] hover:bg-[#252839] py-1.5 rounded text-xs font-bold uppercase transition-colors disabled:opacity-50 text-[#8f9ac6]">2x</button>
                <button onClick={() => setBetAmount(saldoVerde)} disabled={gameState === 'playing'} className="flex-1 bg-[#1c1f2e] hover:bg-[#252839] py-1.5 rounded text-xs font-bold uppercase transition-colors disabled:opacity-50 text-[#8f9ac6]">Max</button>
              </div>
            </div>

            <div className="bg-[#0b0e14] border border-[#222630] rounded-xl p-4 shadow-inner">
              <label className="text-[#7c8291] text-xs font-bold uppercase tracking-widest mb-2 block">Mines</label>
              <select 
                value={minesCount} 
                onChange={e => setMinesCount(Number(e.target.value))}
                disabled={gameState === 'playing'}
                className="w-full bg-[#14171f] text-white font-black text-lg rounded-lg py-2 px-4 focus:outline-none focus:ring-1 focus:ring-[#22c55e] disabled:opacity-50 cursor-pointer"
              >
                {[1,2,3,4,5,10,15,20,24].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {gameState === 'playing' ? (
              <button 
                onClick={handleCashout}
                disabled={safeClicks === 0 || isProcessing}
                className={`w-full py-4 rounded-xl font-black text-xl uppercase tracking-widest transition-all ${
                  safeClicks > 0 
                    ? 'bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                    : 'bg-[#1c1f2e] text-[#4a506b] cursor-not-allowed'
                }`}
              >
                {safeClicks > 0 ? `CASHOUT ${formatValue(potentialWin)}` : 'CASHOUT'}
              </button>
            ) : (
              <button 
                onClick={startGame}
                disabled={isProcessing}
                className="w-full py-4 bg-[#6C63FF] hover:bg-[#5a52d5] text-white rounded-xl font-black text-xl uppercase tracking-widest shadow-[0_0_20px_rgba(108,99,255,0.4)] transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50"
              >
                BET
              </button>
            )}

          </div>

          <div className="flex-1 flex justify-center items-center bg-[#0b0e14] rounded-xl p-4 border border-[#222630] relative overflow-hidden shadow-inner">
            
            {gameState === 'cashed_out' && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fade-in">
                    <div className="bg-[#22c55e]/20 border-2 border-[#22c55e] px-10 py-8 rounded-2xl text-center shadow-[0_0_50px_rgba(34,197,94,0.4)]">
                        <h2 className="text-3xl font-black text-[#22c55e] uppercase tracking-widest mb-2 drop-shadow-md">Cashed Out!</h2>
                        <p className="text-white text-3xl font-black flex items-center justify-center gap-2"><GreenCoin cls="w-8 h-8"/> {formatValue(potentialWin)}</p>
                        <p className="text-[#8f9ac6] mt-4 font-bold uppercase text-sm">{currentMultiplier.toFixed(2)}x Multiplier</p>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[450px] aspect-square grid grid-cols-5 gap-2">
              {grid.map((tile, i) => (
                <button
                  key={tile.id}
                  onClick={() => handleTileClick(i)}
                  disabled={gameState !== 'playing' || tile.revealed}
                  className={`rounded-lg transition-all duration-300 relative overflow-hidden flex items-center justify-center shadow-md
                    ${tile.revealed 
                      ? (tile.isMine 
                          ? (tile.exploded ? 'bg-red-500 border-b-4 border-red-700 scale-95 shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-[#1c1f2e] border border-[#ef4444]/30 opacity-70') 
                          : 'bg-[#14151f] border border-[#22c55e]/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]') 
                      : 'bg-[#252839] border-b-4 border-[#1c1f2e] hover:bg-[#2F3347] hover:-translate-y-1'
                    }
                  `}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {tile.revealed && tile.isMine && <img src="https://cdn-icons-png.flaticon.com/512/11252/11252474.png" className={`w-1/2 h-1/2 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] ${tile.exploded ? 'animate-bounce-in' : ''}`} />}
                    {tile.revealed && !tile.isMine && <GreenCoin cls="w-1/2 h-1/2 opacity-90 animate-fade-in" />}
                  </div>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
