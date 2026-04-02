"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// --- CONSTANTES GLOBALES (Esto arregla tu error de WINNING_INDEX) ---
const WINNING_INDEX = 45; 
const ITEM_WIDTH = 180;

// --- HELPERS ---
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// --- DATA DE CAJAS ---
// OJO: RECUERDA PONER LOS UUID REALES DE TU TABLA ITEMS EN 'item_id'
const CASES = [
  {
    id: 'starter', name: 'Starter Case', price: 50000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#34d399', shadow: 'rgba(52,211,153,0.3)',
    items: [
      { item_id: 'PON-TU-UUID-AQUI', name: 'Common Dog', img: 'https://cdn.bgsi.gg/items/giant-robot.png', valor: 10000, chance: 70, color: '#9ca3af' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Rare Cat', img: 'https://cdn.bgsi.gg/items/circus-monster.png', valor: 50000, chance: 25, color: '#3b82f6' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Epic Dragon', img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', valor: 250000, chance: 4.5, color: '#a855f7' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 0.5, color: '#facc15' },
    ]
  },
  {
    id: 'premium', name: 'Premium Case', price: 250000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#a855f7', shadow: 'rgba(168,85,247,0.3)',
    items: [
      { item_id: 'PON-TU-UUID-AQUI', name: 'Epic Dragon', img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', valor: 250000, chance: 60, color: '#a855f7' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Legendary Phoenix', img: 'https://cdn.bgsi.gg/items/silly-doggy-tophat.png', valor: 750000, chance: 30, color: '#ef4444' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 9, color: '#facc15' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Secret God', img: 'https://cdn.bgsi.gg/items/shiny-santa-slime.png', valor: 25000000, chance: 1, color: '#ec4899' },
    ]
  },
  {
    id: 'mythic', name: 'Mythic Case', price: 1000000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#facc15', shadow: 'rgba(250,204,21,0.3)',
    items: [
      { item_id: 'PON-TU-UUID-AQUI', name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 80, color: '#facc15' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Secret God', img: 'https://cdn.bgsi.gg/items/shiny-santa-slime.png', valor: 25000000, chance: 15, color: '#ec4899' },
      { item_id: 'PON-TU-UUID-AQUI', name: 'Ultimate Being', img: 'https://cdn.bgsi.gg/items/giant-robot.png', valor: 100000000, chance: 5, color: '#3AFF4E' },
    ]
  }
];

export default function CasesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Estados de Animación
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [winningItem, setWinningItem] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const initUser = async () => {
        const { data } = await supabase.auth.getUser();
        if (data?.user) setCurrentUser(data.user);
    };
    initUser();
  }, []);

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
    
    setView('opening');
    setSpinning(false);
    setOffset(0);

    // LLAMADA AL SERVIDOR
    const { data: winner, error } = await supabase.rpc('abrir_caja', { 
        p_usuario_id: currentUser.id,
        p_case_id: selectedCase.id,
        p_precio: selectedCase.price,
        p_items: selectedCase.items
    });

    if (error || winner?.error) {
        setView('inspect');
        return alert("Error: " + (winner?.error || "Fallo en la conexión. Revisa tu saldo."));
    }

    setWinningItem(winner);

    // Generar la cinta de la ruleta (llenamos 60 espacios)
    const track = [];
    for (let i = 0; i < 60; i++) {
      if (i === WINNING_INDEX) track.push(winner);
      else track.push(getRandomVisualItem(selectedCase.items));
    }
    
    setSpinnerItems(track);
    setSpinning(true);
    
    // Iniciar el giro con un ligero retraso para que React renderice la cinta
    setTimeout(() => {
      // Calculamos para que caiga exactamente dentro del ancho del item ganador
      const randomOffset = Math.floor(Math.random() * (ITEM_WIDTH - 20)) - (ITEM_WIDTH / 2 - 10);
      const targetOffset = -(WINNING_INDEX * ITEM_WIDTH) + randomOffset;
      setOffset(targetOffset);
      
      // Esperamos que termine la animación de CSS (5.5 segundos)
      setTimeout(() => {
        setSpinning(false);
        setView('result');
      }, 5500); 
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden">
      
      {/* --- DECORACIONES DE FONDO (Cyberpunk Grid & Glow) --- */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#252839 1px, transparent 1px), linear-gradient(90deg, #252839 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#6C63FF]/15 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* =========================================
            VISTA 1: TIENDA
        ========================================= */}
        {view === 'store' && (
          <div className="animate-fade-in">
            <div className="text-center mb-16 mt-6">
              <span className="bg-[#6C63FF]/20 text-[#6C63FF] border border-[#6C63FF]/50 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(108,99,255,0.4)] mb-4 inline-block">Official Store</span>
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#e2e8f0] to-[#8f9ac6] uppercase tracking-widest drop-shadow-lg mb-4">
                Premium Cases
              </h1>
              <p className="text-[#8f9ac6] font-bold text-lg max-w-xl mx-auto">Unbox the rarest and most exclusive pets in the TetoLive ecosystem.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {CASES.map(caja => (
                <div 
                  key={caja.id} onClick={() => { setSelectedCase(caja); setView('inspect'); }}
                  className="bg-gradient-to-b from-[#1c1f2e] to-[#141323] border border-[#252839] rounded-3xl p-8 flex flex-col items-center cursor-pointer transition-all duration-500 hover:-translate-y-4 group relative overflow-hidden"
                  style={{ boxShadow: `0 15px 50px ${caja.shadow}`}}
                >
                  {/* Glow Hover */}
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-30" style={{ background: `radial-gradient(circle at top center, ${caja.color} 0%, transparent 70%)` }}></div>
                  
                  {/* Rayos de luz decorativos */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                  <img src={caja.img} alt={caja.name} className="w-44 h-44 object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform duration-500 mb-8 z-10 animate-float" style={{filter: `drop-shadow(0 0 25px ${caja.color}60)`}} />
                  
                  <h3 className="text-2xl font-black text-white uppercase tracking-widest z-10 mb-4 drop-shadow-md">{caja.name}</h3>
                  <button className="bg-[#0b0e14]/80 backdrop-blur-md border border-[#2F3347] group-hover:border-white/20 text-[#22c55e] px-8 py-4 rounded-xl text-xl font-black flex items-center justify-center gap-2 transition-all duration-300 z-10 w-full shadow-inner group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                    <GreenCoin cls="w-6 h-6"/> {formatValue(caja.price)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 2: INSPECCIONAR CAJA
        ========================================= */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in">
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-8 bg-[#1c1f2e] px-5 py-3 rounded-xl border border-[#252839] w-max shadow-md hover:bg-[#252839]">
               &lsaquo; BACK TO STORE
            </button>

            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              {/* Panel Izq: Abrir Caja */}
              <div className="w-full lg:w-1/3 bg-gradient-to-b from-[#1c1f2e] to-[#0b0e14] border border-[#252839] rounded-3xl p-10 flex flex-col items-center relative overflow-hidden" style={{ boxShadow: `0 0 80px ${selectedCase.shadow}`}}>
                <div className="absolute inset-0 opacity-30 animate-pulse" style={{ background: `radial-gradient(circle at 50% 50%, ${selectedCase.color} 0%, transparent 70%)` }}></div>
                
                <img src={selectedCase.img} alt="case" className="w-64 h-64 object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.2)] mb-8 z-10 animate-float" style={{filter: `drop-shadow(0 0 40px ${selectedCase.color}80)`}} />
                
                <h2 className="text-4xl font-black text-white uppercase tracking-widest z-10 mb-8 text-center drop-shadow-lg">{selectedCase.name}</h2>
                
                <button onClick={openCase} disabled={spinning} className="w-full py-5 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.7)] transition-all hover:-translate-y-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center justify-center gap-3 z-10 disabled:opacity-50">
                  OPEN <span className="opacity-50">|</span> <GreenCoin cls="w-7 h-7"/> {formatValue(selectedCase.price)}
                </button>
              </div>

              {/* Panel Der: Posibles Premios */}
              <div className="w-full lg:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-3xl p-8 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#252839] pb-6 mb-6">
                    <h3 className="text-white text-xl font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="text-2xl">🎁</span> Box Contents
                    </h3>
                    <span className="text-[#8f9ac6] font-bold text-sm bg-[#141323] px-3 py-1 rounded-lg border border-[#2F3347]">{selectedCase.items.length} Items</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {selectedCase.items.sort((a,b) => b.valor - a.valor).map((item, i) => (
                    <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-2xl overflow-hidden flex flex-col relative group hover:border-[#4f567a] transition-all duration-300 h-52 hover:-translate-y-1 hover:shadow-lg">
                      
                      <div className="absolute top-0 left-0 w-full h-1.5" style={{backgroundColor: item.color}}></div>
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-15 transition-opacity" style={{ background: `radial-gradient(circle at center, ${item.color} 0%, transparent 80%)` }}></div>
                      
                      <div className="absolute top-3 right-3 bg-[#0b0e14]/90 backdrop-blur-md border border-[#252839] px-2 py-1 rounded text-[10px] font-black text-white z-20 shadow-md">
                        {item.chance}%
                      </div>

                      <div className="flex-1 p-4 flex items-center justify-center z-10 relative">
                        <img src={item.img} className="w-24 h-24 object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-300 relative z-10" alt={item.name}/>
                      </div>
                      
                      <div className="w-full text-center pb-4 z-10 bg-gradient-to-t from-[#1c1f2e] to-transparent pt-6">
                        <p className="text-[11px] font-black truncate px-2 mb-1 uppercase tracking-wider" style={{color: item.color}}>{item.name}</p>
                        <p className="text-white font-black text-sm flex items-center justify-center gap-1.5"><RedCoin cls="w-4 h-4"/> {formatValue(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================
            VISTA 3: RULETA GIRANDO (ÉPICA)
        ========================================= */}
        {view === 'opening' && (
          <div className="w-full flex flex-col items-center justify-center min-h-[65vh] animate-fade-in relative z-20">
            
            <div className="text-center mb-12">
               <span className="text-[#8f9ac6] font-bold uppercase tracking-widest text-sm bg-[#1c1f2e] border border-[#252839] px-4 py-1.5 rounded-full shadow-md">Opening {selectedCase?.name}</span>
               <h2 className="text-4xl font-black text-white uppercase tracking-widest mt-4 animate-pulse drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                 Rolling...
               </h2>
            </div>
            
            <div className={`w-full relative h-[260px] bg-[#0b0e14] border-y-4 border-[#252839] overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,1)] flex items-center transition-opacity duration-300 rounded-3xl ${spinning ? 'opacity-100' : 'opacity-0'}`}>
              
              {/* Sombras laterales extremas */}
              <div className="absolute left-0 top-0 w-1/4 h-full bg-gradient-to-r from-[#0b0e14] via-[#0b0e14]/80 to-transparent z-20 pointer-events-none"></div>
              <div className="absolute right-0 top-0 w-1/4 h-full bg-gradient-to-l from-[#0b0e14] via-[#0b0e14]/80 to-transparent z-20 pointer-events-none"></div>

              {/* Selector Central (Línea Amarilla Brillante) */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-[#facc15] -translate-x-1/2 z-30 shadow-[0_0_30px_#facc15,0_0_10px_#facc15]">
                 <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#facc15] rotate-45"></div>
                 <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#facc15] rotate-45"></div>
              </div>

              {/* Contenedor de la cinta */}
              <div className="absolute left-1/2 flex items-center h-full will-change-transform"
                   style={{
                     transform: `translateX(calc(-${ITEM_WIDTH/2}px + ${offset}px))`,
                     transition: spinning ? 'transform 5.5s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none'
                   }}
              >
                {spinnerItems.map((item, idx) => (
                  <div key={idx} style={{width: `${ITEM_WIDTH}px`}} className="h-[200px] flex-shrink-0 flex items-center justify-center px-2">
                    
                    <div className="w-full h-full bg-gradient-to-b from-[#1c1f2e] to-[#141323] border border-[#252839] rounded-2xl relative flex flex-col items-center justify-center shadow-xl overflow-hidden" style={{borderBottomColor: item.color, borderBottomWidth: '6px'}}>
                      <div className="absolute inset-0 opacity-15" style={{ background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 80%)` }}></div>
                      
                      <img src={item.img} className="w-24 h-24 object-contain mb-4 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] z-10" alt="pet"/>
                      
                      <div className="w-full text-center px-2 z-10 bg-[#0b0e14]/50 py-2 absolute bottom-0">
                         <p className="text-[10px] font-black truncate uppercase tracking-widest" style={{color: item.color}}>{item.name}</p>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 4: PANTALLA DE VICTORIA (LA MEJORADA)
        ========================================= */}
        {view === 'result' && winningItem && (
          <div className="w-full flex flex-col items-center justify-center min-h-[75vh] animate-scale-in relative z-20">
            
            {/* Sunburst Background Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none z-0 opacity-30 animate-spin-slow" style={{ background: `conic-gradient(from 0deg, transparent 0deg, ${winningItem.color} 20deg, transparent 40deg, ${winningItem.color} 60deg, transparent 80deg, ${winningItem.color} 100deg, transparent 120deg, ${winningItem.color} 140deg, transparent 160deg, ${winningItem.color} 180deg, transparent 200deg, ${winningItem.color} 220deg, transparent 240deg, ${winningItem.color} 260deg, transparent 280deg, ${winningItem.color} 300deg, transparent 320deg, ${winningItem.color} 340deg, transparent 360deg)` }}></div>

            <h2 className="text-6xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-[0_0_30px_rgba(255,255,255,0.6)] z-10">
              SUCCESS!
            </h2>
            <p className="text-[#8f9ac6] font-bold text-xl mb-12 z-10 bg-[#0b0e14]/80 px-6 py-2 rounded-full border border-[#252839]">Item added to your Vault</p>

            <div className="relative w-80 h-[420px] bg-gradient-to-b from-[#1c1f2e] to-[#0b0e14] border-4 rounded-3xl p-6 flex flex-col items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-float z-10 overflow-hidden" style={{borderColor: winningItem.color, boxShadow: `0 0 80px ${winningItem.color}60`}}>
              
              <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${winningItem.color} 0%, transparent 80%)` }}></div>
              <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>

              <div className="absolute top-4 right-4 bg-[#0b0e14]/80 border border-white/20 px-3 py-1 rounded-lg text-xs font-black text-white z-20 backdrop-blur-md">
                 {winningItem.chance}%
              </div>

              <img src={winningItem.img} className="w-56 h-56 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)] mb-8 z-10 hover:scale-110 transition-transform duration-500" alt="win" />
              
              <h3 className="text-3xl font-black text-center z-10 uppercase tracking-widest mb-4 drop-shadow-md" style={{color: winningItem.color}}>{winningItem.name}</h3>
              
              <div className="w-full bg-[#0b0e14]/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-[#252839] flex items-center justify-center gap-3 z-10 shadow-inner">
                 <RedCoin cls="w-8 h-8"/> 
                 <span className="text-white font-black text-3xl">{formatValue(winningItem.valor)}</span>
              </div>
            </div>

            <div className="flex gap-6 mt-16 z-10">
              <button onClick={() => setView('store')} className="px-12 py-4 rounded-xl font-bold text-[#8f9ac6] bg-[#1c1f2e] hover:bg-[#252839] hover:text-white border border-[#252839] transition-all uppercase tracking-widest shadow-lg">
                Back to Store
              </button>
              <button onClick={openCase} className="px-12 py-4 rounded-xl font-black text-[#0b0e14] uppercase tracking-widest shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_50px_rgba(34,197,94,0.7)] transition-all hover:-translate-y-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center gap-3">
                OPEN AGAIN <span className="opacity-80 font-bold bg-[#0b0e14]/20 px-3 py-1 rounded-lg text-sm flex items-center gap-1"><GreenCoin cls="w-4 h-4"/> {formatValue(selectedCase?.price)}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-float { animation: floatItem 4s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.8) translateY(20px); } 60% { transform: scale(1.05) translateY(-5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes floatItem { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
      `}} />
    </div>
  );
}
