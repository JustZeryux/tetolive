"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

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
  const [saldoVerde, setSaldoVerde] = useState(0); 
  
  const [betAmount, setBetAmount] = useState(10);
  const [minesCount, setMinesCount] = useState(3);
  
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameState, setGameState] = useState('idle'); 
  const [grid, setGrid] = useState([]);
  const [safeClicks, setSafeClicks] = useState(0);
  
  const [shake, setShake] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const initData = async () => {
      setLoadingUser(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      let uid = user?.id;
      if (!uid) {
          uid = localStorage.getItem('temp_user_id');
          if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('temp_user_id', uid); }
      }
      
      setCurrentUser({ id: uid });

      if (user) {
          const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', uid).single();
          if (profile) setSaldoVerde(profile.saldo_verde || 0);
      } else {
          setSaldoVerde(50000); // Saldo simulación
      }
      setLoadingUser(false);
    };
    
    initData();
    resetGrid();
  }, []);

  const resetGrid = () => {
    setGrid(Array.from({ length: 25 }, (_, i) => ({ id: i, isMine: false, revealed: false, exploded: false })));
  };

  const startGame = async () => {
    if (betAmount > saldoVerde) return alert("Not enough Green Coins!");
    if (betAmount <= 0) return alert("Bet must be greater than 0");
    if (!currentUser || loadingUser) return;

    setIsProcessing(true);

    const { data: partidaId, error } = await supabase.rpc('iniciar_mines', {
        p_user_id: currentUser.id,
        p_bet: betAmount,
        p_mines: minesCount
    });

    if (error || !partidaId) {
        setIsProcessing(false);
        return alert("Error starting game. Check balance.");
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

      if (newClicks === 25 - minesCount) handleCashout();
    }
    
    setIsProcessing(false);
  };

  const handleCashout = async () => {
    if (gameState !== 'playing' || safeClicks === 0 || isProcessing) return;
    setIsProcessing(true);

    const { data: resultado, error } = await supabase.rpc('cashout_mines', { p_partida_id: activeGameId });

    if (error) {
        setIsProcessing(false);
        return console.error("Error en cashout:", error);
    }

    setSaldoVerde(prev => prev + resultado.winnings);
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
        exploded: i === explodedIndex,
        isSafeDim: !serverGridArray[i] && !tile.revealed 
    }));
    setGrid(revealedGrid);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const currentMultiplier = calculateMultiplier(minesCount, safeClicks).toFixed(2);
  const nextMultiplier = calculateMultiplier(minesCount, safeClicks + 1).toFixed(2);
  const potentialWin = Math.floor(betAmount * currentMultiplier);

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#0b0e14] p-4 md:p-8 animate-fade-in overflow-hidden relative ${shake ? 'animate-shake' : ''}`}>
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-b from-[#22c55e]/10 to-transparent blur-[150px] pointer-events-none z-0 transition-opacity duration-1000" style={{ opacity: gameState === 'playing' ? '0.4' : (gameState === 'busted' ? '0' : '0.1') }}></div>
      {gameState === 'busted' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-b from-[#ef4444]/20 to-transparent blur-[150px] pointer-events-none z-0 animate-pulse"></div>}

      <div className="max-w-[1100px] mx-auto relative z-10">
        
        <div className="flex justify-between items-center mb-8 bg-[#14171f]/80 backdrop-blur-md border border-[#222630] p-4 rounded-2xl shadow-lg">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase flex items-center gap-3">
             <span className="text-[#22c55e] text-4xl drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]">💣</span> Mines
          </h1>
          <div className="bg-[#0b0e14] border border-[#222630] px-6 py-3 rounded-xl flex items-center gap-3 shadow-inner">
            <span className="text-[#7c8291] text-xs font-bold uppercase tracking-widest hidden sm:block">Green Balance:</span>
            <span className="text-[#22c55e] font-black text-xl flex items-center gap-2">
               <GreenCoin cls="w-5 h-5"/> {loadingUser ? '...' : formatValue(saldoVerde)}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 bg-[#14171f]/90 backdrop-blur-xl border border-[#222630] rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          
          <div className="w-full lg:w-[35%] flex flex-col gap-6">
            <div className="bg-[#0b0e14] border border-[#252839] rounded-2xl p-5 shadow-inner relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-[#22c55e]"></div>
              <label className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-3 block">Bet Amount</label>
              <div className="flex items-center bg-[#1c1f2e] border border-[#2F3347] rounded-xl p-2 focus-within:border-[#22c55e] transition-colors shadow-inner">
                <GreenCoin cls="w-6 h-6 ml-2 mr-3"/>
                <input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} disabled={gameState === 'playing' || isProcessing} className="w-full bg-transparent text-white font-black text-lg outline-none"/>
                <div className="flex gap-1.5 ml-2">
                  <button onClick={() => setBetAmount(Math.floor(betAmount / 2))} disabled={gameState === 'playing' || isProcessing} className="bg-[#2a2e44] hover:bg-[#3f4354] text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors disabled:opacity-50">1/2</button>
                  <button onClick={() => setBetAmount(betAmount * 2)} disabled={gameState === 'playing' || isProcessing} className="bg-[#2a2e44] hover:bg-[#3f4354] text-white px-3 py-1.5 rounded-lg text-xs font-black transition-colors disabled:opacity-50">2x</button>
                </div>
              </div>
            </div>

            <div className="bg-[#0b0e14] border border-[#252839] rounded-2xl p-5 shadow-inner relative overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-[#ef4444]"></div>
              <label className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-3 block">Mines Quantity</label>
              <select value={minesCount} onChange={(e) => setMinesCount(Number(e.target.value))} disabled={gameState === 'playing' || isProcessing} className="w-full bg-[#1c1f2e] border border-[#2F3347] text-white font-black text-lg p-3.5 rounded-xl outline-none cursor-pointer focus:border-[#ef4444] transition-colors appearance-none shadow-inner">
                {[...Array(24)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} {i+1 === 1 ? 'Mine' : 'Mines'}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-4 flex flex-col items-center justify-center shadow-md">
                <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1">Multiplier</span>
                <span className="text-white font-black text-2xl drop-shadow-md">{currentMultiplier}x</span>
              </div>
              <div className="flex-1 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-4 flex flex-col items-center justify-center shadow-md relative overflow-hidden">
                <div className="absolute inset-0 bg-[#22c55e]/5"></div>
                <span className="text-[#22c55e] text-[10px] font-black uppercase tracking-widest mb-1 relative z-10">Next Tile</span>
                <span className="text-[#22c55e] font-black text-2xl drop-shadow-[0_0_10px_rgba(34,197,94,0.4)] relative z-10">{nextMultiplier}x</span>
              </div>
            </div>

            {gameState === 'playing' ? (
              <button onClick={handleCashout} disabled={isProcessing} className="animate-shine w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] hover:to-[#22c55e] text-[#0b0e14] font-black py-5 rounded-2xl text-lg tracking-widest uppercase transition-all shadow-[0_0_30px_rgba(34,197,94,0.3)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)] hover:-translate-y-1 mt-auto flex flex-col items-center disabled:opacity-50">
                <span>CASHOUT</span>
                <span className="text-sm mt-1 flex items-center gap-1.5 opacity-90"><GreenCoin cls="w-4 h-4 grayscale contrast-200 brightness-0"/> {formatValue(potentialWin)}</span>
              </button>
            ) : (
              <button onClick={startGame} disabled={isProcessing || loadingUser} className="w-full bg-gradient-to-r from-[#facc15] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0b0e14] font-black py-5 rounded-2xl text-lg tracking-widest uppercase transition-all shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:shadow-[0_0_40px_rgba(250,204,21,0.6)] hover:-translate-y-1 mt-auto disabled:opacity-50">
                PLACE BET
              </button>
            )}

            {gameState === 'busted' && <div className="text-center text-[#ef4444] font-black text-2xl animate-bounce tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] mt-2">BUSTED! 💥</div>}
            {gameState === 'cashed_out' && <div className="text-center text-[#22c55e] font-black text-2xl animate-bounce tracking-widest drop-shadow-[0_0_15px_rgba(34,197,94,0.8)] mt-2">CASHED OUT! 💎</div>}
          </div>

          <div className="w-full lg:w-[65%] flex items-center justify-center bg-[#0b0e14] border border-[#252839] rounded-3xl p-6 lg:p-12 shadow-inner relative overflow-hidden">
            <div className="grid grid-cols-5 gap-3 lg:gap-4 w-full aspect-square max-w-[550px] z-10">
              {grid.map((tile, index) => {
                let tileClass = "bg-[#1c1f2e] border-b-4 border-[#141323] hover:bg-[#2a2e44] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(0,0,0,0.4)]";
                let content = null;

                if (tile.revealed) {
                  if (tile.isMine) {
                    tileClass = `bg-[#ef4444]/20 border ${tile.exploded ? 'border-[#ef4444] shadow-[0_0_40px_rgba(239,68,68,0.8)] scale-105 z-20' : 'border-[#ef4444]/50 opacity-80'} ${gameState === 'busted' && tile.exploded ? 'animate-pop-in' : ''}`;
                    content = <span className="text-4xl lg:text-6xl drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">💣</span>;
                  } else {
                    tileClass = `bg-[#22c55e]/10 border border-[#22c55e]/50 ${tile.isSafeDim ? 'opacity-40 grayscale' : 'shadow-[0_0_20px_rgba(34,197,94,0.3)] animate-pop-in'}`;
                    content = <span className={`text-4xl lg:text-6xl drop-shadow-[0_0_20px_rgba(34,197,94,0.8)] ${!tile.isSafeDim && 'floating'}`}>💎</span>;
                  }
                } else if (gameState !== 'playing') {
                  tileClass = "bg-[#1c1f2e] opacity-60 cursor-default";
                }

                return (
                  <div key={index} onClick={() => handleTileClick(index)} className={`rounded-2xl flex items-center justify-center relative overflow-hidden ${tileClass} ${isProcessing && !tile.revealed && gameState === 'playing' ? 'opacity-50 pointer-events-none' : ''}`}>
                    {!tile.revealed && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>}
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-pop-in { animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .floating { animation: float 2.5s ease-in-out infinite; }
        .animate-shine { position: relative; overflow: hidden; }
        .animate-shine::before { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent); transform: skewX(-20deg); animation: shine 3s infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.3) rotate(-10deg); } 70% { transform: scale(1.1) rotate(5deg); } 100% { opacity: 1; transform: scale(1) rotate(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px) scale(1.05); } }
        @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
        @keyframes shake { 10%, 90% { transform: translate3d(-3px, 0, 0); } 20%, 80% { transform: translate3d(5px, 0, 0); } 30%, 50%, 70% { transform: translate3d(-8px, 0, 0); } 40%, 60% { transform: translate3d(8px, 0, 0); } }
      `}} />
    </div>
  );
}
