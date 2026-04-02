"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const WINNING_INDEX = 45; 
const ITEM_WIDTH = 180;

const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function CasesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  
  const [casesDB, setCasesDB] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  const [spinnerItems, setSpinnerItems] = useState([]);
  const [winningItem, setWinningItem] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const initData = async () => {
        setLoadingCases(true);
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) setCurrentUser(authData.user);

        const { data: cajas, error } = await supabase.from('cases').select('*').order('price', { ascending: true });

        if (!error && cajas) {
            // Reparación automática de JSON por si viene como String
            const safeCajas = cajas.map(c => ({
                ...c,
                items: typeof c.items === 'string' ? JSON.parse(c.items) : (c.items || [])
            }));
            setCasesDB(safeCajas);
        }
        setLoadingCases(false);
    };
    initData();
  }, []);

  const getRandomVisualItem = (itemsArray) => {
    if (!itemsArray || itemsArray.length === 0) return {};
    const random = Math.random() * 100;
    let sum = 0;
    for (let item of itemsArray) {
      sum += (item.chance || 0);
      if (random <= sum) return item;
    }
    return itemsArray[0];
  };

  const openCase = async () => {
    if (!currentUser) return alert("Please log in to open cases.");
    if (spinning) return;
    
    setView('opening');
    setSpinning(false);
    setOffset(0);

    const { data: winner, error } = await supabase.rpc('abrir_caja', { 
        p_usuario_id: currentUser.id,
        p_case_id: selectedCase.id,
        p_precio: selectedCase.price,
        p_items: selectedCase.items
    });

    // AHORA EL ERROR TE DIRÁ EXACTAMENTE QUÉ ID DE MASCOTA FALTA EN TU TABLA ITEMS
    if (error || winner?.error) {
        setView('inspect');
        return alert("❌ ERROR DEL SISTEMA:\n\n" + (winner?.error || error?.message || "Fallo desconocido."));
    }

    setWinningItem(winner);

    const track = [];
    for (let i = 0; i < 60; i++) {
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
      }, 5500); 
    }, 100);
  };

  const getItemData = (item) => ({
      id: item?.id || 'unknown',
      name: item?.name || item?.nombre || 'Unknown',
      img: item?.img || item?.image_url || '/default-pet.png',
      valor: item?.valor || item?.value || 0,
      color: item?.color || '#9ca3af',
      chance: item?.chance || 0
  });

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden animate-fade-in">
      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* VISTA 1: TIENDA */}
        {view === 'store' && (
          <div>
            <div className="text-center md:text-left mb-10 border-b border-[#252839] pb-6 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md">
                  Cases
                </h1>
                <p className="text-[#555b82] font-bold text-sm mt-2 uppercase tracking-widest">Unbox exclusive pets</p>
              </div>
            </div>

            {loadingCases ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 border-4 border-[#252839] border-t-[#6C63FF] rounded-full animate-spin mb-4"></div>
                    <p className="text-[#555b82] font-black uppercase tracking-widest text-xs">Loading cases...</p>
                </div>
            ) : casesDB.length === 0 ? (
                <div className="py-20 text-center text-[#555b82] font-bold bg-[#141323] border border-[#2F3347] rounded-2xl">
                    No cases available. Create one in your database!
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                  {casesDB.map(caja => (
                    <div 
                      key={caja.id} onClick={() => { setSelectedCase(caja); setView('inspect'); }}
                      className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:border-[#4f567a] group relative shadow-lg"
                    >
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: `radial-gradient(circle at center, ${caja.color || '#6C63FF'} 0%, transparent 70%)` }}></div>
                      
                      <img src={caja.image_url} alt={caja.name} className="w-32 h-32 object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-300 mb-6 z-10" />
                      
                      <h3 className="text-sm font-black text-[#8f9ac6] uppercase tracking-widest z-10 mb-2 truncate w-full text-center">{caja.name}</h3>
                      <button className="bg-[#141323] border border-[#2F3347] text-[#22c55e] px-4 py-2.5 rounded-lg text-sm font-black flex items-center justify-center gap-1.5 w-full shadow-inner group-hover:bg-[#252839] transition-colors z-10">
                        <GreenCoin cls="w-4 h-4"/> {formatValue(caja.price)}
                      </button>
                    </div>
                  ))}
                </div>
            )}
          </div>
        )}

        {/* VISTA 2: INSPECCIONAR CAJA */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in">
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-6 bg-[#1c1f2e] px-5 py-2.5 rounded-xl border border-[#252839] w-max shadow-sm">
               &lsaquo; Back to Store
            </button>

            <div className="flex flex-col lg:flex-row gap-6">
              
              <div className="w-full lg:w-1/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-8 flex flex-col items-center relative overflow-hidden shadow-xl h-max">
                <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at center, ${selectedCase.color || '#6C63FF'} 0%, transparent 70%)` }}></div>
                
                <img src={selectedCase.image_url} alt="case" className="w-48 h-48 object-contain drop-shadow-2xl mb-8 z-10" />
                
                <h2 className="text-2xl font-black text-white uppercase tracking-widest z-10 mb-6 text-center">{selectedCase.name}</h2>
                
                <button onClick={openCase} className="w-full py-4 rounded-xl font-black text-sm text-[#0b0e14] uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all hover:-translate-y-0.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center justify-center gap-2 z-10">
                  OPEN BOX <span className="opacity-50">|</span> <GreenCoin cls="w-4 h-4"/> {formatValue(selectedCase.price)}
                </button>
              </div>

              <div className="w-full lg:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#252839] pb-4 mb-6">
                    <h3 className="text-white text-sm font-black uppercase tracking-widest">Contents</h3>
                    <span className="text-[#555b82] font-black text-xs uppercase">{Array.isArray(selectedCase.items) ? selectedCase.items.length : 0} Items</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.isArray(selectedCase.items) ? selectedCase.items.map((rawItem, i) => {
                    const item = getItemData(rawItem);
                    return (
                    <div key={i} className="bg-[#141323] border border-[#2F3347] rounded-xl overflow-hidden flex flex-col relative group transition-colors hover:border-[#4f567a] h-44">
                      <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: item.color}}></div>
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10" style={{ background: `radial-gradient(circle at center, ${item.color} 0%, transparent 70%)` }}></div>
                      <div className="absolute top-2 right-2 bg-[#1c1f2e] border border-[#252839] px-1.5 py-0.5 rounded text-[9px] font-black text-[#8f9ac6] z-20">{item.chance}%</div>
                      <div className="flex-1 p-2 flex items-center justify-center z-10">
                        <img src={item.img} className="w-16 h-16 object-contain drop-shadow-md group-hover:scale-110 transition-transform" alt={item.name}/>
                      </div>
                      <div className="w-full text-center pb-3 z-10 pt-2 border-t border-[#2F3347]">
                        <p className="text-[10px] font-bold truncate px-2 mb-0.5" style={{color: item.color}}>{item.name}</p>
                        <p className="text-white font-black text-xs flex items-center justify-center gap-1"><RedCoin cls="w-3 h-3"/> {formatValue(item.valor)}</p>
                      </div>
                    </div>
                  )}) : (
                    <p className="text-[#555b82] text-sm">No items found in this case JSON.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VISTA 3: RULETA GIRANDO */}
        {view === 'opening' && (
          <div className="w-full flex flex-col items-center justify-center min-h-[50vh] animate-fade-in relative z-20">
            <div className="text-center mb-8">
               <h2 className="text-2xl font-black text-[#8f9ac6] uppercase tracking-widest animate-pulse">
                 Opening {selectedCase?.name}...
               </h2>
            </div>
            <div className={`w-full relative h-[200px] bg-[#141323] border-y-2 border-[#252839] overflow-hidden shadow-inner flex items-center transition-opacity duration-300 rounded-lg ${spinning ? 'opacity-100' : 'opacity-0'}`}>
              <div className="absolute left-0 top-0 w-12 md:w-32 h-full bg-gradient-to-r from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute right-0 top-0 w-12 md:w-32 h-full bg-gradient-to-l from-[#0b0e14] to-transparent z-20 pointer-events-none"></div>
              <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#facc15] -translate-x-1/2 z-30 shadow-[0_0_10px_#facc15]"></div>
              <div className="absolute left-1/2 flex items-center h-full will-change-transform" style={{ transform: `translateX(calc(-${ITEM_WIDTH/2}px + ${offset}px))`, transition: spinning ? 'transform 5.5s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none' }}>
                {spinnerItems.map((rawItem, idx) => {
                  const item = getItemData(rawItem);
                  return (
                  <div key={idx} style={{width: `${ITEM_WIDTH}px`}} className="h-[160px] flex-shrink-0 flex items-center justify-center px-1">
                    <div className="w-full h-full bg-[#1c1f2e] border border-[#252839] rounded-xl relative flex flex-col items-center justify-center overflow-hidden" style={{borderBottomColor: item.color, borderBottomWidth: '4px'}}>
                      <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at 50% 50%, ${item.color} 0%, transparent 80%)` }}></div>
                      <img src={item.img} className="w-16 h-16 object-contain mb-2 drop-shadow-md z-10" alt="pet"/>
                      <div className="w-full text-center px-2 z-10">
                         <p className="text-[10px] font-bold truncate" style={{color: item.color}}>{item.name}</p>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: PANTALLA DE VICTORIA */}
        {view === 'result' && winningItem && (() => {
          const wItem = getItemData(winningItem);
          return (
          <div className="w-full flex flex-col items-center justify-center min-h-[50vh] animate-scale-in relative z-20">
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Item Unboxed</h2>
            <p className="text-[#555b82] font-bold text-sm mb-8 uppercase tracking-widest">Saved to your vault</p>

            <div className="relative w-64 h-[300px] bg-[#141323] border-2 rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl z-10 overflow-hidden" style={{borderColor: wItem.color, boxShadow: `0 0 40px ${wItem.color}30`}}>
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${wItem.color} 0%, transparent 80%)` }}></div>
              <div className="absolute top-3 right-3 bg-[#1c1f2e] border border-[#252839] px-2 py-1 rounded text-[10px] font-black text-[#8f9ac6] z-20">{wItem.chance}%</div>
              <img src={wItem.img} className="w-32 h-32 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] mb-6 z-10 hover:scale-110 transition-transform" alt="win" />
              <h3 className="text-lg font-black text-center z-10 uppercase tracking-widest mb-3" style={{color: wItem.color}}>{wItem.name}</h3>
              <div className="w-full bg-[#1c1f2e] px-4 py-2.5 rounded-xl border border-[#252839] flex items-center justify-center gap-2 z-10">
                 <RedCoin cls="w-5 h-5"/> 
                 <span className="text-white font-black text-lg">{formatValue(wItem.valor)}</span>
              </div>
            </div>

            <div className="flex gap-4 mt-10 z-10">
              <button onClick={() => setView('store')} className="px-6 py-3 rounded-xl font-bold text-[#8f9ac6] bg-[#1c1f2e] hover:bg-[#252839] hover:text-white border border-[#252839] transition-all uppercase tracking-widest text-xs">
                Back to Store
              </button>
              <button onClick={openCase} className="px-6 py-3 rounded-xl font-black text-[#0b0e14] uppercase tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all hover:-translate-y-0.5 bg-gradient-to-r from-[#22c55e] to-[#16a34a] flex items-center gap-2 text-xs">
                OPEN AGAIN <span className="opacity-80 font-bold ml-1">({formatValue(selectedCase?.price)})</span>
              </button>
            </div>
          </div>
        )})()}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.9); } 60% { transform: scale(1.02); } 100% { opacity: 1; transform: scale(1); } }
      `}} />
    </div>
  );
}
