"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G"/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

export default function CasesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [casesData, setCasesData] = useState([]); 
  const [cargando, setCargando] = useState(true);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price_asc');

  // Vistas
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Modal de Dinero Insuficiente
  const [showNoMoneyModal, setShowNoMoneyModal] = useState(false);
  const [moneyNeeded, setMoneyNeeded] = useState(0);

  // Ruleta
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [winningItem, setWinningItem] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);

  const ITEM_WIDTH = 180; 
  const WINNING_INDEX = 40; 

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      // Aquí usamos tu variable saldo_verde real
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);
    }

    const { data: dbCases } = await supabase.from('cases').select('*');
    if (dbCases) {
      setCasesData(dbCases.map(c => ({
        id: c.id, name: c.name, price: c.price, img: c.image_url,
        color: c.color, shadow: c.shadow, items: c.items
      })));
    }
    setCargando(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredAndSortedCases = useMemo(() => {
    let result = [...casesData];
    if (searchTerm) result = result.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return a.name.localeCompare(b.name);
    });
    return result;
  }, [casesData, searchTerm, sortBy]);

  // --- AQUI ESTA LA LOGICA DE LA RULETA BLINDADA (spinRoulette) ---
  const openCase = async () => {
    if (!currentUser) return alert("Please log in.");
    if (spinning) return;

    // 1. Comprobar si tiene dinero (saldo_verde)
    if (userProfile.saldo_verde < selectedCase.price) {
      setMoneyNeeded(selectedCase.price);
      setShowNoMoneyModal(true);
      return;
    }

    // 2. Preparamos la UI para empezar la apertura
    setView('opening');
    setSpinning(false);
    setOffset(0);

    // 3. El servidor decide QUÉ GANASTE REALMENTE y descuenta el saldo
    const { data: winner, error } = await supabase.rpc('abrir_caja', { 
        p_usuario_id: currentUser.id,
        p_case_id: selectedCase.id
    });

    if (error || winner?.error) {
        setView('inspect');
        return alert(winner?.error || "Error opening case.");
    }

    // 4. Actualizamos el saldo local para reflejar la compra de la caja
    setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - selectedCase.price}));
    setWinningItem(winner);

    // 5. LA MAGIA: Armamos un carril de 60 items aleatorios de relleno...
    const track = Array.from({length: 60}, () => 
      selectedCase.items[Math.floor(Math.random() * selectedCase.items.length)]
    );
    // ...Y forzamos que en la posición ganadora ESTÉ EL PREMIO REAL DE LA BD
    track[WINNING_INDEX] = winner;
    
    setSpinnerItems(track);
    setSpinning(true);
    
    // 6. Arrancamos la animación CSS de la ruleta
    setTimeout(() => {
      // Calculamos cuánto moverse para parar justo en el WINNING_INDEX
      // El "Math.random() * 140 - 70" es para que no pare en el pixel exacto del centro y se vea más realista
      const targetOffset = -(WINNING_INDEX * ITEM_WIDTH) + (Math.floor(Math.random() * 140) - 70);
      setOffset(targetOffset);
      
      // 7. Terminamos la animación después de 5 segundos
      setTimeout(() => { 
        setSpinning(false); 
        setView('result'); 
      }, 5000); 
    }, 100);
  };

  if (cargando) return <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center text-white">Cargando Cajas...</div>;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      
      {/* MODAL: NO MONEY */}
      {showNoMoneyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
          <div className="bg-[#1a1d29] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-bounce-in">
            <div className="flex justify-center mb-4 text-6xl">⚠️</div>
            <h2 className="text-2xl font-black text-center uppercase mb-2">Insufficient Balance</h2>
            <p className="text-[#8f9ac6] text-center mb-6">You don't have enough green coins to open this case.</p>
            
            <div className="bg-[#0b0e14] rounded-2xl p-4 mb-6 border border-[#252839]">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Your Balance:</span>
                <span className="font-bold text-white"><GreenCoin/> {userProfile?.saldo_verde.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-[#252839] pt-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Price:</span>
                <span className="font-bold text-red-400"><GreenCoin/> {moneyNeeded.toLocaleString()}</span>
              </div>
            </div>

            <button onClick={() => setShowNoMoneyModal(false)} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all uppercase tracking-widest shadow-lg">
              Got it, sorry ;-;
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        
        {view === 'store' && (
          <>
            <div className="text-center mb-12">
              <h1 className="text-6xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">Teto Cases</h1>
              <p className="text-[#6C63FF] font-black uppercase tracking-widest text-sm mt-2">Elite Drop System v2.0</p>
            </div>

            {/* Barra de Filtros */}
            <div className="flex flex-col md:flex-row gap-4 mb-12 bg-[#14151f] p-4 rounded-2xl border border-[#252839]">
              <input 
                type="text" placeholder="Search case..." 
                className="flex-1 bg-[#0b0e14] border border-[#252839] rounded-xl px-6 py-3 outline-none focus:border-[#6C63FF] transition-all"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select onChange={(e) => setSortBy(e.target.value)} className="bg-[#0b0e14] border border-[#252839] rounded-xl px-6 py-3 outline-none cursor-pointer">
                <option value="price_asc">Cheapest First</option>
                <option value="price_desc">Most Expensive</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredAndSortedCases.map(caja => (
                <div 
                  key={caja.id} 
                  onClick={() => { setSelectedCase(caja); setView('inspect'); }}
                  className="group relative bg-[#14151f] border border-[#252839] rounded-[2rem] p-6 cursor-pointer transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
                >
                  {/* Resplandor Dinámico */}
                  <div className="absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-10 transition-opacity duration-500" style={{ backgroundColor: caja.color }}></div>
                  
                  <div className="relative z-10">
                    <img src={caja.img} className="w-full aspect-square object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-500" />
                    <div className="mt-6 text-center">
                      <h3 className="text-xl font-black uppercase tracking-tight mb-4 group-hover:text-[#6C63FF] transition-colors">{caja.name}</h3>
                      <div className="inline-flex items-center gap-2 bg-[#0b0e14] px-6 py-3 rounded-2xl border border-[#252839] group-hover:border-[#22c55e]/50 transition-all">
                        <GreenCoin cls="w-5 h-5" />
                        <span className="font-black text-lg text-[#22c55e]">{formatValue(caja.price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Vista Abrir (Inspección) */}
        {view === 'inspect' && selectedCase && (
          <div className="max-w-5xl mx-auto">
            <button onClick={() => setView('store')} className="mb-8 font-black text-[#4a506b] hover:text-white transition-colors uppercase text-xs tracking-widest">← Return to Store</button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center">
                <img src={selectedCase.img} className="w-72 h-72 object-contain drop-shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-float" />
                <h2 className="text-4xl font-black uppercase mt-8">{selectedCase.name}</h2>
                <button onClick={openCase} className="mt-10 w-full max-w-sm py-5 bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] font-black text-2xl rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                  OPEN CASE
                </button>
              </div>
              <div className="bg-[#14151f] rounded-[2.5rem] p-8 border border-[#252839]">
                <h4 className="font-black uppercase tracking-widest text-[#4a506b] mb-6 text-sm">Potential Rewards</h4>
                <div className="grid grid-cols-3 gap-4">
                  {selectedCase.items.map((it, i) => (
                    <div key={i} className="flex flex-col items-center p-3 rounded-2xl bg-[#0b0e14] border border-[#252839] hover:border-white/10 transition-all">
                      <img src={it.img || it.image_url} className="w-16 h-16 object-contain" />
                      <span className="text-[10px] font-black mt-2 text-center leading-none uppercase" style={{color: it.color}}>{it.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA: RULETA */}
        {view === 'opening' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
             <div className="relative w-full max-w-5xl h-64 bg-[#0b0e14] border-y-2 border-[#252839] overflow-hidden rounded-3xl shadow-inner">
               <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[#6C63FF] z-30 shadow-[0_0_20px_#6C63FF]"></div>
               <div className="flex items-center h-full transition-transform" style={{ 
                  transform: `translateX(calc(50% ${offset ? `+ ${offset}px` : ''}))`, 
                  transitionDuration: spinning ? '5s' : '0s', 
                  transitionTimingFunction: 'cubic-bezier(0.1, 0.9, 0.1, 1)' 
                }}>
                 {spinnerItems.map((it, i) => (
                   <div key={i} className="w-[180px] h-full shrink-0 flex flex-col items-center justify-center border-r border-[#252839]/30" style={{background: `linear-gradient(to bottom, ${it.color}05, transparent)`}}>
                      <img src={it.img || it.image_url} className="w-24 h-24 object-contain" />
                      <div className="h-1 w-12 rounded-full mt-4" style={{backgroundColor: it.color}}></div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {/* VISTA: RESULTADO */}
        {view === 'result' && winningItem && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-bounce-in">
             <div className="bg-[#14151f] p-12 rounded-[3rem] border-4 flex flex-col items-center shadow-2xl" style={{borderColor: winningItem.color}}>
                <span className="font-black uppercase tracking-[0.3em] text-[#4a506b] mb-4">You Unboxed</span>
                <img src={winningItem.img || winningItem.image_url} className="w-64 h-64 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-8" />
                <h3 className="text-4xl font-black uppercase mb-10" style={{color: winningItem.color}}>{winningItem.name}</h3>
                <div className="flex gap-4">
                  <button onClick={() => setView('store')} className="px-10 py-4 bg-[#0b0e14] border border-[#252839] rounded-2xl font-black uppercase tracking-widest text-sm">Close</button>
                  <button onClick={openCase} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform">Spin Again</button>
                </div>
             </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
