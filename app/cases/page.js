"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Helpers
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function CasesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [casesData, setCasesData] = useState([]); // <-- Nuevo estado para las cajas
  const [cargando, setCargando] = useState(true);
  
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Estados de Animación
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [winningItem, setWinningItem] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);

  const ITEM_WIDTH = 180; 
  const WINNING_INDEX = 40; 

  useEffect(() => {
    const fetchData = async () => {
        // 1. Cargar usuario
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) setCurrentUser(userData.user);

        // 2. Cargar cajas desde la Base de Datos
        const { data: dbCases, error } = await supabase
          .from('cases')
          .select('*')
          .order('price', { ascending: true }); // Ordenar de más barata a más cara

        if (dbCases) {
          // Adaptamos los nombres de columnas de la BD a lo que usa tu HTML
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

    // LLAMADA AL SERVIDOR (Solo mandamos nuestro ID y qué caja queremos)
    const { data: winner, error } = await supabase.rpc('abrir_caja', { 
        p_usuario_id: currentUser.id,
        p_case_id: selectedCase.id
    });

    if (error || winner?.error) {
        setView('inspect');
        return alert("Error: " + (winner?.error || "Fallo en la conexión."));
    }

    setWinningItem(winner);

    // Generar la cinta
    const track = [];
    for (let i = 0; i < 55; i++) {
      if (i === WINNING_INDEX) track.push(winner);
      else track.push(getRandomVisualItem(selectedCase.items));
    }
    
    setSpinnerItems(track);
    setSpinning(true);
    
    setTimeout(() => {
      const randomOffset = Math.floor(Math.random() * (ITEM_WIDTH - 20)) - (ITEM_WIDTH / 2 - 10);
      const targetOffset = -(WINNING_INDEX * ITEM_WIDTH) + randomOffset;
      setOffset(targetOffset);
      
      setTimeout(() => {
        setSpinning(false);
        setView('result');
      }, 5000); 
    }, 100);
  };

  if (cargando) return <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex items-center justify-center text-white">Loading cases...</div>;
  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden">
      
      {/* Luces Ambientales */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* =========================================
            VISTA 1: TIENDA
        ========================================= */}
        {view === 'store' && (
          <div className="animate-fade-in">
            <div className="text-center mb-12 mt-4">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest drop-shadow-md mb-2">
                Premium Cases
              </h1>
              <p className="text-[#8f9ac6] font-bold text-lg">Unbox the rarest pets in the game.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              casesData.map(caja => (
                <div 
                  key={caja.id} onClick={() => { setSelectedCase(caja); setView('inspect'); }}
                  className="bg-[#1c1f2e] border border-[#252839] rounded-3xl p-8 flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-3 hover:shadow-2xl group relative overflow-hidden"
                  style={{ boxShadow: `0 10px 40px ${caja.shadow}`}}
                >
                  <div className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20" style={{ background: `radial-gradient(circle at top, ${caja.color} 0%, transparent 70%)` }}></div>
                  
                  <img src={caja.img} alt={caja.name} className="w-40 h-40 object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform duration-500 mb-8 z-10" style={{filter: `drop-shadow(0 0 20px ${caja.color}80)`}} />
                  
                  <h3 className="text-2xl font-black text-white uppercase tracking-widest z-10 mb-4">{caja.name}</h3>
                  <button className="bg-[#141323] border border-[#2F3347] group-hover:border-white/20 text-[#22c55e] px-8 py-3 rounded-xl text-xl font-black flex items-center gap-2 transition-colors z-10 w-full justify-center shadow-inner">
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
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-8 bg-[#1c1f2e] px-5 py-2.5 rounded-xl border border-[#252839] w-max">
               &lsaquo; Back to Store
            </button>

            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              {/* Panel Izq: Abrir Caja */}
              <div className="w-full lg:w-1/3 bg-[#1c1f2e] border border-[#252839] rounded-3xl p-10 flex flex-col items-center relative overflow-hidden shadow-2xl" style={{ boxShadow: `0 0 50px ${selectedCase.shadow}`}}>
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 50% 50%, ${selectedCase.color} 0%, transparent 70%)` }}></div>
                
                <img src={selectedCase.img} alt="case" className="w-56 h-56 object-contain drop-shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-8 z-10 animate-float" style={{filter: `drop-shadow(0 0 30px ${selectedCase.color}80)`}} />
                <h2 className="text-4xl font-black text-white uppercase tracking-widest z-10 mb-8 text-center">{selectedCase.name}</h2>
                
                <button onClick={openCase} className="w-full py-5 rounded-2xl font-black text-xl text-[#0b0e14] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all hover:-translate-y-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center justify-center gap-3 z-10">
                  OPEN FOR <GreenCoin cls="w-7 h-7"/> {formatValue(selectedCase.price)}
                </button>
              </div>

              {/* Panel Der: Posibles Premios */}
              <div className="w-full lg:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-3xl p-8">
                <h3 className="text-white text-lg font-black uppercase tracking-widest mb-6 border-b border-[#252839] pb-4">
                  Inside this case
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {selectedCase.items.sort((a,b) => b.valor - a.valor).map((item, i) => (
                    <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-2xl overflow-hidden flex flex-col relative group hover:border-[#3f4354] transition-colors h-48">
                      <div className="absolute top-0 left-0 w-full h-1.5" style={{backgroundColor: item.color}}></div>
                      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${item.color} 0%, transparent 80%)` }}></div>
                      
                      <div className="absolute top-2 right-2 bg-[#0b0e14]/80 backdrop-blur-sm border border-[#252839] px-2 py-1 rounded text-[10px] font-black text-white z-20">
                        {item.chance}%
                      </div>

                      <div className="flex-1 p-4 flex items-center justify-center z-10">
                        <img src={item.img} className="w-20 h-20 object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-300" alt={item.name}/>
                      </div>
                      <div className="w-full text-center pb-4 z-10 bg-[#1c1f2e] pt-3 border-t border-[#252839]">
                        <p className="text-[11px] font-bold truncate px-2 mb-1" style={{color: item.color}}>{item.name}</p>
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
            VISTA 3: RULETA GIRANDO
        ========================================= */}
        {view === 'opening' && (
          <div className="w-full flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-12 animate-pulse">
              {spinning ? `Unboxing ${selectedCase?.name}...` : 'Connecting...'}
            </h2>
            
            <div className={`w-full relative h-[240px] bg-[#141323] border-y-4 border-[#252839] overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.8)] flex items-center transition-opacity duration-300 ${spinning ? 'opacity-100' : 'opacity-0'}`}>
              
              <div className="absolute left-0 top-0 w-1/3 h-full bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>

              {/* Selector Central */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-[#facc15] -translate-x-1/2 z-30 shadow-[0_0_20px_#facc15]"></div>

              <div className="absolute left-1/2 flex items-center h-full will-change-transform"
                   style={{
                     transform: `translateX(calc(-${ITEM_WIDTH/2}px + ${offset}px))`,
                     transition: spinning ? 'transform 5s cubic-bezier(0.15, 0.85, 0.15, 1)' : 'none'
                   }}
              >
                {spinnerItems.map((item, idx) => (
                  <div key={idx} style={{width: `${ITEM_WIDTH}px`}} className="h-[180px] flex-shrink-0 flex items-center justify-center px-2">
                    <div className="w-full h-full bg-[#1c1f2e] border-2 border-[#252839] rounded-2xl relative flex flex-col items-center justify-center shadow-lg" style={{borderBottomColor: item.color, borderBottomWidth: '6px'}}>
                      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 70%)` }}></div>
                      <img src={item.img} className="w-20 h-20 object-contain mb-3 drop-shadow-md z-10" alt="pet"/>
                      <p className="text-xs font-bold text-center w-full px-2 truncate z-10" style={{color: item.color}}>{item.name}</p>
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
          <div className="w-full flex flex-col items-center justify-center min-h-[70vh] animate-scale-in">
            <h2 className="text-5xl font-black text-white uppercase tracking-widest mb-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              Item Unboxed!
            </h2>
            <p className="text-[#8f9ac6] font-bold text-lg mb-12">This pet has been added to your inventory.</p>

            <div className="relative w-72 h-96 bg-[#1c1f2e] border-2 rounded-3xl p-6 flex flex-col items-center justify-center shadow-[0_0_80px_rgba(0,0,0,0.6)] animate-float" style={{borderColor: winningItem.color, boxShadow: `0 0 60px ${winningItem.color}50`}}>
              <div className="absolute inset-0 opacity-20 pointer-events-none rounded-3xl" style={{ background: `radial-gradient(circle at center, ${winningItem.color} 0%, transparent 80%)` }}></div>
              <img src={winningItem.img} className="w-48 h-48 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)] mb-8 z-10" alt="win" />
              <h3 className="text-2xl font-black text-center z-10 uppercase tracking-widest mb-2" style={{color: winningItem.color}}>{winningItem.name}</h3>
              <p className="text-white font-black text-xl flex items-center gap-2 z-10 bg-[#0b0e14]/80 backdrop-blur-sm px-6 py-2 rounded-xl border border-[#252839]"><RedCoin cls="w-6 h-6"/> {formatValue(winningItem.valor)}</p>
            </div>

            <div className="flex gap-6 mt-16">
              <button onClick={() => setView('store')} className="px-10 py-4 rounded-xl font-bold text-[#8f9ac6] bg-[#1c1f2e] hover:bg-[#252839] border border-[#252839] transition-all uppercase tracking-widest">
                Back to Store
              </button>
              <button onClick={openCase} className="px-10 py-4 rounded-xl font-black text-[#0b0e14] uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all hover:-translate-y-1 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center gap-2">
                Open Again <span className="opacity-80 font-bold ml-1">({formatValue(selectedCase?.price)})</span>
              </button>
            </div>
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-float { animation: floatItem 4s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.8); } 50% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes floatItem { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      `}} />
    </div>
  );
}
