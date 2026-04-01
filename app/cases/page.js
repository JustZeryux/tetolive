"use client";
import { useState, useEffect, useRef } from 'react';

// --- HELPERS VISUALES ---
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// --- DATA DE EJEMPLO PARA LAS CAJAS ---
const CASES = [
  {
    id: 'starter',
    name: 'Starter Case',
    price: 50000,
    img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', // Caja generica
    color: '#34d399', // Verde
    items: [
      { name: 'Common Dog', img: 'https://cdn.bgsi.gg/items/giant-robot.png', valor: 10000, chance: 70, color: '#9ca3af' },
      { name: 'Rare Cat', img: 'https://cdn.bgsi.gg/items/circus-monster.png', valor: 50000, chance: 25, color: '#3b82f6' },
      { name: 'Epic Dragon', img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', valor: 250000, chance: 4.5, color: '#a855f7' },
      { name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 0.5, color: '#facc15' },
    ]
  },
  {
    id: 'premium',
    name: 'Premium Case',
    price: 500000,
    img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', 
    color: '#a855f7', // Morado
    items: [
      { name: 'Epic Dragon', img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', valor: 250000, chance: 60, color: '#a855f7' },
      { name: 'Legendary Phoenix', img: 'https://cdn.bgsi.gg/items/silly-doggy-tophat.png', valor: 750000, chance: 30, color: '#ef4444' },
      { name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 9, color: '#facc15' },
      { name: 'Secret God', img: 'https://cdn.bgsi.gg/items/shiny-santa-slime.png', valor: 25000000, chance: 1, color: '#ec4899' },
    ]
  },
  {
    id: 'mythic',
    name: 'Mythic Case',
    price: 2500000,
    img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', 
    color: '#facc15', // Dorado
    items: [
      { name: 'Mythic Titan', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', valor: 5000000, chance: 80, color: '#facc15' },
      { name: 'Secret God', img: 'https://cdn.bgsi.gg/items/shiny-santa-slime.png', valor: 25000000, chance: 15, color: '#ec4899' },
      { name: 'Ultimate Being', img: 'https://cdn.bgsi.gg/items/giant-robot.png', valor: 100000000, chance: 5, color: '#3AFF4E' },
    ]
  }
];

export default function BloxypotCases() {
  const [view, setView] = useState('store'); // 'store' | 'inspect' | 'opening' | 'result'
  const [selectedCase, setSelectedCase] = useState(null);
  
  // Estados para la Ruleta
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [winningItem, setWinningItem] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);

  // Ancho constante de cada tarjeta en la ruleta (en pixeles) para calcular el freno exacto
  const ITEM_WIDTH = 160; 
  const WINNING_INDEX = 40; // El ítem ganador siempre será el número 40 en la fila

  const inspectCase = (caja) => {
    setSelectedCase(caja);
    setView('inspect');
  };

  // Función RNG Basada en Pesos (Probabilidades reales)
  const getRandomItemByChance = (items) => {
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of items) {
      sum += item.chance;
      if (random <= sum) return item;
    }
    return items[0]; // Fallback
  };

  const openCase = () => {
    if (!selectedCase) return;
    
    // 1. Decidir el ganador real
    const winner = getRandomItemByChance(selectedCase.items);
    setWinningItem(winner);

    // 2. Generar la cinta de la ruleta (50 items falsos + el ganador en la pos 40)
    const track = [];
    for (let i = 0; i < 55; i++) {
      if (i === WINNING_INDEX) {
        track.push(winner);
      } else {
        track.push(getRandomItemByChance(selectedCase.items));
      }
    }
    setSpinnerItems(track);
    setSpinning(true);
    setView('opening');
    
    // 3. Resetear posición a 0 inmediatamente
    setOffset(0);

    // 4. Iniciar animación después de un micro-retraso para que React renderice
    setTimeout(() => {
      // Formula mágica: Mover la cinta hacia la izquierda hasta el index 40
      // Agregamos un pequeño Math.random() para que no frene EXACTO en el centro siempre, sino un poquito descentrado (más realista)
      const randomOffset = Math.floor(Math.random() * (ITEM_WIDTH - 20)) - (ITEM_WIDTH / 2 - 10);
      const targetOffset = -(WINNING_INDEX * ITEM_WIDTH) + randomOffset;
      setOffset(targetOffset);
      
      // Esperar a que termine de girar (5 segundos)
      setTimeout(() => {
        setSpinning(false);
        setView('result');
      }, 5000); // 5000ms hace match con la transición CSS
    }, 100);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1d202f] via-[#0b0e14] to-[#0b0e14] text-white font-sans p-4 md:p-8 relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* =========================================
            VISTA 1: TIENDA DE CAJAS (STORE)
        ========================================= */}
        {view === 'store' && (
          <div className="w-full animate-fade-in">
            <div className="text-center mb-10 mt-4">
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest drop-shadow-md">
                Mystery Cases
              </h1>
              <p className="text-[#8f9ac6] mt-2 font-bold">Unbox premium pets and become rich.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {CASES.map(caja => (
                <div 
                  key={caja.id} 
                  onClick={() => inspectCase(caja)}
                  className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:border-[#6C63FF] shadow-lg group relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-10 pointer-events-none transition-opacity group-hover:opacity-20" style={{ background: `radial-gradient(circle at 50% 50%, ${caja.color} 0%, transparent 70%)` }}></div>
                  
                  <img src={caja.img} alt={caja.name} className="w-32 h-32 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300 mb-6 z-10 filter brightness-110 sepia-[0.2] hue-rotate-[-20deg]" style={{filter: `drop-shadow(0 0 20px ${caja.color}60)`}} />
                  
                  <h3 className="text-2xl font-black text-white uppercase tracking-widest z-10 mb-2">{caja.name}</h3>
                  <button className="bg-[#141323] border border-[#2F3347] group-hover:border-[#6C63FF] text-white px-6 py-2 rounded-xl text-lg font-black flex items-center gap-2 transition-colors z-10 w-full justify-center">
                    <RedCoin cls="w-5 h-5"/> {formatValue(caja.price)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 2: INSPECCIONAR CAJA (INSPECT)
        ========================================= */}
        {view === 'inspect' && selectedCase && (
          <div className="w-full animate-fade-in">
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-[#6C63FF] font-bold text-sm flex items-center gap-1 transition-colors mb-6 bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] w-max">
               &lsaquo; Back to Store
            </button>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              
              {/* Panel Izq: Abrir Caja */}
              <div className="w-full md:w-1/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-8 flex flex-col items-center relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${selectedCase.color} 0%, transparent 70%)` }}></div>
                <img src={selectedCase.img} alt="case" className="w-48 h-48 object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-6 z-10 animate-float" style={{filter: `drop-shadow(0 0 20px ${selectedCase.color}80)`}} />
                <h2 className="text-3xl font-black text-white uppercase tracking-widest z-10 mb-6">{selectedCase.name}</h2>
                
                <button onClick={openCase} className="w-full py-4 rounded-xl font-black text-lg text-white uppercase tracking-widest shadow-[0_4px_20px_rgba(108,99,255,0.4)] hover:shadow-[0_6px_25px_rgba(108,99,255,0.6)] transition-all hover:-translate-y-1 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] flex items-center justify-center gap-2 border border-[#5E55D9]/40 z-10">
                  OPEN FOR <RedCoin cls="w-6 h-6"/> {formatValue(selectedCase.price)}
                </button>
              </div>

              {/* Panel Der: Posibles Premios */}
              <div className="w-full md:w-2/3">
                <h3 className="text-[#8f9ac6] text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#6C63FF]"></span> Items in this Case
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCase.items.sort((a,b) => b.valor - a.valor).map((item, i) => (
                    <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-xl overflow-hidden flex flex-col aspect-[3/4] relative group hover:border-[#3f4354] transition-colors">
                      <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: item.color}}></div>
                      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 70%)` }}></div>
                      
                      {/* Chance Badge */}
                      <div className="absolute top-2 right-2 bg-[#0b0e14] border border-[#252839] px-2 py-0.5 rounded text-[10px] font-black text-white z-20">
                        {item.chance}%
                      </div>

                      <div className="flex-1 p-4 flex items-center justify-center z-10">
                        <img src={item.img} className="w-full h-full object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300" alt={item.name}/>
                      </div>
                      <div className="w-full text-center pb-3 z-10 bg-[#1c1f2e] pt-2 border-t border-[#252839]">
                        <p className="text-[#8f9ac6] text-xs font-bold truncate px-2 mb-1" style={{color: item.color}}>{item.name}</p>
                        <p className="text-white font-black text-sm flex items-center justify-center gap-1"><RedCoin/> {formatValue(item.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================
            VISTA 3: ABRIENDO LA CAJA (LA RULETA)
        ========================================= */}
        {view === 'opening' && (
          <div className="w-full flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <h2 className="text-2xl font-black text-[#8f9ac6] uppercase tracking-widest mb-10 animate-pulse">Opening {selectedCase?.name}...</h2>
            
            {/* CONTENEDOR DE LA RULETA */}
            <div className="w-full relative h-[200px] bg-[#141323] border-y-2 border-[#252839] overflow-hidden shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] flex items-center">
              
              {/* Sombras Laterales (Viñeta) */}
              <div className="absolute left-0 top-0 w-1/4 h-full bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute right-0 top-0 w-1/4 h-full bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>

              {/* LA LÍNEA DEL MEDIO (SELECTOR) */}
              <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-[#facc15] -translate-x-1/2 z-30 shadow-[0_0_15px_#facc15]">
                 {/* Triangulitos */}
                 <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-[#facc15]"></div>
                 <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-[#facc15]"></div>
              </div>

              {/* LA CINTA QUE GIRA */}
              <div className="absolute left-1/2 flex items-center h-full will-change-transform"
                   style={{
                     // -ITEM_WIDTH/2 asegura que el primer item inicie perfectamente centrado
                     transform: `translateX(calc(-${ITEM_WIDTH/2}px + ${offset}px))`,
                     transition: spinning ? 'transform 5s cubic-bezier(0.15, 0.85, 0.15, 1)' : 'none'
                   }}
              >
                {spinnerItems.map((item, idx) => (
                  <div key={idx} style={{width: `${ITEM_WIDTH}px`}} className="h-[160px] flex-shrink-0 flex items-center justify-center px-2">
                    <div className="w-full h-full bg-[#1c1f2e] border-2 border-[#252839] rounded-xl relative flex flex-col items-center justify-center shadow-lg" style={{borderBottomColor: item.color, borderBottomWidth: '4px'}}>
                      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 70%)` }}></div>
                      <img src={item.img} className="w-16 h-16 object-contain mb-2 drop-shadow-md z-10" alt="pet"/>
                      <p className="text-[10px] font-bold text-center w-full px-1 truncate z-10" style={{color: item.color}}>{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* =========================================
            VISTA 4: RESULTADO (WIN)
        ========================================= */}
        {view === 'result' && winningItem && (
          <div className="w-full flex flex-col items-center justify-center min-h-[60vh] animate-scale-in">
            <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
              You Won!
            </h2>
            <p className="text-[#8f9ac6] font-bold mb-10">Item added to your inventory.</p>

            <div className="relative w-64 h-80 bg-[#1c1f2e] border-2 rounded-2xl p-6 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-float" style={{borderColor: winningItem.color, boxShadow: `0 0 40px ${winningItem.color}40`}}>
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${winningItem.color} 0%, transparent 80%)` }}></div>
              <img src={winningItem.img} className="w-40 h-40 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] mb-6 z-10" alt="win" />
              <h3 className="text-xl font-black text-center z-10 uppercase tracking-widest" style={{color: winningItem.color}}>{winningItem.name}</h3>
              <p className="text-white font-black text-lg flex items-center gap-2 z-10 mt-2 bg-[#0b0e14] px-4 py-1.5 rounded-lg border border-[#252839]"><RedCoin/> {formatValue(winningItem.valor)}</p>
            </div>

            <div className="flex gap-4 mt-10">
              <button onClick={() => setView('store')} className="px-8 py-3 rounded-xl font-bold text-[#E1E4F2] bg-[#2a2e44] hover:bg-[#32364f] border border-[#2D314A] transition-all uppercase tracking-widest">
                Back to Store
              </button>
              <button onClick={openCase} className="px-8 py-3 rounded-xl font-black text-white uppercase tracking-widest shadow-[0_4px_15px_rgba(108,99,255,0.4)] hover:shadow-[0_6px_20px_rgba(108,99,255,0.6)] transition-all hover:-translate-y-1 bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] border border-[#5E55D9]/40 flex items-center gap-2">
                Open Again <span className="opacity-70 font-normal">({formatValue(selectedCase?.price)})</span>
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