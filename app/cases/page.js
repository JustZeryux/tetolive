"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

// --- HELPERS VISUALES DE RAREZA ---

const getPetVariants = (name) => {
  if (!name) return { isShiny: false, isMythic: false, isXL: false };
  const lowerName = name.toLowerCase();
  return {
    isShiny: lowerName.includes('shiny'),
    isMythic: lowerName.includes('mythic'),
    isXL: lowerName.includes('xl') 
  };
};

const getRarityClass = (variants) => {
  if (variants.isXL) return "rarity-xl";
  if (variants.isShiny && variants.isMythic) return "rarity-shiny-mythic";
  if (variants.isMythic) return "rarity-mythic";
  if (variants.isShiny) return "rarity-shiny";
  return "rarity-standard";
};

// Componente visual reutilizable para los ítems
const PetVisualCard = ({ item, chance, isSpinner = false }) => {
  const variants = getPetVariants(item.name);
  const rarityClass = getRarityClass(variants);
  const isRare = chance < 1; // Menos de 1% es raro

  // Clases dinámicas
  const cardClasses = `pet-card-visual ${rarityClass} ${isRare ? 'is-rare' : ''} ${isSpinner ? 'is-spinner-item' : ''}`;
  
  return (
    <div className={cardClasses} style={{ '--item-color': item.color }}>
      {/* Capas de Brillo y Efectos */}
      <div className="pet-glow-layer"></div>
      <div className="pet-sparkle-overlay"></div>
      {variants.isXL && <div className="xl-particle-effect"></div>}

      {/* Chance Badge (Solo si no es ruleta) */}
      {!isSpinner && chance && (
        <div className="pet-chance-badge">
          {chance.toFixed(variants.isXL || chance < 0.1 ? 2 : 1)}%
        </div>
      )}

      {/* Imagen */}
      <div className="pet-image-container">
        <img src={item.img} alt={item.name} className="pet-image" />
      </div>

      {/* Info Bar (Nombre y Valor) */}
      <div className="pet-info-bar">
        <p className="pet-name">{item.name}</p>
        <p className="pet-value">
          <GreenCoin cls="w-3 h-3 grayscale opacity-70"/> {formatValue(item.valor)}
        </p>
      </div>
    </div>
  );
};


export default function CasesPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [casesData, setCasesData] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price_asc'); 
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  const [quantity, setQuantity] = useState(1);

  const [isFastRoll, setIsFastRoll] = useState(false);
  const [isAutoOpen, setIsAutoOpen] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false); 
  const isAutoOpenRef = useRef(isAutoOpen);

  const [showNoMoneyModal, setShowNoMoneyModal] = useState(false);
  const [moneyNeeded, setMoneyNeeded] = useState(0);

  const [spinnerTracks, setSpinnerTracks] = useState([]);
  const [winningItems, setWinningItems] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const slidersRef = useRef([]);
  const [hasLimitedWin, setHasLimitedWin] = useState(false); 
  
  const WINNING_INDEX = 40; 
  const [dbItemsMap, setDbItemsMap] = useState({});

  useEffect(() => {
      isAutoOpenRef.current = isAutoOpen;
  }, [isAutoOpen]);

  useEffect(() => {
      if (triggerOpen) {
          setTriggerOpen(false);
          openCase();
      }
  }, [triggerOpen]);

  // --- useEffect OPTIMIZADO: CONSULTA SELECTIVA ---
  // --- useEffect OPTIMIZADO Y SEGURO ---
  useEffect(() => {
    const fetchData = async () => {
      try { // 1. Agregamos Try-Catch para que nunca se quede congelado
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          setCurrentUser(userData.user);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
          setUserProfile(profile);
        }

        const { data: dbCases, error: casesError } = await supabase.from('cases').select('*');
        if (casesError) throw casesError;
        
        let formatCases = [];
        let itemMap = {};

        if (dbCases) {
          formatCases = dbCases.map(c => ({
            id: c.id, name: c.name, price: c.price, img: c.image_url,
            color: c.color, shadow: c.shadow, items: c.items
          }));

          const idsToFetch = new Set();
          formatCases.forEach(caja => {
            if (caja.items) {
              caja.items.forEach(item => {
                const id = item.item_id || item.id;
                if (id) idsToFetch.add(id);
              });
            }
          });

          const idsArray = Array.from(idsToFetch);

          // 2. EL FIX: Partir la lista en "chunks" (pedacitos de 100) para no saturar la URL
          if (idsArray.length > 0) {
            const chunkSize = 100;
            const fetchPromises = [];
            
            for (let i = 0; i < idsArray.length; i += chunkSize) {
              const chunk = idsArray.slice(i, i + chunkSize);
              fetchPromises.push(supabase.from('items').select('*').in('id', chunk));
            }

            // Ejecutamos todos los pedacitos al mismo tiempo (súper rápido)
            const results = await Promise.all(fetchPromises);
            
            results.forEach(res => {
              if (res.error) console.error("Error en un chunk:", res.error);
              if (res.data) {
                res.data.forEach(i => {
                  if (i.id) itemMap[i.id] = i; 
                  if (i.name) itemMap[i.name.toLowerCase().trim()] = i; 
                });
              }
            });
          }
        }

        setDbItemsMap(itemMap);
        setCasesData(formatCases);
        
      } catch (error) {
        console.error("🚨 Error crítico cargando la página:", error);
      } finally {
        // 3. Pase lo que pase (éxito o error), quitamos la pantalla de carga
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredAndSortedCases = useMemo(() => {
    let result = [...casesData];
    if (searchTerm) result = result.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
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

  // Buscador a prueba de balas
  const getRealItemData = (rawItem) => {
      if (!rawItem) return null;
      const searchName = (rawItem.name || '').toLowerCase().trim();
      return dbItemsMap[rawItem.item_id] || dbItemsMap[rawItem.id] || dbItemsMap[searchName] || null;
  };

  const openCase = async () => {
    if (!currentUser || !userProfile) return alert("Please log in first.");
    if (spinning) return;

    const totalCost = selectedCase.price * quantity;

    if (userProfile.saldo_verde < totalCost) {
      setMoneyNeeded(totalCost);
      setShowNoMoneyModal(true);
      setIsAutoOpen(false); 
      return;
    }
    
    setView('opening');
    setSpinning(true); 
    setHasLimitedWin(false);

    try {
      const validItemsToRoll = [];
      let totalChance = 0;

      for (let item of selectedCase.items) {
          const dbItem = getRealItemData(item);

          const isLim = dbItem ? dbItem.is_limited : (item.is_limited || item.limited);
          const maxQ = dbItem ? dbItem.max_quantity : item.max_quantity;
          const itemId = dbItem ? dbItem.id : (item.item_id || item.id);
          
          if (isLim && maxQ && itemId) {
              const { count } = await supabase
                  .from('inventory')
                  .select('*', { count: 'exact', head: true })
                  .eq('item_id', itemId);
              
              if (count >= maxQ) {
                  continue; 
              }
          }

          // Si dbItem existe, inyectamos sus datos reales. Si no, usamos el fallback del JSON viejo para no romper la caja.
          validItemsToRoll.push({
              ...(dbItem || {}), 
              id: itemId,
              name: dbItem ? dbItem.name : item.name,
              chance: item.chance,
              img: dbItem ? dbItem.image_url : (item.img || item.image_url),
              valor: dbItem ? dbItem.value : (item.valor || item.value || 0),
              color: dbItem ? dbItem.color : (item.color || '#ffffff'),
              is_limited: isLim || false
          });
          totalChance += item.chance;
      }

      if (validItemsToRoll.length === 0) throw new Error("No items available in this case.");

      const normalizedItems = validItemsToRoll.map(item => ({
          ...item,
          chance: (item.chance / totalChance) * 100
      }));

      const newBalance = userProfile.saldo_verde - totalCost;
      setUserProfile(prev => ({ ...prev, saldo_verde: newBalance }));

      const { error: chargeError } = await supabase.from('profiles').update({ saldo_verde: newBalance }).eq('id', currentUser.id);
      if (chargeError) throw new Error("Failed to deduct balance: " + chargeError.message);

      const winners = [];
      const inventoryInserts = [];
      let foundLimited = false;
      
      for (let i = 0; i < quantity; i++) {
          const winner = getRandomVisualItem(normalizedItems);
          if (winner.is_limited) foundLimited = true;

          winners.push({
             ...winner,
             isLimited: winner.is_limited
          });
          
          inventoryInserts.push({ 
              user_id: currentUser.id, 
              item_id: winner.id || `old-${winner.name}`, // Fallback para inserts viejos
              is_limited: winner.is_limited || false,
              original_owner: winner.is_limited ? (userProfile.username || currentUser.email?.split('@')[0] || 'Player') : null
          });
      }

      const { error: invError } = await supabase.from('inventory').insert(inventoryInserts);

      if (invError) {
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde }).eq('id', currentUser.id);
          setUserProfile(prev => ({ ...prev, saldo_verde: prev.saldo_verde + totalCost }));
          throw new Error("Failed to insert items into inventory: " + invError.message);
      }

      setWinningItems(winners);
      if (foundLimited) setHasLimitedWin(true);

      const tracks = [];
      for (let i = 0; i < quantity; i++) {
        const t = [];
        for (let j = 0; j < 80; j++) t.push(getRandomVisualItem(normalizedItems));
        t[WINNING_INDEX] = winners[i];
        tracks.push(t);
      }
      setSpinnerTracks(tracks);

      const spinDuration = isFastRoll ? 1.5 : 6;
      const resultDelay = isFastRoll ? 1800 : 6500;

      setTimeout(() => {
        if (slidersRef.current) {
          slidersRef.current.forEach(el => {
            if (el) {
              el.style.transition = 'none';
              el.style.transform = `translateX(0px)`;
              setTimeout(() => {
                el.style.transition = `transform ${spinDuration}s cubic-bezier(0.15, 0.85, 0.15, 1)`;
                const isMulti = quantity > 1;
                const itemWidth = isMulti ? 128 : 188; 
                el.style.transform = `translateX(-${(WINNING_INDEX * itemWidth) - (window.innerWidth / 2) + (itemWidth / 2)}px)`;
              }, 50);
            }
          });
        }
      }, 100);

      setTimeout(() => {
        setSpinning(false);
        setView('result'); 

        if (foundLimited) {
            try {
               const epicAudio = new Audio('/sounds/win.mp3'); 
               epicAudio.volume = 0.6;
               epicAudio.play().catch(e => console.log('Audio autoplay prevented'));
            } catch (e) {}

            const flash = document.createElement('div');
            flash.className = "fixed inset-0 bg-white z-[999] opacity-0 transition-opacity duration-300 pointer-events-none";
            document.body.appendChild(flash);
            setTimeout(() => flash.style.opacity = "0.7", 10);
            setTimeout(() => {
              flash.style.opacity = "0";
              setTimeout(() => flash.remove(), 300);
            }, 150);
        }

        if (isAutoOpenRef.current) {
            setTimeout(() => {
                if (isAutoOpenRef.current) setTriggerOpen(true);
            }, 1500); 
        }

      }, resultDelay);

    } catch (error) {
      console.error(error);
      alert(error.message);
      setSpinning(false);
      setIsAutoOpen(false);
      setView('store');
    }
  };

  if (isLoading) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Loading Cases...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6C63FF]/15 to-transparent blur-[150px] pointer-events-none z-0"></div>
      
      {showNoMoneyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/60">
          <div className="bg-[#1a1d29] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-bounce-in">
            <div className="flex justify-center mb-4 text-6xl">⚠️</div>
            <h2 className="text-2xl font-black text-center uppercase mb-2">Insufficient Balance</h2>
            <p className="text-[#8f9ac6] text-center mb-6">You don't have enough coins for this case.</p>
            <div className="bg-[#0b0e14] rounded-2xl p-4 mb-6 border border-[#252839]">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Your Balance:</span>
                <span className="font-bold text-white"><GreenCoin/> {userProfile?.saldo_verde?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between border-t border-[#252839] pt-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Total Price:</span>
                <span className="font-bold text-red-400"><GreenCoin/> {moneyNeeded.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setShowNoMoneyModal(false)} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-all uppercase tracking-widest shadow-lg">
              Understood
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto relative z-10">

        {/* STORE VIEW */}
        {view === 'store' && (
          <div className="animate-fade-in">
            <div className="text-center mb-10 mt-4">
              <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#e0e5ff] to-[#8f9ac6] uppercase tracking-widest drop-shadow-[0_0_15px_rgba(108,99,255,0.4)] mb-3">
                Premium Cases
              </h1>
              <p className="text-[#8f9ac6] font-bold text-lg md:text-xl tracking-wide">Open cases and get the rarest items.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-2xl p-4 mb-10 gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="relative w-full md:w-1/3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8f9ac6]">🔍</span>
                <input 
                  type="text" placeholder="Search case..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#6C63FF] focus:shadow-[0_0_15px_rgba(108,99,255,0.3)] transition-all font-semibold"
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-[#8f9ac6] font-bold uppercase text-sm tracking-wider">Sort by:</span>
                <select 
                  value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#0b0e14] border border-[#252839] text-white rounded-xl py-3 px-4 focus:outline-none focus:border-[#6C63FF] font-semibold cursor-pointer w-full md:w-auto"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A - Z</option>
                </select>
              </div>
            </div>

            {filteredAndSortedCases.length === 0 ? (
              <div className="text-center py-20 text-[#8f9ac6] text-xl font-bold bg-[#14151f]/50 rounded-3xl border border-[#252839] border-dashed">😔 No cases found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {filteredAndSortedCases.map(caja => (
                  <div key={caja.id} onClick={() => { setSelectedCase(caja); setQuantity(1); setView('inspect'); }} className="bg-[#0a0a0a] rounded-3xl p-1 flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-2 border-2 border-[#1f2937] hover:border-cyan-500 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] group relative overflow-hidden h-full">
                    <div className="absolute inset-1 rounded-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 z-0 overflow-hidden">
                        <div className="w-[150%] h-[150%] absolute -top-1/4 -left-1/4" style={{ background: `radial-gradient(circle at center, ${caja.color} 0%, transparent 70%)` }}></div>
                    </div>
                    <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-[#111827]/60 rounded-t-2xl z-10 relative">
                        <div className="absolute inset-0 rounded-full blur-2xl opacity-20 group-hover:opacity-60 group-hover:scale-110 transition-all duration-500" style={{ backgroundColor: caja.color }}></div>
                        <img src={caja.img} alt={caja.name} className="w-40 h-40 object-contain relative z-10 drop-shadow-[0_15px_25px_rgba(0,0,0,0.8)] group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest z-10 mt-6 text-center line-clamp-1 w-full" style={{textShadow: `0 2px 4px rgba(0,0,0,0.8)`}}>{caja.name}</h3>
                    </div>
                    <div className="w-full bg-[#111827]/90 rounded-b-2xl py-4 px-4 backdrop-blur-md border-t border-[#374151]/50 group-hover:border-cyan-500/30 transition-colors z-10">
                        <button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-2 rounded-xl text-lg font-black flex items-center justify-center gap-2 transition-all duration-300 w-full shadow-[0_5px_15px_rgba(6,182,212,0.4)] group-hover:shadow-[0_8px_20px_rgba(6,182,212,0.6)]">
                          <GreenCoin cls="w-5 h-5"/> {formatValue(caja.price)}
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INSPECT VIEW (Rediseñada) */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in">
            <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-8 bg-[#1c1f2e] px-5 py-2.5 rounded-xl border border-[#252839] w-max shadow-md hover:border-cyan-500/50">
                &lsaquo; Back to Store
            </button>
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              <div className="w-full lg:w-1/3 bg-[#0a0a0a] border-2 border-[#1f2937] rounded-3xl p-8 flex flex-col items-center relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${selectedCase.color} 0%, transparent 80%)` }}></div>
                
                <div className="relative w-full flex justify-center mb-8">
                    <div className="absolute w-32 h-32 rounded-full blur-[40px] opacity-60 z-0" style={{ backgroundColor: selectedCase.color }}></div>
                    <img src={selectedCase.img} className="w-56 h-56 object-contain z-10 drop-shadow-[0_20px_30px_rgba(0,0,0,0.8)] animate-pulse-slow" alt={selectedCase.name} />
                </div>
                
                <h2 className="text-3xl font-black text-white uppercase tracking-widest z-10 mb-8 text-center" style={{textShadow: `0 2px 10px ${selectedCase.color}80`}}>{selectedCase.name}</h2>
                
                <div className="w-full mb-6 z-10">
                    <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest text-center mb-3">Amount to open</p>
                    <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(q => (
                            <button
                                key={q} onClick={() => setQuantity(q)}
                                className={`py-2 rounded-lg font-black transition-all text-sm ${quantity === q ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-105 border border-cyan-400' : 'bg-[#111827] text-[#8f9ac6] border border-[#374151] hover:border-cyan-500/50 hover:text-white'}`}
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-6 w-full">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isFastRoll ? 'bg-cyan-500' : 'bg-gray-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${isFastRoll ? 'left-5' : 'left-1'}`}></div>
                            </div>
                            <span className="text-white font-bold text-sm uppercase tracking-wider group-hover:text-cyan-400">Fast ⚡</span>
                            <input type="checkbox" className="hidden" checked={isFastRoll} onChange={e => setIsFastRoll(e.target.checked)} />
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-10 h-5 rounded-full relative transition-colors ${isAutoOpen ? 'bg-cyan-500' : 'bg-gray-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${isAutoOpen ? 'left-5' : 'left-1'}`}></div>
                            </div>
                            <span className="text-white font-bold text-sm uppercase tracking-wider group-hover:text-cyan-400">Auto 🔄</span>
                            <input type="checkbox" className="hidden" checked={isAutoOpen} onChange={e => setIsAutoOpen(e.target.checked)} />
                        </label>
                    </div>

                </div>

                <button onClick={openCase} disabled={spinning} className="w-full py-4 mt-2 rounded-2xl font-black text-xl text-white uppercase tracking-widest shadow-[0_5px_20px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.6)] transition-all hover:-translate-y-1 bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center gap-3 z-10">
                  OPEN {quantity > 1 ? `x${quantity}` : ''} FOR <GreenCoin cls="w-6 h-6"/> {formatValue(selectedCase.price * quantity)}
                </button>
              </div>

              {/* Case Contents (Mejorado visualmente) */}
              <div className="w-full lg:w-2/3 bg-[#0a0a0a] border-2 border-[#1f2937] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 border-b border-[#374151] pb-4">
                  Case Contents
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCase.items.map((rawItem, idx) => {
                    const dbItem = getRealItemData(rawItem);
                    if (!dbItem) return null; // Saltar si no hay datos (no debería pasar con la optimización)

                    return (
                        <PetVisualCard 
                          key={idx}
                          item={dbItem}
                          chance={rawItem.chance}
                        />
                    )})}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* OPENING VIEW (SPINNER - Mejorado visualmente) */}
        {view === 'opening' && (
          <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] relative">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10 unboxing-text">
              Unboxing...
            </h2>
            
            <div className={`flex flex-col gap-4 w-full max-w-[1000px] z-10 ${quantity > 5 ? 'grid grid-cols-2' : ''}`}>
                {spinnerTracks.map((track, trackIdx) => {
                    const isMulti = quantity > 1;
                    const containerHeight = isMulti ? "h-[140px]" : "h-[280px]";

                    return (
                        <div key={trackIdx} className={`relative w-full ${containerHeight} bg-[#07080a] border-y-4 border-[#1f2937] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-2xl flex items-center`}>
                          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0a0a0a] to-transparent z-20 pointer-events-none"></div>
                          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0a0a0a] to-transparent z-20 pointer-events-none"></div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-cyan-400 z-30 shadow-[0_0_25px_rgba(34,211,238,1)] -translate-x-1/2 roulette-pointer"></div>
                          
                          <div className="absolute top-0 bottom-0 left-1/2 flex items-center w-max z-10">
                            <div ref={el => slidersRef.current[trackIdx] = el} className="flex items-center h-full will-change-transform sliders-container">
                              {track.map((item, idx) => (
                                <div key={idx} className="shrink-0 mx-1">
                                    <PetVisualCard 
                                      item={item} 
                                      chance={item.chance}
                                      isSpinner={true}
                                    />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                    );
                })}
            </div>
          </div>
        )}

        {/* RESULT VIEW (Resultados grandes y bonitos) */}
        {view === 'result' && winningItems.length > 0 && (
          <div className={`w-full flex flex-col items-center justify-center min-h-[70vh] relative ${hasLimitedWin ? 'animate-epic-reveal' : 'animate-bounce-in'}`}>
            
            {hasLimitedWin && (
                <>
                    <div className="fixed inset-0 bg-black/95 z-0 animate-fade-in pointer-events-none"></div>
                    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                        <div className="w-[200vw] h-[200vw] rounded-full bg-gradient-to-tr from-yellow-500/30 via-yellow-300/10 to-transparent animate-spin-slow blur-[120px]"></div>
                        <div className="absolute w-full h-full bg-yellow-500/10 animate-pulse particles-bg"></div>
                    </div>
                </>
            )}

            <h2 className={`text-5xl font-black uppercase tracking-widest mb-12 z-10 ${hasLimitedWin ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse' : 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]'}`}>
              {hasLimitedWin ? '🌟 LIMITED UNBOXED! 🌟' : (quantity > 1 ? 'Items Unboxed!' : 'Item Unboxed!')}
            </h2>
            
            {quantity === 1 ? (
                // Ganancia única grande (estilo VIP)
                <div className="z-10 w-full max-w-xl flex flex-col items-center">
                    <PetVisualCard item={winningItems[0]} chance={0} /> {/* Usamos 0 chance para que no salga el badge */}
                    
                    <div className="flex gap-4 w-full mt-10 relative z-10 max-w-md">
                        <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="flex-1 bg-[#111827] hover:bg-[#1f2937] border-2 border-[#374151] text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest transition-colors shadow-md hover:border-cyan-500/50">
                          Store
                        </button>
                        {isAutoOpen ? (
                            <button onClick={() => setIsAutoOpen(false)} className="flex-1 bg-red-600 hover:bg-red-500 text-white border-none px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(220,38,38,0.4)]">
                                Stop Auto 🛑
                            </button>
                        ) : (
                            <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_25px_rgba(6,182,212,0.6)]">
                                Spin Again
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                // Ganancia múltiple (Grid)
                <div className="flex flex-col items-center w-full max-w-[1200px] z-10 animate-fade-in-up">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-12 w-full max-h-[55vh] overflow-y-auto custom-scrollbar p-3 bg-[#0a0a0a]/50 rounded-3xl border border-[#252839]">
                        {winningItems.map((winItem, idx) => (
                             <PetVisualCard key={idx} item={winItem} chance={0} />
                        ))}
                    </div>
                    
                    <div className="text-2xl font-black text-white mb-10 flex items-center gap-4 bg-[#111827] border-2 border-[#374151] px-10 py-5 rounded-3xl shadow-2xl relative z-10">
                        Total Value: <span className="text-cyan-400 flex items-center gap-2"><GreenCoin cls="w-8 h-8"/> {formatValue(winningItems.reduce((acc, curr) => acc + (curr.valor||0), 0))}</span>
                    </div>

                    <div className="flex gap-4 w-full max-w-lg relative z-10">
                        <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="flex-1 bg-[#111827] hover:bg-[#1f2937] border-2 border-[#374151] text-white px-6 py-4 rounded-2xl font-bold uppercase tracking-widest transition-colors shadow-md hover:border-cyan-500/50">
                          Store
                        </button>
                        {isAutoOpen ? (
                            <button onClick={() => setIsAutoOpen(false)} className="flex-1 bg-red-600 hover:bg-red-500 text-white border-none px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(220,38,38,0.4)]">
                                Stop Auto 🛑
                            </button>
                        ) : (
                            <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-6 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_25px_rgba(6,182,212,0.6)]">
                                Spin {quantity} More
                            </button>
                        )}
                    </div>
                </div>
            )}
          </div>
        )}

      </div>
      
      {/* --- ESTILOS VISUALES PREMIUM (JSX GLOBAL) --- */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e14; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }

        // --- SISTEMA DE CARTAS DE MASCOTAS ---

        .pet-card-visual {
            background: #111827;
            border-radius: 1.5rem;
            padding: 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            overflow: hidden;
            width: 100%;
            height: 220px; // Altura estándar en Inspect View
            border: 2px solid transparent;
        }

        .pet-card-visual:not(.is-spinner-item):hover {
            transform: translateY(-8px) scale(1.02);
            box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 20px var(--item-color, #ffffff)40;
            z-index: 10;
        }

        // Ajustes para la ruleta
        .pet-card-visual.is-spinner-item {
            width: 180px; 
            height: 240px;
            box-shadow: inset 0 0 30px rgba(0,0,0,0.5);
            border: 1px solid #252839;
        }
        
        // Ajustes para ruleta múltiple (se calculan dinámicamente en el render pero las clases ayudan)
        .opening-view grid .pet-card-visual.is-spinner-item {
            width: 120px;
            height: 120px;
            border-radius: 1rem;
        }

        // Capas básicas
        .pet-glow-layer {
            position: absolute;
            inset: 0;
            opacity: 0.15;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .pet-card-visual:hover .pet-glow-layer { opacity: 0.4; }

        .pet-info-bar {
            width: 100%;
            text-align: center;
            margin-top: auto;
            border-top: 1px solid rgba(255,255,255,0.08);
            background: rgba(0,0,0,0.4);
            padding: 0.75rem 0.5rem;
            z-index: 10;
            border-radius: 0 0 1rem 1rem;
        }

        .pet-name {
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-size: 0.8rem;
            color: white;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
        }

        .pet-value {
            color: #8f9ac6;
            font-size: 0.7rem;
            font-weight: 700;
            margin-top: 0.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
        }

        .pet-image-container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 5;
            padding: 0.5rem;
            width: 100%;
        }

        .pet-image {
            width: auto;
            max-width: 85%;
            height: auto;
            max-height: 100%;
            object-contain;
            drop-shadow: 0 10px 20px rgba(0,0,0,0.8);
            transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .pet-card-visual:not(.is-spinner-item):hover .pet-image {
            transform: scale(1.15) rotate(-3deg);
        }

        .pet-chance-badge {
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            background: rgba(0,0,0,0.7);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(5px);
            color: white;
            font-weight: 900;
            font-size: 0.6rem;
            padding: 0.25rem 0.6rem;
            border-radius: 2rem;
            z-index: 15;
            letter-spacing: 0.05em;
        }

        // --- ESTILOS POR RAREZA Y VARIANTES ---

        // 1. Standard
        .rarity-standard .pet-glow-layer {
            background: radial-gradient(circle at center, var(--item-color, #ffffff) 0%, transparent 70%);
        }
        .rarity-standard:not(.is-spinner-item) {
             border-color: rgba(255,255,255,0.05);
        }
        .rarity-standard .pet-name { color: var(--item-color, white); }

        // 2. Shiny ⚡ (Destellos cian)
        .rarity-shiny {
            border-color: #00FFFF30;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 10px #00FFFF10;
        }
        .rarity-shiny .pet-glow-layer {
            background: radial-gradient(circle at center, #00FFFF 0%, transparent 75%);
            opacity: 0.2;
        }
        .rarity-shiny .pet-name { color: #00FFFF; text-shadow: 0 0 10px #00FFFF60; }
        .rarity-shiny .pet-sparkle-overlay {
            position: absolute; inset: 0;
            background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L52 52L50 54L48 52Z" fill="%23fff" fill-opacity="0.5"/%3E%3C/svg%3E');
            opacity: 0.1; animation: shine-sparkle 4s linear infinite;
        }

        // 3. Mythic 🔮 (Mágico Carmesí)
        .rarity-mythic {
            border-color: #DC143C30;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 10px #DC143C10;
        }
        .rarity-mythic .pet-glow-layer {
            background: radial-gradient(circle at center, #DC143C 0%, #300000 80%, transparent 100%);
            opacity: 0.25;
        }
        .rarity-mythic .pet-name { color: #FF4D6D; text-shadow: 0 0 12px #DC143C70; }
        .rarity-mythic:not(.is-spinner-item):hover { animation: breathe-mythic 1.5s ease-in-out infinite; }

        // 4. Shiny Mythic 🌟 (Iridiscente)
        .rarity-shiny-mythic {
            border-color: #fff2;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            background: linear-gradient(135deg, #111827 0%, #1a1a2e 100%);
        }
        .rarity-shiny-mythic .pet-glow-layer {
            background: radial-gradient(circle at center, #00FFFF 0%, #DC143C 40%, transparent 80%);
            opacity: 0.3;
        }
        .rarity-shiny-mythic:after { // Borde iridiscente
            content: ''; position: absolute; inset: -1px; background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
            z-index: -1; border-radius: 1.5rem; opacity: 0.3; animation: rainbow-rotate 5s linear infinite;
        }
        .rarity-shiny-mythic .pet-name { 
            background: linear-gradient(90deg, #FF69B4, #00FFFF, #FF69B4);
            -webkit-background-clip: text; background-clip: text; color: transparent;
            text-shadow: 0 0 10px rgba(255,255,255,0.3); animation: rainbow-rotate 5s linear infinite; background-size: 200% 100%;
        }

        // 5. !!! XL !!! 🏆 (Los más raros - VIP)
        .rarity-xl {
            border: 3px solid transparent;
            background: linear-gradient(135deg, #1a1608 0%, #0a0a0a 100%);
            box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 0 20px #FFD70015;
        }
        
        .rarity-xl:before { // Borde dorado animado
            content: ''; position: absolute; inset: -3px; border-radius: 1.5rem;
            background: linear-gradient(135deg, #8a6e12 0%, #FFD700 30%, #fff8d1 50%, #FFD700 70%, #8a6e12 100%);
            animation: gradient-shift 3s ease infinite; background-size: 400% 400%; z-index: -1;
        }

        .rarity-xl .pet-glow-layer {
            background: radial-gradient(circle at center, #FFD700 0%, transparent 75%);
            opacity: 0.35;
        }

        .rarity-xl .pet-name { 
            color: #FFD700; text-shadow: 0 0 15px #FFD700, 0 2px 4px rgba(0,0,0,0.5); 
            font-size: 1rem; // Un poco más grande
        }
        
        // Partículas XL
        .xl-particle-effect {
            position: absolute; inset: 0;
            background-image: radial-gradient(#FFD700 1px, transparent 1px);
            background-size: 15px 15px; opacity: 0.1; animation: particles-rise 4s linear infinite;
        }
        
        .rarity-xl:not(.is-spinner-item):hover { animation: wobble-xl 0.6s ease-in-out; }

        // --- EFECTO PARA LOW PERCENTAGE (< 1%) ---
        
        .pet-card-visual.is-rare .pet-glow-layer {
            opacity: 0.5; // Más intenso por defecto
        }
        .pet-card-visual.is-rare .pet-image {
             filter: drop-shadow(0 0 15px var(--item-color, #ffffff)60);
        }
        .pet-card-visual.is-rare:hover .pet-glow-layer { opacity: 0.8; }
        
        .pet-card-visual.is-rare .pet-chance-badge {
            background: #ff4d4d30; border-color: #ff4d4d60; color: #ff9999;
            box-shadow: 0 0 10px #ff4d4d; animation: pulse-rare-badge 1s infinite;
        }

        // Ajustes para ruleta múltiple (redefinir tamaños)
        .grid .pet-card-visual.is-spinner-item {
            width: 128px;
            height: 120px;
            border-radius: 1rem;
        }
        .grid .is-spinner-item .pet-name { font-size: 0.6rem; }
        .grid .is-spinner-item .pet-image { max-width: 65%; }
        .grid .is-spinner-item .pet-value { display: none; }
        .grid .is-spinner-item .pet-info-bar { padding: 0.3rem; }


        // --- ANIMACIONES ---

        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        .animate-epic-reveal { animation: epicReveal 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        
        @keyframes shine-sparkle {
            0% { background-position: 0 0; }
            100% { background-position: 100px 100px; }
        }

        @keyframes breathe-mythic {
            0%, 100% { box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 10px #DC143C20; transform: translateY(-8px) scale(1.02); }
            50% { box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px #DC143C40; transform: translateY(-8px) scale(1.04); }
        }

        @keyframes rainbow-rotate {
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
        }

        @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        @keyframes particles-rise {
            0% { background-position: 0 0; opacity: 0.1; }
            50% { opacity: 0.3; }
            100% { background-position: 0 -100px; opacity: 0; }
        }
        
        @keyframes wobble-xl {
            0%, 100% { transform: translateY(-8px) scale(1.02); }
            25% { transform: translateY(-8px) rotate(-1deg) scale(1.03); }
            75% { transform: translateY(-8px) rotate(1deg) scale(1.03); }
        }
        
        @keyframes pulse-rare-badge {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes epicReveal {
          0% { opacity: 0; transform: scale(0.1) rotate(-10deg); filter: brightness(2) contrast(2); }
          50% { transform: scale(1.1) rotate(3deg); filter: brightness(1.3) contrast(1.3); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: brightness(1) contrast(1); }
        }
        
        // Corrección visual para el puntero de la ruleta
        .opening-view h2 { text-shadow: 0 0 15px white, 0 2px 10px cyan; }
        .opening-view:after { // Efecto de foco central
            content:''; position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 30%, #0b0e14 70%); z-index: 5; pointer-events: none;
        }
      `}</style>
    </div>
  );
}
