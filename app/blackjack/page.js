"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" />;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" />;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

// --- LÓGICA DE CARTAS ---
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
  let value = 0; let aces = 0;
  hand.forEach(card => {
    if (['J','Q','K'].includes(card.val)) value += 10;
    else if (card.val === 'A') { value += 11; aces += 1; }
    else value += parseInt(card.val);
  });
  while (value > 21 && aces > 0) { value -= 10; aces -= 1; }
  return value;
};

export default function BlackjackPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userInventory, setUserInventory] = useState([]);
  const [allPets, setAllPets] = useState([]); // Base de datos de pets para el Dealer
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Estados del Juego
  const [currency, setCurrency] = useState('verde'); // 'verde' | 'rojo'
  const [betAmount, setBetAmount] = useState(10);
  const [selectedPets, setSelectedPets] = useState([]); // Pets que el usuario eligió
  const [dealerBetPets, setDealerBetPets] = useState([]); // Pets que la casa pone en respuesta
  
  const [gameState, setGameState] = useState('betting'); 
  const [deck, setDeck] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
        
        // Cargar Inventario para apuestas rojas
        const { data: inv } = await supabase.from('inventory').select(`id, items (*)`).eq('user_id', user.id);
        setUserInventory(inv?.map(i => ({ invId: i.id, ...i.items })) || []);
      }
      
      // Cargar base de datos de pets para que el Dealer pueda "apostar"
      const { data: petsDB } = await supabase.from('items').select('*');
      setAllPets(petsDB || []);
      
      setCargando(false);
    };
    fetchData();
  }, []);

  // --- LÓGICA DE SELECCIÓN DE PETS ---
  const togglePetSelection = (pet) => {
    if (gameState !== 'betting') return;
    
    let newSelection;
    if (selectedPets.find(p => p.invId === pet.invId)) {
      newSelection = selectedPets.filter(p => p.invId !== pet.invId);
    } else {
      newSelection = [...selectedPets, pet];
    }
    setSelectedPets(newSelection);

    // Calcular cuánto debe apostar el Dealer en respuesta
    // Por cada pet tuya, el dealer busca una de valor similar (+/- 10%)
    const dealerPets = newSelection.map(myPet => {
      const similarPets = allPets.filter(p => p.value >= myPet.value * 0.9 && p.value <= myPet.value * 1.1);
      return similarPets.length > 0 ? similarPets[Math.floor(Math.random() * similarPets.length)] : allPets[0];
    });
    setDealerBetPets(dealerPets);
  };

  const totalValueSelected = selectedPets.reduce((sum, p) => sum + p.value, 0);

  // --- INICIAR JUEGO ---
  const startGame = async () => {
    if (procesando) return;
    const finalBet = currency === 'verde' ? betAmount : totalValueSelected;
    
    if (finalBet <= 0) return alert("Selecciona pets o ingresa un monto.");
    if (currency === 'verde' && betAmount > userProfile.saldo_verde) return alert("Saldo insuficiente.");
    
    setProcesando(true);
    try {
      if (currency === 'verde') {
        const { error } = await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - betAmount }).eq('id', currentUser.id);
        if (error) throw error;
      } else {
        // Quitar las pets del inventario (Apuesta Roja)
        const ids = selectedPets.map(p => p.invId);
        const { error } = await supabase.from('inventory').delete().in('id', ids);
        if (error) throw error;
      }

      const newDeck = createDeck();
      const pHand = [newDeck.pop(), newDeck.pop()];
      const dHand = [newDeck.pop(), newDeck.pop()];

      setDeck(newDeck);
      setPlayerHand(pHand);
      setDealerHand(dHand);
      setGameState('playing');
      if (calculateScore(pHand) === 21) handleGameOver('player', pHand, dHand, true);
    } catch (e) { alert("Error al procesar apuesta."); }
    setProcesando(false);
  };

  const handleGameOver = async (res, pHand, dHand, isBJ = false) => {
    setGameState('gameOver');
    setWinner(res);
    setProcesando(true);

    try {
      if (res === 'player' || res === 'tie') {
        if (currency === 'verde') {
          const win = res === 'tie' ? betAmount : (isBJ ? Math.floor(betAmount * 2.5) : betAmount * 2);
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + win }).eq('id', currentUser.id);
        } else {
          // Devolver mis pets + las del dealer si gané
          const petsToGive = res === 'tie' ? selectedPets : [...selectedPets, ...dealerBetPets];
          for (let p of petsToGive) {
            await supabase.from('inventory').insert({ user_id: currentUser.id, item_id: p.id || p.itemId });
          }
        }
      }
    } catch (e) { console.error(e); }
    setProcesando(false);
  };

  // Pedir / Plantarse
  const hit = () => {
    const nDeck = [...deck]; const nHand = [...playerHand, nDeck.pop()];
    setPlayerHand(nHand); setDeck(nDeck);
    if (calculateScore(nHand) > 21) handleGameOver('dealer', nHand, dealerHand);
  };

  const stand = () => {
    setGameState('dealerTurn');
    let dHand = [...dealerHand]; let dDeck = [...deck];
    while (calculateScore(dHand) < 17) dHand.push(dDeck.pop());
    setDealerHand(dHand);
    const pS = calculateScore(playerHand); const dS = calculateScore(dHand);
    if (dS > 21 || pS > dS) handleGameOver('player', playerHand, dHand);
    else if (dS > pS) handleGameOver('dealer', playerHand, dHand);
    else handleGameOver('tie', playerHand, dHand);
  };

  if (cargando) return <div className="text-white text-center mt-20 animate-pulse font-black">CARGANDO MESA...</div>;

  return (
    <div className="min-h-screen bg-[#0b0e14] p-4 md:p-8 flex flex-col items-center">
      
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* PANEL IZQUIERDO: APUESTAS */}
        <div className="bg-[#14151f] border border-[#252839] rounded-3xl p-6 shadow-2xl">
          <h2 className="text-2xl font-black text-center mb-6 uppercase tracking-tighter italic text-[#f472b6]">Blackjack 21</h2>
          
          <div className="flex bg-[#0b0e14] p-1 rounded-xl mb-6">
            <button onClick={() => setCurrency('verde')} className={`flex-1 py-3 rounded-lg font-black text-xs uppercase transition-all ${currency === 'verde' ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/50' : 'text-[#4a506b]'}`}>Verde</button>
            <button onClick={() => setCurrency('rojo')} className={`flex-1 py-3 rounded-lg font-black text-xs uppercase transition-all ${currency === 'rojo' ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/50' : 'text-[#4a506b]'}`}>Pets (Rojo)</button>
          </div>

          {currency === 'verde' ? (
            <div className="mb-6">
               <label className="text-xs font-black text-[#4a506b] uppercase mb-2 block">Monto</label>
               <input type="number" value={betAmount} onChange={e=>setBetAmount(Number(e.target.value))} className="w-full bg-[#0b0e14] border border-[#252839] p-3 rounded-xl font-bold text-white outline-none focus:border-[#22c55e]"/>
            </div>
          ) : (
            <div className="mb-6">
              <label className="text-xs font-black text-[#4a506b] uppercase mb-2 block">Tu Inventario (Selecciona pets)</label>
              <div className="grid grid-cols-3 gap-2 h-48 overflow-y-auto custom-scrollbar bg-[#0b0e14] p-2 rounded-xl border border-[#252839]">
                {userInventory.map(pet => (
                  <div 
                    key={pet.invId} 
                    onClick={() => togglePetSelection(pet)}
                    className={`relative p-2 rounded-lg border-2 cursor-pointer transition-all ${selectedPets.find(p=>p.invId===pet.invId) ? 'border-[#ef4444] bg-[#ef4444]/10 scale-95' : 'border-[#252839] bg-[#14151f] hover:border-white/20'}`}
                  >
                    <img src={pet.image_url} className="w-full aspect-square object-contain" alt="pet"/>
                    <div className="text-[8px] font-black text-center mt-1 truncate">{pet.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={startGame} 
            disabled={gameState !== 'betting' || procesando}
            className={`w-full py-4 rounded-2xl font-black text-lg uppercase tracking-widest transition-all ${currency === 'verde' ? 'bg-[#22c55e] text-[#0b0e14]' : 'bg-[#ef4444] text-white'} hover:scale-105 active:scale-95 disabled:opacity-50`}
          >
            {gameState === 'betting' ? 'Repartir' : 'En Juego...'}
          </button>
        </div>

        {/* AREA DE JUEGO (MESA) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* DEALER AREA */}
          <div className="bg-[#14151f] border border-[#252839] rounded-3xl p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black uppercase text-[#4a506b]">Dealer {gameState !== 'playing' && `(${calculateScore(dealerHand)})`}</span>
              <div className="flex gap-1">
                {dealerBetPets.map((p, i) => (
                  <div key={i} className="w-8 h-8 rounded bg-[#0b0e14] border border-[#ef4444]/30 p-1" title={p.name}>
                    <img src={p.image_url} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-2">
              {dealerHand.map((c, i) => (
                <div key={i} className="w-20 h-28 bg-white rounded-lg flex flex-col justify-between p-2 shadow-xl">
                   {i === 1 && gameState === 'playing' ? <div className="w-full h-full bg-gray-300 rounded flex items-center justify-center text-2xl">?</div> : (
                     <>
                      <div className={`font-black ${c.color}`}>{c.val}</div>
                      <div className={`text-2xl self-center ${c.color}`}>{c.suit}</div>
                      <div className={`font-black self-end rotate-180 ${c.color}`}>{c.val}</div>
                     </>
                   )}
                </div>
              ))}
            </div>
          </div>

          {/* CONTROLES ACTION */}
          <div className="flex justify-center gap-4">
             {gameState === 'playing' && (
               <>
                 <button onClick={hit} className="px-10 py-4 bg-[#252839] rounded-2xl font-black uppercase hover:bg-[#2F3347]">Pedir</button>
                 <button onClick={stand} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase hover:bg-gray-200">Plantar</button>
               </>
             )}
             {gameState === 'gameOver' && (
               <div className={`text-3xl font-black uppercase animate-bounce ${winner === 'player' ? 'text-[#22c55e]' : winner === 'tie' ? 'text-gray-400' : 'text-[#ef4444]'}`}>
                 {winner === 'player' ? '¡Victoria!' : winner === 'tie' ? 'Empate' : 'Derrota'}
               </div>
             )}
          </div>

          {/* PLAYER AREA */}
          <div className="bg-[#14151f] border border-[#252839] rounded-3xl p-6 relative">
             <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase text-[#4a506b]">Tú ({calculateScore(playerHand)})</span>
                <div className="flex gap-1">
                  {selectedPets.map((p, i) => (
                    <div key={i} className="w-10 h-10 rounded-lg bg-[#0b0e14] border border-[#ef4444] p-1 animate-pulse">
                      <img src={p.image_url} className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>
             </div>
             <div className="flex justify-center gap-2">
                {playerHand.map((c, i) => (
                  <div key={i} className="w-20 h-28 bg-white rounded-lg flex flex-col justify-between p-2 shadow-xl animate-slide-up">
                    <div className={`font-black ${c.color}`}>{c.val}</div>
                    <div className={`text-2xl self-center ${c.color}`}>{c.suit}</div>
                    <div className={`font-black self-end rotate-180 ${c.color}`}>{c.val}</div>
                  </div>
                ))}
             </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
