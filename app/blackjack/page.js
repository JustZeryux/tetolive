"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// === LÓGICA DEL MAZO ===
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

const createDeck = () => {
  let deck = [];
  for (let s of SUITS) {
    for (let v of VALUES) {
      deck.push({ suit: s, val: v, color: (s === '♥' || s === '♦') ? 'text-red-500' : 'text-gray-800' });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const calculateScore = (hand) => {
  let value = 0;
  let aces = 0;
  hand.forEach(card => {
    if (['J','Q','K'].includes(card.val)) value += 10;
    else if (card.val === 'A') { value += 11; aces += 1; }
    else value += parseInt(card.val);
  });
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
};

// === COMPONENTE DE CARTA VISUAL ===
const PlayingCard = ({ card, hidden = false, index }) => {
  if (hidden) {
    return (
      <div className={`w-20 h-28 sm:w-24 sm:h-36 rounded-xl border-2 border-[#252839] bg-[repeating-linear-gradient(45deg,#1c1f2e,#1c1f2e_10px,#14151f_10px,#14151f_20px)] shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center justify-center animate-slide-in relative -ml-8 first:ml-0`} style={{animationDelay: `${index * 150}ms`, zIndex: index}}>
        <div className="w-12 h-12 rounded-full border border-[#252839] bg-[#0b0e14] flex items-center justify-center opacity-50">
          <span className="text-xl">🃏</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`w-20 h-28 sm:w-24 sm:h-36 bg-gradient-to-br from-white to-gray-200 rounded-xl border border-gray-300 shadow-[0_5px_15px_rgba(0,0,0,0.6)] flex flex-col justify-between p-2 animate-slide-in relative -ml-8 first:ml-0`} style={{animationDelay: `${index * 150}ms`, zIndex: index}}>
      <div className={`text-lg sm:text-xl font-black ${card.color} leading-none`}>{card.val}</div>
      <div className={`text-3xl sm:text-4xl text-center self-center ${card.color} drop-shadow-sm`}>{card.suit}</div>
      <div className={`text-lg sm:text-xl font-black ${card.color} leading-none rotate-180 self-end`}>{card.val}</div>
    </div>
  );
};

export default function BlackjackPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Estados del Juego
  const [currency, setCurrency] = useState('verde'); // 'verde' | 'rojo'
  const [betAmount, setBetAmount] = useState(10);
  const [gameState, setGameState] = useState('betting'); // betting, playing, dealerTurn, gameOver
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null); // 'player', 'dealer', 'tie'

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(data);
      }
      setCargando(false);
    };
    fetchUser();
  }, []);

  const saldoActual = currency === 'verde' ? (userProfile?.saldo_verde || 0) : (userProfile?.saldo_rojo || 0);

  // === 1. INICIAR PARTIDA ===
  const startGame = async () => {
    if (!currentUser) return alert("Inicia sesión para jugar.");
    if (betAmount <= 0) return alert("Apuesta algo válido, wey.");
    if (betAmount > saldoActual) return alert(`No tienes suficiente Saldo ${currency === 'verde' ? 'Verde' : 'Rojo'}.`);

    setProcesando(true);
    try {
      // Cobrar la apuesta
      const columna = currency === 'verde' ? 'saldo_verde' : 'saldo_rojo';
      const nuevoSaldo = saldoActual - betAmount;
      
      const { error } = await supabase.from('profiles').update({ [columna]: nuevoSaldo }).eq('id', currentUser.id);
      if (error) throw error;

      setUserProfile(prev => ({ ...prev, [columna]: nuevoSaldo }));

      // Repartir cartas
      const newDeck = createDeck();
      const pHand = [newDeck.pop(), newDeck.pop()];
      const dHand = [newDeck.pop(), newDeck.pop()];

      setDeck(newDeck);
      setPlayerHand(pHand);
      setDealerHand(dHand);
      setGameState('playing');
      setWinner(null);

      // Checar Blackjack Instantáneo
      if (calculateScore(pHand) === 21) {
        handleGameOver('player', pHand, dHand, true);
      }
    } catch (err) {
      console.error(err);
      alert("Error al procesar la apuesta.");
    }
    setProcesando(false);
  };

  // === 2. PEDIR CARTA (HIT) ===
  const hit = () => {
    if (gameState !== 'playing' || procesando) return;
    const newDeck = [...deck];
    const newHand = [...playerHand, newDeck.pop()];
    
    setPlayerHand(newHand);
    setDeck(newDeck);

    if (calculateScore(newHand) > 21) {
      handleGameOver('dealer', newHand, dealerHand);
    }
  };

  // === 3. PLANTARSE (STAND) -> TURNO DEL DEALER ===
  const stand = () => {
    if (gameState !== 'playing' || procesando) return;
    setGameState('dealerTurn');
    playDealerTurn(deck, dealerHand);
  };

  const playDealerTurn = (currentDeck, currentDealerHand) => {
    let dHand = [...currentDealerHand];
    let dDeck = [...currentDeck];
    
    // El dealer pide cartas hasta tener 17 o más
    while (calculateScore(dHand) < 17) {
      dHand.push(dDeck.pop());
    }

    setDealerHand(dHand);
    setDeck(dDeck);
    
    const pScore = calculateScore(playerHand);
    const dScore = calculateScore(dHand);

    if (dScore > 21 || pScore > dScore) {
      handleGameOver('player', playerHand, dHand);
    } else if (dScore > pScore) {
      handleGameOver('dealer', playerHand, dHand);
    } else {
      handleGameOver('tie', playerHand, dHand);
    }
  };

  // === 4. TERMINAR Y PAGAR ===
  const handleGameOver = async (result, pHand, dHand, isBlackjack = false) => {
    setGameState('gameOver');
    setWinner(result);
    setProcesando(true);

    try {
      const columna = currency === 'verde' ? 'saldo_verde' : 'saldo_rojo';
      let ganancia = 0;

      if (result === 'player') {
        ganancia = isBlackjack ? Math.floor(betAmount * 2.5) : betAmount * 2; // Paga 2.5x por Blackjack puro, 2x por ganar normal
      } else if (result === 'tie') {
        ganancia = betAmount; // Devuelve la apuesta
      }

      if (ganancia > 0) {
        const saldoRecuperado = (currency === 'verde' ? userProfile.saldo_verde : userProfile.saldo_rojo) + ganancia;
        const { error } = await supabase.from('profiles').update({ [columna]: saldoRecuperado }).eq('id', currentUser.id);
        if (error) throw error;
        setUserProfile(prev => ({ ...prev, [columna]: saldoRecuperado }));
      }
    } catch (err) {
      console.error("Error al pagar:", err);
    }
    setProcesando(false);
  };

  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Armando la mesa...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans overflow-hidden relative flex flex-col items-center">
      {/* Luces de Casino de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-b from-[#22c55e]/15 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="w-full max-w-[1200px] relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ================= PANEL DE APUESTAS (IZQUIERDA) ================= */}
        <div className="lg:col-span-1 bg-[#14151f]/90 backdrop-blur-md border border-[#252839] rounded-3xl p-6 shadow-2xl flex flex-col h-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#6C63FF]/5 to-transparent pointer-events-none"></div>
          
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 text-center drop-shadow-md relative z-10">
            Blackjack 21
          </h2>

          <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 mb-6 shadow-inner relative z-10">
            <p className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-3">Moneda de Apuesta</p>
            <div className="flex bg-[#1c1f2e] p-1 rounded-lg">
              <button 
                disabled={gameState !== 'betting'}
                onClick={() => setCurrency('verde')}
                className={`flex-1 py-2 rounded-md font-black text-sm uppercase flex items-center justify-center gap-2 transition-all ${currency === 'verde' ? 'bg-[#22c55e]/20 border border-[#22c55e]/50 text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'text-[#555b82] hover:text-white'}`}
              >
                <GreenCoin /> Verde
              </button>
              <button 
                disabled={gameState !== 'betting'}
                onClick={() => setCurrency('rojo')}
                className={`flex-1 py-2 rounded-md font-black text-sm uppercase flex items-center justify-center gap-2 transition-all ${currency === 'rojo' ? 'bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-[#555b82] hover:text-white'}`}
              >
                <RedCoin /> Rojo
              </button>
            </div>
            <div className="mt-3 text-right">
              <span className="text-xs text-[#555b82] font-black uppercase">Saldo Disponible: </span>
              <span className="font-black text-white">{formatValue(saldoActual)}</span>
            </div>
          </div>

          <div className="mb-6 relative z-10">
            <label className="text-[#8f9ac6] font-bold uppercase text-xs tracking-wider mb-2 block">Monto de Apuesta</label>
            <div className={`flex bg-[#0b0e14] border rounded-xl overflow-hidden transition-all ${currency === 'verde' ? 'focus-within:border-[#22c55e] focus-within:shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'focus-within:border-[#ef4444] focus-within:shadow-[0_0_15px_rgba(239,68,68,0.2)]'} border-[#252839]`}>
              <div className="pl-4 flex items-center justify-center bg-[#1c1f2e] border-r border-[#252839]">
                {currency === 'verde' ? <GreenCoin cls="w-5 h-5"/> : <RedCoin cls="w-5 h-5"/>}
              </div>
              <input 
                type="number" 
                disabled={gameState !== 'betting' || procesando}
                value={betAmount} 
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="w-full bg-transparent text-white font-bold p-3 outline-none"
              />
              <button onClick={() => setBetAmount(prev => Math.max(1, Math.floor(prev / 2)))} disabled={gameState !== 'betting'} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">1/2</button>
              <button onClick={() => setBetAmount(prev => prev * 2)} disabled={gameState !== 'betting'} className="px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-bold text-xs transition-colors">2x</button>
              <button onClick={() => setBetAmount(saldoActual)} disabled={gameState !== 'betting'} className={`px-4 bg-[#1c1f2e] hover:bg-[#252839] border-l border-[#252839] font-black text-xs transition-colors ${currency === 'verde' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>MAX</button>
            </div>
          </div>

          <div className="mt-auto relative z-10">
            {gameState === 'betting' ? (
              <button 
                onClick={startGame}
                disabled={procesando}
                className={`w-full py-5 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest transition-all ${procesando ? 'bg-gray-600 opacity-50' : currency === 'verde' ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105' : 'bg-gradient-to-r from-[#ef4444] to-[#b91c1c] shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105'}`}
              >
                {procesando ? 'Apostando...' : 'Repartir'}
              </button>
            ) : gameState === 'playing' ? (
              <div className="grid grid-cols-2 gap-4">
                <button onClick={hit} disabled={procesando} className="py-4 bg-[#252839] hover:bg-[#2F3347] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md hover:-translate-y-1 transition-all">
                  Pedir (Hit)
                </button>
                <button onClick={stand} disabled={procesando} className="py-4 bg-gradient-to-r from-[#6C63FF] to-[#5147D9] rounded-xl font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(108,99,255,0.4)] hover:-translate-y-1 transition-all">
                  Plantar (Stand)
                </button>
              </div>
            ) : (
              <button onClick={() => {setGameState('betting'); setPlayerHand([]); setDealerHand([]);}} className="w-full py-4 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3b405a] rounded-xl font-black uppercase tracking-widest text-white shadow-md transition-all">
                Nueva Ronda
              </button>
            )}
          </div>
        </div>

        {/* ================= LA MESA VERDE (DERECHA) ================= */}
        <div className="lg:col-span-2 bg-gradient-to-b from-[#0f111a] to-[#14151f] border-2 border-[#252839] rounded-3xl p-6 md:p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col justify-between relative min-h-[500px] overflow-hidden">
          
          {/* Decoración de Mesa de Casino */}
          <div className="absolute inset-4 border-2 border-dashed border-[#22c55e]/20 rounded-2xl pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-9xl opacity-5 grayscale pointer-events-none">🃏</div>

          {/* AREA DEL DEALER */}
          <div className="relative z-10 w-full mb-8">
            <div className="flex justify-between items-end mb-4">
              <span className="px-4 py-1 bg-[#1c1f2e] border border-[#252839] rounded-full text-xs font-black uppercase tracking-widest text-[#8f9ac6]">
                Dealer {gameState === 'gameOver' && <span className="text-white ml-2">({calculateScore(dealerHand)})</span>}
              </span>
            </div>
            
            <div className="flex justify-center min-h-[144px]">
              {dealerHand.map((card, idx) => (
                <PlayingCard 
                  key={`dealer-${idx}`} 
                  card={card} 
                  index={idx}
                  hidden={idx === 1 && gameState === 'playing'} // Oculta la segunda carta del dealer mientras juegas
                />
              ))}
            </div>
          </div>

          {/* MENSAJE DE VICTORIA/DERROTA EN MEDIO */}
          <div className="relative z-20 h-20 flex items-center justify-center">
            {gameState === 'gameOver' && (
              <div className={`px-10 py-3 rounded-2xl border-2 backdrop-blur-md shadow-2xl animate-bounce-in ${winner === 'player' ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e] shadow-[0_0_30px_rgba(34,197,94,0.4)]' : winner === 'dealer' ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-gray-500/20 border-gray-400 text-gray-300'}`}>
                <h3 className="text-3xl font-black uppercase tracking-widest text-center">
                  {winner === 'player' ? '¡Ganaste!' : winner === 'dealer' ? 'Perdiste' : 'Empate'}
                </h3>
              </div>
            )}
          </div>

          {/* AREA DEL JUGADOR */}
          <div className="relative z-10 w-full mt-8">
            <div className="flex justify-center min-h-[144px] mb-4">
              {playerHand.map((card, idx) => (
                <PlayingCard key={`player-${idx}`} card={card} index={idx} />
              ))}
            </div>
            
            <div className="flex justify-center">
              <span className={`px-6 py-2 border rounded-full text-lg font-black uppercase tracking-widest transition-colors ${calculateScore(playerHand) > 21 ? 'bg-red-500/20 border-red-500 text-red-500' : calculateScore(playerHand) === 21 ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-[#1c1f2e] border-[#252839] text-white'}`}>
                Tú ({calculateScore(playerHand)})
              </span>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-slide-in { animation: slideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
        .animate-bounce-in { animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-50px) scale(0.8) rotate(-10deg); }
          to { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
