"use client";
import { useState, useEffect, useRef } from 'react';

// Icono de Moneda Verde para apuestas
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

// Formateador
const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// Matemática de Casino Real (Calcula el multiplicador basado en minas y aciertos)
const calculateMultiplier = (mines, clicks) => {
  if (clicks === 0) return 1.00;
  let multiplier = 0.95; // 5% de House Edge simulado para darle realismo
  for (let i = 0; i < clicks; i++) {
    multiplier *= (25 - i) / (25 - mines - i);
  }
  return multiplier;
};

export default function MinesGame() {
  const [saldoVerde, setSaldoVerde] = useState(25000); // Saldo de prueba
  const [betAmount, setBetAmount] = useState(100);
  const [minesCount, setMinesCount] = useState(3);
  
  // Estados del juego: 'idle', 'playing', 'cashed_out', 'busted'
  const [gameState, setGameState] = useState('idle'); 
  const [grid, setGrid] = useState([]);
  const [safeClicks, setSafeClicks] = useState(0);
  const [shake, setShake] = useState(false);

  // Inicializar grid vacío
  useEffect(() => {
    resetGrid();
  }, []);

  const resetGrid = () => {
    const emptyGrid = Array.from({ length: 25 }, (_, i) => ({ id: i, isMine: false, revealed: false }));
    setGrid(emptyGrid);
  };

  const startGame = () => {
    if (betAmount > saldoVerde) return alert("Not enough Green Balance!");
    if (betAmount <= 0) return alert("Bet must be greater than 0");

    setSaldoVerde(prev => prev - betAmount);
    setSafeClicks(0);
    setGameState('playing');

    // Generar minas aleatorias
    let newGrid = Array.from({ length: 25 }, (_, i) => ({ id: i, isMine: false, revealed: false }));
    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
      const randomIndex = Math.floor(Math.random() * 25);
      if (!newGrid[randomIndex].isMine) {
        newGrid[randomIndex].isMine = true;
        minesPlaced++;
      }
    }
    setGrid(newGrid);
  };

  const handleTileClick = (index) => {
    if (gameState !== 'playing' || grid[index].revealed) return;

    const newGrid = [...grid];
    newGrid[index].revealed = true;

    if (newGrid[index].isMine) {
      // BUSTED (Perdiste)
      setGameState('busted');
      revealAll(newGrid);
      triggerShake();
    } else {
      // SAFE (Ganaste un paso)
      setGrid(newGrid);
      const newClicks = safeClicks + 1;
      setSafeClicks(newClicks);

      // Autocashout si descubres todas las seguras
      if (newClicks === 25 - minesCount) {
        handleCashout(newClicks);
      }
    }
  };

  const handleCashout = (currentClicks = safeClicks) => {
    if (gameState !== 'playing' || currentClicks === 0) return;
    
    const mult = calculateMultiplier(minesCount, currentClicks);
    const wonAmount = Math.floor(betAmount * mult);
    
    setSaldoVerde(prev => prev + wonAmount);
    setGameState('cashed_out');
    revealAll(grid);
  };

  const revealAll = (currentGrid) => {
    const revealedGrid = currentGrid.map(tile => ({ ...tile, revealed: true }));
    setGrid(revealedGrid);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const currentMultiplier = calculateMultiplier(minesCount, safeClicks).toFixed(2);
  const nextMultiplier = calculateMultiplier(minesCount, safeClicks + 1).toFixed(2);
  const potentialWin = Math.floor(betAmount * currentMultiplier);

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#0b0e14] p-4 md:p-8 animate-fade-in ${shake ? 'animate-shake' : ''}`}>
      <div className="max-w-[1000px] mx-auto">
        
        {/* Header con Saldo Local (Opcional, pero ayuda a la inmersión) */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-widest uppercase drop-shadow-md">Mines</h1>
          <div className="bg-[#14171f] border border-[#222630] px-4 py-2 rounded-lg flex items-center gap-2 shadow-inner">
            <span className="text-[#7c8291] text-xs font-bold uppercase">Balance:</span>
            <span className="text-[#22c55e] font-black flex items-center gap-1.5"><GreenCoin cls="w-4 h-4"/> {formatValue(saldoVerde)}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 bg-[#14171f]/80 backdrop-blur-xl border border-[#222630] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
          
          {/* ==========================================
              PANEL IZQUIERDO (CONTROLES)
          ========================================== */}
          <div className="w-full md:w-[35%] flex flex-col gap-6">
            
            {/* Bet Amount */}
            <div className="bg-[#0b0e14] border border-[#222630] rounded-xl p-4 shadow-inner">
              <label className="text-[#7c8291] text-xs font-bold uppercase tracking-widest mb-2 block">Bet Amount</label>
              <div className="flex items-center bg-[#14171f] border border-[#222630] rounded-lg p-2 focus-within:border-[#22c55e] transition-colors">
                <GreenCoin cls="w-5 h-5 ml-2 mr-2"/>
                <input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={gameState === 'playing'}
                  className="w-full bg-transparent text-white font-bold outline-none"
                />
                <div className="flex gap-1 ml-2">
                  <button onClick={() => setBetAmount(Math.floor(betAmount / 2))} disabled={gameState === 'playing'} className="bg-[#222630] hover:bg-[#3f4354] text-[#7c8291] hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors">1/2</button>
                  <button onClick={() => setBetAmount(betAmount * 2)} disabled={gameState === 'playing'} className="bg-[#222630] hover:bg-[#3f4354] text-[#7c8291] hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors">2x</button>
                </div>
              </div>
            </div>

            {/* Mines Count */}
            <div className="bg-[#0b0e14] border border-[#222630] rounded-xl p-4 shadow-inner">
              <label className="text-[#7c8291] text-xs font-bold uppercase tracking-widest mb-2 block">Mines</label>
              <select 
                value={minesCount} 
                onChange={(e) => setMinesCount(Number(e.target.value))}
                disabled={gameState === 'playing'}
                className="w-full bg-[#14171f] border border-[#222630] text-white font-bold p-3 rounded-lg outline-none cursor-pointer focus:border-[#ef4444] transition-colors appearance-none"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} {i+1 === 1 ? 'Mine' : 'Mines'}</option>
                ))}
              </select>
            </div>

            {/* Status / Multiplier Info */}
            <div className="flex gap-2">
              <div className="flex-1 bg-[#0b0e14] border border-[#222630] rounded-xl p-3 flex flex-col items-center justify-center">
                <span className="text-[#7c8291] text-[10px] font-bold uppercase tracking-widest">Multiplier</span>
                <span className="text-white font-black text-lg">{currentMultiplier}x</span>
              </div>
              <div className="flex-1 bg-[#0b0e14] border border-[#222630] rounded-xl p-3 flex flex-col items-center justify-center">
                <span className="text-[#7c8291] text-[10px] font-bold uppercase tracking-widest">Next Tile</span>
                <span className="text-[#22c55e] font-black text-lg">{nextMultiplier}x</span>
              </div>
            </div>

            {/* Action Button */}
            {gameState === 'playing' ? (
              <button 
                onClick={() => handleCashout()}
                className="animate-shine w-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] hover:to-[#22c55e] text-[#0b0e14] font-black py-4 rounded-xl text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] hover:-translate-y-1 mt-auto flex flex-col items-center"
              >
                <span>CASHOUT</span>
                <span className="text-xs mt-0.5 flex items-center gap-1"><GreenCoin cls="w-3 h-3"/> {formatValue(potentialWin)}</span>
              </button>
            ) : (
              <button 
                onClick={startGame}
                className="animate-shine w-full bg-gradient-to-r from-[#facc15] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0b0e14] font-black py-4 rounded-xl text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:-translate-y-1 mt-auto"
              >
                BET
              </button>
            )}

            {/* Feedback Alerts */}
            {gameState === 'busted' && <div className="text-center text-[#ef4444] font-black animate-bounce tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">BUSTED! 💥</div>}
            {gameState === 'cashed_out' && <div className="text-center text-[#22c55e] font-black animate-bounce tracking-widest drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">CASHED OUT! 💎</div>}

          </div>

          {/* ==========================================
              PANEL DERECHO (GRID 5x5)
          ========================================== */}
          <div className="w-full md:w-[65%] flex items-center justify-center bg-[#0b0e14] border border-[#222630] rounded-2xl p-4 md:p-8 shadow-inner relative overflow-hidden">
            
            {/* Ambient Glow */}
            {gameState === 'playing' && <div className="absolute inset-0 bg-[#22c55e] opacity-5 blur-[100px] pointer-events-none transition-opacity duration-1000"></div>}
            {gameState === 'busted' && <div className="absolute inset-0 bg-[#ef4444] opacity-10 blur-[100px] pointer-events-none animate-pulse"></div>}

            <div className="grid grid-cols-5 gap-2 md:gap-3 w-full aspect-square max-w-[500px] z-10">
              {grid.map((tile, index) => {
                
                // Determinar el estilo basado en el estado
                let tileClass = "bg-[#1a1e29] border-b-4 border-[#14171f] hover:bg-[#222630] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg";
                let content = null;

                if (tile.revealed) {
                  if (tile.isMine) {
                    // MINA
                    tileClass = `bg-[#ef4444]/20 border border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.4)] ${gameState === 'busted' ? 'animate-pop-in' : 'opacity-50'}`;
                    content = <span className="text-3xl md:text-5xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">💣</span>;
                  } else {
                    // DIAMANTE SEGURO
                    tileClass = `bg-[#22c55e]/10 border border-[#22c55e]/50 shadow-[0_0_15px_rgba(34,197,94,0.2)] animate-pop-in`;
                    content = <span className="text-3xl md:text-5xl drop-shadow-[0_0_15px_rgba(34,197,94,0.8)] floating">💎</span>;
                  }
                } else if (gameState !== 'playing') {
                  // Bloquear hover si no estás jugando
                  tileClass = "bg-[#1a1e29] opacity-80 cursor-default";
                }

                return (
                  <div 
                    key={index}
                    onClick={() => handleTileClick(index)}
                    className={`rounded-xl flex items-center justify-center relative overflow-hidden ${tileClass}`}
                  >
                    {/* Efecto de cristal oscuro sobre los botones sin revelar */}
                    {!tile.revealed && <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>}
                    
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
        .animate-pop-in { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .floating { animation: float 2.5s ease-in-out infinite; }
        
        .animate-shine { position: relative; overflow: hidden; }
        .animate-shine::before { 
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; 
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent); 
          transform: skewX(-20deg); animation: shine 3s infinite; 
        }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0); }
          20%, 80% { transform: translate3d(4px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
          40%, 60% { transform: translate3d(6px, 0, 0); }
        }
      `}} />
    </div>
  );
}