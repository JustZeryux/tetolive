"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

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
  const [sortBy, setSortBy] = useState('price_asc'); // price_asc, price_desc, name_asc

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

  useEffect(() => {
    const fetchData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setCurrentUser(userData.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
        setUserProfile(profile);
      }

      const { data: dbCases } = await supabase.from('cases').select('*');
      if (dbCases) {
        const formatCases = dbCases.map(c => ({
          id: c.id,
          name: c.name,
          price: c.price,
          img: c.image_url,
          color: c.color,
          shadow: c.shadow,
          items: c.items
        }));
        setCasesData(formatCases);
      }
      setCargando(false);
    };
    fetchData();
  }, []);

  const filteredAndSortedCases = useMemo(() => {
    let result = [...casesData];
    if (searchTerm) {
      result = result.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
    return result;
  }, [casesData, searchTerm, sortBy]);

  const getRandomVisualItem = (items) => {
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of items) {
      sum += item.chance;
      if (random <= sum) return item;
    }
    return items[0];
  };

  const openCase = async () => {
    if (!currentUser) return alert("Please log in to open cases.");
    if (spinning) return;

    // --- CHECK DE DINERO ---
    if (userProfile.saldo_verde < selectedCase.price) {
      setMoneyNeeded(selectedCase.price);
      setShowNoMoneyModal(true);
      return;
    }
    
    setView('opening');
    setSpinning(false);
    setOffset(0);

    // NOTA: Si en tu código real llamas a supabase.rpc() para sacar el ganador del backend, ponlo aquí.
    // Estoy usando tu lógica visual del commit para no romper la UI.
    const winner = getRandomVisualItem(selectedCase.items);

    // Actualizar saldo localmente
    setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - selectedCase.price}));
    setWinningItem(winner);

    // Rellenar array de la ruleta
    const track = Array.from({length: 55}, (_, i) => 
      i === WINNING_INDEX ? winner : selectedCase.items[Math.floor(Math.random() * selectedCase.items.length)]
    );

    setSpinnerItems(track);
    
    // Dejar que React renderice el array en posición 0 antes de aplicar la transición
    setTimeout(() => {
      setSpinning(true);
      // Offset aleatorio para que no frene exacto en el centro matemático
      const targetOffset = -(WINNING_INDEX * ITEM_WIDTH) + (Math.floor(Math.random() * 140) - 70);
      setOffset(targetOffset);
      
      setTimeout(() => { 
        setSpinning(false); 
        setView('result'); 
      }, 5500); // Duración de la animación
    }, 50);
  };

  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Cajas...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Luces Ambientales */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6C63FF]/15 to-transparent blur-[150px] pointer-events-none z-0"></div>
      
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

      <div className="max-w-[1200px] mx-auto relative z-10">

        {/* =========================================
            VISTA 1: TIENDA
        ========================================= */}
        {view === 'store' && (
          <div className="animate-fade-in">
            <div className="text-center mb-10 mt-4">
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#e0e5ff] to-[#8f9ac6] uppercase tracking-widest drop-shadow-[0_0_15px_rgba(108,99,255,0.4)] mb-3">
                Premium Cases
              </h1>
              <p className="text-[#8f9ac6] font-bold text-lg md:text-xl tracking-wide">Unbox the rarest and most exclusive items.</p>
            </div>

            {/* --- BARRA DE FILTROS --- */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-2xl p-4 mb-10 gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="relative w-full md:w-1/3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8f9ac6]">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search a case..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#6C63FF] focus:shadow-[0_0_15px_rgba(108,99,255,0.3)] transition-all font-semibold placeholder:text-[#4a506b]"
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-[#8f9ac6] font-bold uppercase text-sm tracking-wider">Sort By:</span>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#0b0e14] border border-[#252839] text-white rounded-xl py-3 px-4 focus:outline-none focus:border-[#6C63FF] font-semibold cursor-pointer outline-none w-full md:w-auto hover:bg-[#1a1e29] transition-colors"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>
            </div>

            {/* --- GRID DE CAJAS --- */}
            {filteredAndSortedCases.length === 0 ? (
              <div className="text-center py-20 text-[#8f9ac6] text-xl font-bold bg-[#14151f]/50 rounded-3xl border border-[#252839] border-dashed">
                😔 No cases found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {filteredAndSortedCases.map(caja => (
                  <div 
                    key={caja.id} onClick={() => { setSelectedCase(caja); setView('inspect'); }}
                    className="bg-[#14151f]/80 backdrop-blur-sm border border-[#252839] rounded-3xl p-6 flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:border-white/20 group relative overflow-hidden"
                    style={{ boxShadow: `0 10px 40px ${caja.shadow}`}}
                  >
                    <div className="absolute inset-0 opacity-10 transition-opacity duration-500 group-hover:opacity-30" style={{ background: `radial-gradient(circle at top, ${caja.color} 0%, transparent 70%)` }}></div>
                    
                    <div className="relative mb-6 mt-4 w-40 h-40 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500" style={{ backgroundColor: caja.color }}></div>
                      <img 
                        src={caja.img} 
                        alt={caja.name} 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500" 
                      />
                    </div>
                    
                    <h3 className="text-xl font-black text-white uppercase tracking-widest z-10 mb-4 text-center line-clamp-1 w-full">{caja.name}</h3>
                    
                    <button className="bg-[#0b0e14] border border-[#2F3347] group-hover:border-[#22c55e]/50 text-[#22c55e] px-6 py-3 rounded-xl text-lg font-black flex items-center justify-center gap-2 transition-all duration-300 z-10 w-full shadow-inner group-hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                      <GreenCoin cls="w-5 h-5"/> {formatValue(caja.price)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================
            VISTA 2: INSPECCIONAR CAJA
        ========================================= */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in">
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-8 bg-[#1c1f2e] px-5 py-2.5 rounded-xl border border-[#252839] w-max shadow-md">
               &lsaquo; Back to Store
            </button>
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              <div className="w-full lg:w-1/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-8 flex flex-col items-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${selectedCase.color} 0%, transparent 80%)` }}></div>
                
                <img src={selectedCase.img} className="w-48 h-48 object-contain mb-8 z-10 drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] animate-pulse-slow" alt={selectedCase.name} style={{filter: `drop-shadow(0 0 30px ${selectedCase.color}60)`}} />
                
                <h2 className="text-3xl font-black text-white uppercase tracking-widest z-10 mb-8 text-center">{selectedCase.name}</h2>
                <button onClick={openCase} className="w-full py-4 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all hover:-translate-y-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center justify-center gap-3 z-10">
                  OPEN FOR <GreenCoin cls="w-6 h-6"/> {formatValue(selectedCase.price)}
                </button>
              </div>

              <div className="w-full lg:w-2/3 bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-8 shadow-2xl">
                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 border-b border-[#252839] pb-4">
                  Case Contents
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCase.items.map((item, idx) => (
                    <div key={idx} className="bg-[#0b0e14] border rounded-xl p-4 flex flex-col items-center justify-center relative group transition-all hover:-translate-y-1 shadow-md" style={{ borderColor: `${item.color}50` }}>
                      <div className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-md bg-[#1c1f2e] text-white border border-[#252839] z-10 shadow-sm">
                        {item.chance}%
                      </div>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded-xl" style={{ backgroundColor: item.color }}></div>
                      <img src={item.img} className="w-20 h-20 object-contain mb-3 drop-shadow-lg group-hover:scale-110 transition-transform z-10" alt={item.name} />
                      <div className="w-full text-center mt-auto border-t border-[#252839] pt-3 z-10">
                        <p className="font-black text-sm uppercase tracking-wide w-full truncate" style={{color: item.color}}>{item.name}</p>
                        <p className="text-[#8f9ac6] text-xs font-bold mt-1 flex items-center justify-center gap-1"><GreenCoin cls="w-3 h-3"/> {formatValue(item.valor || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================
            VISTA 3: RULETA (EL DISEÑO QUE QUERÍAS CABRÓN)
        ========================================= */}
        {view === 'opening' && (
          <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] relative">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10">
              Unboxing...
            </h2>
            
            <div className="relative w-full max-w-[1000px] h-[240px] bg-[#0b0e14]/90 backdrop-blur-xl border-y-4 border-[#252839] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] rounded-2xl z-10 flex items-center">
              
              {/* LA TETO AQUÍ MERO */}
              <img 
                src="/teto.png" 
                alt="Teto Decoración" 
                className="absolute -right-8 -bottom-8 w-64 opacity-25 pointer-events-none drop-shadow-[0_0_20px_rgba(108,99,255,0.5)] z-0"
                onError={(e) => e.target.style.display = 'none'}
              />

              {/* Sombras laterales mamalonas para profundidad */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>

              {/* El rayo láser del centro */}
              <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-[#22c55e] z-30 shadow-[0_0_25px_rgba(34,197,94,1)] -translate-x-1/2"></div>
              
              {/* Brillo detrás del rayo para resaltar el item ganador */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[200px] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#22c55e]/10 to-transparent z-10 pointer-events-none"></div>

              {/* El slider que gira */}
              <div 
                className="absolute h-full flex items-center transition-transform"
                style={{ 
                  transform: `translateX(calc(50% ${offset ? `+ ${offset}px` : ''}))`, 
                  transitionDuration: spinning ? '5.5s' : '0s', 
                  transitionTimingFunction: 'cubic-bezier(0.1, 0.85, 0.15, 1)' 
                }}
              >
                {spinnerItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="w-[180px] h-[190px] shrink-0 border border-[#252839]/40 bg-[#14151f]/60 rounded-xl mx-1 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300" 
                    style={{
                      boxShadow: `inset 0 0 30px ${item.color}05`
                    }}
                  >
                    {/* Aura de fondo para la cartita */}
                    <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${item.color} 0%, transparent 60%)`}}></div>
                    
                    <img src={item.img} className="w-24 h-24 object-contain mb-3 drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] relative z-10" alt={item.name} />
                    
                    <div className="w-full text-center border-t border-[#252839]/50 pt-2 pb-1 relative z-10 bg-[#0b0e14]/40">
                      <p className="font-black text-sm uppercase tracking-wide w-full px-2 truncate" style={{color: item.color}}>{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 4: PANTALLA DE VICTORIA
        ========================================= */}
        {view === 'result' && winningItem && (
          <div className="w-full flex flex-col items-center justify-center min-h-[70vh] animate-bounce-in relative">
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at center, ${winningItem.color} 0%, transparent 60%)`}}></div>
            
            <h2 className="text-5xl font-black text-white uppercase tracking-widest mb-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.6)] z-10">Item Unboxed!</h2>
            
            <div className="bg-[#14151f]/90 backdrop-blur-xl border-2 rounded-3xl p-12 flex flex-col items-center max-w-md w-full shadow-[0_0_80px_rgba(0,0,0,0.8)] z-10 relative" style={{ borderColor: winningItem.color, boxShadow: `0 0 50px ${winningItem.color}40` }}>
              <div className="absolute -top-6 bg-[#0b0e14] px-6 py-2 border-2 rounded-full font-black uppercase tracking-widest shadow-lg" style={{ borderColor: winningItem.color, color: winningItem.color }}>
                NEW ADDITION
              </div>
              <img src={winningItem.img} className="w-56 h-56 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] mb-8 animate-pulse-slow" alt={winningItem.name} />
              
              <h3 className="text-3xl font-black uppercase text-center mb-2 tracking-widest" style={{ color: winningItem.color, textShadow: `0 0 20px ${winningItem.color}80` }}>
                {winningItem.name}
              </h3>
              <p className="text-[#8f9ac6] font-bold text-lg flex items-center gap-2 mb-10 bg-[#0b0e14] px-4 py-2 rounded-lg border border-[#252839]">
                Value: <GreenCoin cls="w-5 h-5"/> {formatValue(winningItem.valor || 0)}
              </p>
              <div className="flex gap-4 w-full">
                <button onClick={() => setView('store')} className="flex-1 bg-[#1c1f2e] hover:bg-[#252839] border border-[#2F3347] text-white px-6 py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-md">
                  Store
                </button>
                <button onClick={() => openCase()} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] border border-[#16a34a] px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                  Spin Again
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
      <style jsx global>{`
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
