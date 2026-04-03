"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Visual Components
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

const playAudio = (src, vol = 0.5) => {
    try {
        const audio = new Audio(src);
        audio.volume = vol;
        audio.play().catch(() => {});
    } catch (e) {}
};

export default function MinesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingDb, setIsProcessingDb] = useState(false); 

  // === GAME STATES ===
  const [betAmount, setBetAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); 
  
  const [minesLocation, setMinesLocation] = useState([]);
  const [revealedTiles, setRevealedTiles] = useState([]);
  const [multiplier, setMultiplier] = useState(1.00);
  const [isExploding, setIsExploding] = useState(false); // For screen shake

  // === INITIAL LOAD ===
  useEffect(() => {
    const fetchData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setCurrentUser(userData.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
        setUserProfile(profile);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const calculateMultiplier = (mines, hits) => {
    if (hits === 0) return 1.00;
    let mult = 1.0;
    for (let i = 0; i < hits; i++) {
      mult *= (25 - i) / (25 - mines - i);
    }
    
    // --- DYNAMIC HOUSE EDGE NERF SYSTEM ---
    let houseEdge = 0.90; // Base 10% retention

    // Drastic penalty for high mine counts
    if (mines >= 10 && mines <= 19) {
      houseEdge = 0.80; // Retains 20%
    } else if (mines >= 20) {
      houseEdge = 0.65; // Retains 35% (Massive nerf for 23/24 mines)
    }

    // Progressive penalty for consecutive hits
    houseEdge -= (hits * 0.01); 

    let finalMultiplier = parseFloat((mult * houseEdge).toFixed(2));
    return finalMultiplier <= 1.00 ? 1.01 : finalMultiplier;
  };

  // === START GAME ===
  const startGame = async () => {
    if (!currentUser || !userProfile) return alert("Please log in to play.");
    if (betAmount <= 0) return alert("Bet amount must be greater than 0.");
    if (betAmount > userProfile.saldo_verde) return alert("Insufficient balance.");
    if (mineCount < 1 || mineCount > 24) return alert("Mines must be between 1 and 24.");

    setIsProcessingDb(true);

    try {
      const newBalance = userProfile.saldo_verde - betAmount;
      
      const { error } = await supabase
        .from('profiles')
        .update({ saldo_verde: newBalance })
        .eq('id', currentUser.id);

      if (error) throw error;

      setUserProfile(prev => ({ ...prev, saldo_verde: newBalance }));

      // Generate board
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
      setIsExploding(false);
      
      playAudio('/sounds/click.mp3', 0.3); // Subtle start sound
    } catch (err) {
      console.error(err);
      alert("Error processing bet in the database.");
    } finally {
      setIsProcessingDb(false);
    }
  };

  // === TILE CLICKS ===
  const handleTileClick = (index) => {
    if (!isPlaying || isGameOver || revealedTiles.includes(index) || isProcessingDb) return;

    const newRevealed = [...revealedTiles, index];
    setRevealedTiles(newRevealed);

    if (minesLocation.includes(index)) {
      // BOOM! 
      playAudio('/sounds/bang.mp3', 0.6);
      setIsExploding(true);
      setTimeout(() => setIsExploding(false), 500); // Stop shaking after 500ms
      
      // Red flashbang
      const flash = document.createElement('div');
      flash.className = "fixed inset-0 bg-red-500 z-[999] opacity-0 transition-opacity duration-300 pointer-events-none mix-blend-overlay";
      document.body.appendChild(flash);
      setTimeout(() => flash.style.opacity = "0.5", 10);
      setTimeout(() => {
        flash.style.opacity = "0";
        setTimeout(() => flash.remove(), 300);
      }, 200);

      setIsPlaying(false);
      setIsGameOver(true);
      setGameResult('lose');
    } else {
      // GEM! 
      playAudio('/sounds/click.mp3', 0.6);
      const hits = newRevealed.length;
      const newMult = calculateMultiplier(mineCount, hits);
      setMultiplier(newMult);

      // Perfect clear
      if (hits === 25 - mineCount) {
        cashout(newMult);
      }
    }
  };

  // === CASHOUT ===
  const cashout = async (finalMultiplier = multiplier) => {
    if (!isPlaying || isGameOver || revealedTiles.length === 0 || isProcessingDb) return;

    setIsProcessingDb(true);
    const winAmount = Math.floor(betAmount * finalMultiplier);
    
    try {
      const newBalance = userProfile.saldo_verde + winAmount;

      const { error } = await supabase
        .from('profiles')
        .update({ saldo_verde: newBalance })
        .eq('id', currentUser.id);

      if (error) throw error;

      setUserProfile(prev => ({ ...prev, saldo_verde: newBalance }));

      playAudio('/sounds/win.mp3', 0.8);

      setIsPlaying(false);
      setIsGameOver(true);
      setGameResult('win');
    } catch (err) {
      console.error(err);
      alert("Error saving your winnings.");
    } finally {
      setIsProcessingDb(false);
    }
  };

  const nextMultiplier = isPlaying ? calculateMultiplier(mineCount, revealedTiles.length + 1) : multiplier;

  if (isLoading) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#22c55e]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Loading Mines...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#22c55e]/10 to-transparent blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col lg:flex-row gap-8">
        
        {/* === CONTROLS (LEFT) === */}
        <div className="w-full lg:w-1/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-8 text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              Mines
            </h2>

            <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 mb-6 flex justify-between items-center shadow-inner">
              <span className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider">Your Balance</span>
              <span className="font-black text-lg text-white flex items-center gap-2">
                <GreenCoin /> {formatValue(userProfile?.saldo_verde || 0)}
              </span>
            </div>

            <div className="mb-6">
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Bet Amount</label>
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
              <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Mines (1-24)</label>
              <select 
                disabled={isPlaying || isProcessingDb}
                value={mineCount} 
                onChange={(e) => setMineCount(Number(e.target.value))}
                className="w-full bg-[#0b0e14] border border-[#252839] text-white font-bold p-4 rounded-xl outline-none focus:border-[#22c55e] cursor-pointer appearance-none transition-all"
              >
                {[...Array(24)].map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1} Mines</option>
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
              {isProcessingDb ? 'CONNECTING...' : 'BET'}
            </button>
          ) : (
            <button 
              onClick={() => cashout(multiplier)}
              disabled={isProcessingDb}
              className={`w-full py-5 rounded-2xl font-black text-xl text-white uppercase tracking-widest flex flex-col items-center justify-center leading-tight transition-all ${isProcessingDb ? 'bg-gray-600 opacity-50 cursor-wait' : 'bg-gradient-to-r from-[#eab308] to-[#ca8a04] hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)]'}`}
            >
              <span>{isProcessingDb ? 'CASHING OUT...' : 'CASHOUT'}</span>
              {!isProcessingDb && <span className="text-sm opacity-90 flex items-center gap-1 mt-1"><GreenCoin cls="w-4 h-4"/> {Math.floor(betAmount * multiplier).toLocaleString()}</span>}
            </button>
          )}
        </div>

        {/* === GAME BOARD (RIGHT) === */}
        <div className={`w-full lg:w-2/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 lg:p-10 shadow-2xl flex flex-col items-center justify-center relative min-h-[500px] transition-transform duration-75 ${isExploding ? 'animate-shake border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)]' : ''}`}>
          
          <img 
            src="/teto.png" 
            alt="Teto" 
            className="absolute left-10 bottom-10 w-72 opacity-[0.08] pointer-events-none drop-shadow-[0_0_20px_rgba(34,197,94,0.5)] z-0 animate-float"
            onError={(e) => e.target.style.display = 'none'}
          />

          <div className="w-full flex justify-between items-end mb-8 relative z-10">
            <div>
              <p className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-1">Current Multiplier</p>
              <div className="flex items-baseline gap-3">
                 <p className="text-4xl font-black text-[#22c55e] drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">{multiplier.toFixed(2)}x</p>
                 {isPlaying && revealedTiles.length > 0 && (
                    <p className="text-[#555b82] text-sm font-bold uppercase tracking-widest hidden sm:block">Next: {nextMultiplier.toFixed(2)}x</p>
                 )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-1">Potential Win</p>
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
                  // Bomb Tile Styling
                  bgClass = isRevealed 
                    ? "bg-red-500/20 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.6)] z-10 scale-105" 
                    : "bg-red-500/5 border-red-500/30 opacity-40 grayscale";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_15px_rgba(239,68,68,1)] animate-bounce-in">💣</span>;
                } else {
                  // Gem Tile Styling
                  bgClass = isRevealed 
                    ? "bg-[#22c55e]/20 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.4)] z-10" 
                    : "bg-[#22c55e]/5 border-[#22c55e]/30 opacity-40 grayscale";
                  content = <span className="text-3xl sm:text-4xl drop-shadow-[0_0_15px_rgba(34,197,94,1)] animate-bounce-in">💎</span>;
                }
              } else if (isPlaying) {
                // Unrevealed during play pulsing hover
                bgClass = "bg-[#252839] hover:bg-[#2F3347] border-[#3b405a] hover:border-[#6C63FF]/50 hover:shadow-[0_0_15px_rgba(108,99,255,0.2)]";
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
                <div className="bg-[#14151f] border-2 border-[#22c55e] p-8 rounded-3xl text-center shadow-[0_0_80px_rgba(34,197,94,0.5)] transform scale-110 animate-epic-reveal">
                  <div className="absolute inset-0 bg-[#22c55e] blur-[50px] opacity-20 animate-pulse rounded-full pointer-events-none"></div>
                  <h3 className="text-3xl font-black text-[#22c55e] uppercase tracking-widest mb-2 relative z-10 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">Cashout Successful!</h3>
                  <p className="text-xl font-bold text-white flex items-center justify-center gap-2 relative z-10 bg-[#0b0e14] px-6 py-2 rounded-xl border border-[#252839] mt-4">
                    You won <GreenCoin cls="w-6 h-6"/> {Math.floor(betAmount * multiplier).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            
            {isGameOver && gameResult === 'lose' && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl animate-fade-in">
                <div className="bg-[#14151f] border-2 border-red-500 p-8 rounded-3xl text-center shadow-[0_0_80px_rgba(239,68,68,0.5)] transform scale-110 animate-bounce-in">
                  <div className="absolute inset-0 bg-red-500 blur-[50px] opacity-20 animate-pulse rounded-full pointer-events-none"></div>
                  <h3 className="text-5xl font-black text-red-500 uppercase tracking-widest mb-2 relative z-10 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">BOOM!</h3>
                  <p className="text-lg font-bold text-[#8f9ac6] relative z-10 uppercase tracking-widest">You hit a mine.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-float { animation: floatItem 6s ease-in-out infinite; }
        .animate-epic-reveal { animation: epicReveal 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }

        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-2px, 0, 0) rotate(-1deg); }
          20%, 80% { transform: translate3d(4px, 0, 0) rotate(1deg); }
          30%, 50%, 70% { transform: translate3d(-6px, 0, 0) rotate(-2deg); }
          40%, 60% { transform: translate3d(6px, 0, 0) rotate(2deg); }
        }
        @keyframes floatItem { 
          0%, 100% { transform: translateY(0px); } 
          50% { transform: translateY(-15px); } 
        }
        @keyframes epicReveal {
          0% { opacity: 0; transform: scale(0.5); filter: brightness(2); }
          70% { transform: scale(1.15); filter: brightness(1.2); }
          100% { opacity: 1; transform: scale(1.1); filter: brightness(1); }
        }
      `}</style>
    </div>
  );
}
