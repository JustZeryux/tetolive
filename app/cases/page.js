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

// --- COMPONENTE VISUAL REUTILIZABLE (MEJORADO) ---
const PetVisualCard = ({ item, chance, isSpinner = false, isResult = false }) => {
  const variants = getPetVariants(item.name);
  const rarityClass = getRarityClass(variants);
  const isRare = chance > 0 && chance < 1; // Menos de 1% es raro

  // Clases dinámicas: Agregamos is-result-item para la victoria masiva
  const cardClasses = `pet-card-visual ${rarityClass} ${isRare ? 'is-rare' : ''} ${isSpinner ? 'is-spinner-item' : ''} ${isResult ? 'is-result-item' : ''}`;
  
  return (
    <div className={cardClasses} style={{ '--item-color': item.color || '#ffffff' }}>
      {/* Capas de Brillo y Efectos */}
      <div className="pet-glow-layer"></div>
      <div className="pet-sparkle-overlay"></div>
      {variants.isXL && <div className="xl-particle-effect"></div>}

      {/* Chance Badge (Solo si no es ruleta y no es resultado final) */}
      {!isSpinner && !isResult && chance != null && (
        <div className="pet-chance-badge shadow-lg">
          {chance.toFixed(variants.isXL || chance < 0.1 ? 2 : 1)}%
        </div>
      )}

      {/* Imagen con animación de levitación */}
      <div className="pet-image-container">
        <img src={item.img || item.image_url} alt={item.name} className={`pet-image ${isResult ? 'animate-epic-float' : ''}`} />
      </div>

      {/* Info Bar (Nombre y Valor) */}
      <div className="pet-info-bar">
        <p className="pet-name">{item.name}</p>
        {!isSpinner && (
            <p className="pet-value">
            <GreenCoin cls="w-3 h-3 grayscale opacity-70"/> {formatValue(item.valor || item.value || 0)}
            </p>
        )}
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

  // --- useEffect OPTIMIZADO Y 100% SEGURO (CON PAGINACIÓN) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Auth & Profile
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          setCurrentUser(userData.user);
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
          setUserProfile(profile);
        }

        // 2. Cases
        const { data: dbCases, error: casesError } = await supabase.from('cases').select('*');
        if (casesError) throw casesError;
        
        let formatCases = [];
        if (dbCases) {
          formatCases = dbCases.map(c => ({
            id: c.id, name: c.name, price: c.price, img: c.image_url,
            color: c.color, shadow: c.shadow, items: c.items
          }));
        }

        // 3. LA SOLUCIÓN: Descargar TODO el catálogo en páginas de 1000 en 1000
        let allItems = [];
        let start = 0;
        const pageSize = 1000;
        let fetchMore = true;

        while (fetchMore) {
          const { data, error } = await supabase.from('items').select('*').range(start, start + pageSize - 1);
          if (error) throw error;
          
          if (data && data.length > 0) {
            allItems = [...allItems, ...data];
            start += pageSize;
            if (data.length < pageSize) fetchMore = false; 
          } else {
            fetchMore = false;
          }
        }

        // 4. Mapeo a prueba de balas (por ID y por Nombre minúscula)
        let itemMap = {};
        allItems.forEach(i => {
          if (i.id) itemMap[i.id] = i; 
          if (i.name) itemMap[i.name.toLowerCase().trim()] = i; 
        });

        setDbItemsMap(itemMap);
        setCasesData(formatCases);
        
      } catch (error) {
        console.error("🚨 Error crítico cargando la base de datos:", error);
      } finally {
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
              item_id: winner.id || `old-${winner.name}`, 
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
                el.style.transition = `transform ${spinDuration}s cubic-bezier(0.1, 0.9, 0.2, 1)`; // Curva más dramática
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
            setTimeout(() => flash.style.opacity = "0.8", 10);
            setTimeout(() => {
              flash.style.opacity = "0";
              setTimeout(() => flash.remove(), 400);
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
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(108,99,255,0.15)_0%,transparent_70%)] animate-pulse"></div>
      <div className="w-20 h-20 border-4 border-[#6C63FF] border-t-transparent border-b-[#00FFFF] rounded-full animate-spin mb-6 shadow-[0_0_30px_#6C63FF]"></div>
      <p className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-[#6C63FF] uppercase tracking-[0.3em] animate-pulse">Loading Database...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* Fondo Base Épico */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[600px] bg-gradient-to-b from-[#6C63FF]/20 to-transparent blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-0 left-0 w-full h-[300px] bg-gradient-to-t from-cyan-900/10 to-transparent pointer-events-none z-0"></div>
      
      {showNoMoneyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/70">
          <div className="bg-[#1a1d29] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_60px_rgba(239,68,68,0.3)] animate-bounce-in relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
            <div className="flex justify-center mb-4 text-6xl relative z-10 animate-shake">⚠️</div>
            <h2 className="text-2xl font-black text-center uppercase mb-2 relative z-10">Insufficient Balance</h2>
            <p className="text-[#8f9ac6] text-center mb-6 relative z-10">You don't have enough coins for this case.</p>
            <div className="bg-[#0b0e14] rounded-2xl p-4 mb-6 border border-[#252839] relative z-10">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Your Balance:</span>
                <span className="font-bold text-white"><GreenCoin/> {userProfile?.saldo_verde?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between border-t border-[#252839] pt-2">
                <span className="text-xs font-bold uppercase text-[#4a506b]">Total Price:</span>
                <span className="font-bold text-red-400"><GreenCoin/> {moneyNeeded.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => setShowNoMoneyModal(false)} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.4)] relative z-10 hover:scale-105 active:scale-95">
              Understood
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1200px] mx-auto relative z-10">

        {/* --- STORE VIEW --- */}
        {view === 'store' && (
          <div className="animate-fade-in-up">
            <div className="text-center mb-12 mt-6">
              <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-100 to-[#6C63FF] uppercase tracking-[0.1em] drop-shadow-[0_0_25px_rgba(108,99,255,0.6)] mb-4 animate-float-slow">
                Premium Cases
              </h1>
              <p className="text-[#8f9ac6] font-bold text-lg md:text-xl tracking-widest uppercase shadow-black drop-shadow-md">Test your luck and win the rarest items.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-[#11131a]/80 backdrop-blur-xl border border-[#2a2d42] rounded-3xl p-5 mb-12 gap-5 shadow-[0_15px_40px_rgba(0,0,0,0.6)]">
              <div className="relative w-full md:w-1/2 group">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8f9ac6] group-focus-within:text-cyan-400 transition-colors text-xl">🔍</span>
                <input 
                  type="text" placeholder="Search case by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0b0e14] border-2 border-[#252839] text-white rounded-2xl py-4 pl-14 pr-4 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all font-bold text-lg placeholder:text-[#4a506b]"
                />
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto bg-[#0b0e14] p-2 rounded-2xl border border-[#252839]">
                <span className="text-[#8f9ac6] font-black uppercase text-xs tracking-widest pl-3">Sort:</span>
                <select 
                  value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-white font-bold py-2 px-4 focus:outline-none cursor-pointer w-full md:w-auto outline-none appearance-none hover:text-cyan-400 transition-colors"
                >
                  <option value="price_asc" className="bg-[#11131a]">Low to High</option>
                  <option value="price_desc" className="bg-[#11131a]">High to Low</option>
                  <option value="name_asc" className="bg-[#11131a]">A - Z</option>
                </select>
              </div>
            </div>

            {filteredAndSortedCases.length === 0 ? (
              <div className="text-center py-24 text-[#8f9ac6] text-2xl font-black bg-[#11131a]/50 rounded-[3rem] border-2 border-[#252839] border-dashed uppercase tracking-widest">
                  😔 NO CASES FOUND matching "{searchTerm}"
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredAndSortedCases.map((caja, index) => (
                  <div key={caja.id} onClick={() => { setSelectedCase(caja); setQuantity(1); setView('inspect'); }} 
                       className="bg-gradient-to-b from-[#1a1c29] to-[#0a0a0a] rounded-[2rem] p-1.5 flex flex-col items-center cursor-pointer transition-all duration-500 hover:-translate-y-4 hover:scale-[1.02] border-2 border-[#2a2d42] hover:border-cyan-400 hover:shadow-[0_20px_50px_rgba(6,182,212,0.25)] group relative overflow-hidden h-full"
                       style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="absolute inset-1 rounded-[1.8rem] opacity-20 group-hover:opacity-50 transition-opacity duration-700 z-0 overflow-hidden pointer-events-none">
                        <div className="w-[200%] h-[200%] absolute -top-1/2 -left-1/2 animate-spin-slow-reverse" style={{ background: `radial-gradient(circle at center, ${caja.color} 0%, transparent 60%)` }}></div>
                    </div>
                    
                    <div className="w-full flex-1 flex flex-col items-center justify-center p-8 bg-[#0b0e14]/80 rounded-t-[1.5rem] z-10 relative overflow-hidden">
                        <div className="absolute inset-0 rounded-full blur-[40px] opacity-20 group-hover:opacity-70 group-hover:scale-150 transition-all duration-700 pointer-events-none" style={{ backgroundColor: caja.color }}></div>
                        <img src={caja.img} alt={caja.name} className="w-48 h-48 object-contain relative z-10 drop-shadow-[0_20px_25px_rgba(0,0,0,0.9)] group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 animate-float-box" />
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest z-10 mt-8 text-center line-clamp-1 w-full" style={{textShadow: `0 4px 10px rgba(0,0,0,0.9)`}}>{caja.name}</h3>
                    </div>
                    
                    <div className="w-full bg-[#0b0e14] rounded-b-[1.5rem] py-5 px-5 border-t border-[#2a2d42] group-hover:border-cyan-500/50 transition-colors z-10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors"></div>
                        <button className="bg-[#1a1c29] group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600 text-white border border-[#374151] group-hover:border-transparent px-6 py-3 rounded-xl text-xl font-black flex items-center justify-center gap-3 transition-all duration-300 w-full shadow-lg group-hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]">
                          <GreenCoin cls="w-6 h-6"/> {formatValue(caja.price)}
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- INSPECT VIEW --- */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in-up">
            <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="text-[#8f9ac6] hover:text-white font-black text-sm flex items-center gap-3 transition-colors mb-8 bg-[#11131a] px-6 py-3 rounded-xl border border-[#2a2d42] w-max shadow-lg hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] uppercase tracking-widest">
                &lsaquo; RETURN TO STORE
            </button>
            <div className="flex flex-col lg:flex-row gap-10 items-start">
              
              <div className="w-full lg:w-1/3 bg-gradient-to-b from-[#11131a] to-[#0a0a0a] border-2 border-[#2a2d42] rounded-[2.5rem] p-8 flex flex-col items-center relative overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] group">
                <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${selectedCase.color} 0%, transparent 80%)` }}></div>
                
                <div className="relative w-full flex justify-center mb-10 mt-6">
                    <div className="absolute w-40 h-40 rounded-full blur-[50px] opacity-70 z-0 animate-pulse" style={{ backgroundColor: selectedCase.color }}></div>
                    <img src={selectedCase.img} className="w-64 h-64 object-contain z-10 drop-shadow-[0_30px_40px_rgba(0,0,0,0.9)] animate-float-box group-hover:scale-110 transition-transform duration-500" alt={selectedCase.name} />
                </div>
                
                <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] z-10 mb-8 text-center" style={{textShadow: `0 4px 20px ${selectedCase.color}`}}>{selectedCase.name}</h2>
                
                <div className="w-full mb-8 z-10 bg-[#0b0e14] p-5 rounded-3xl border border-[#2a2d42]">
                    <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest text-center mb-4">Select Amount</p>
                    <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(q => (
                            <button
                                key={q} onClick={() => setQuantity(q)}
                                className={`py-2 rounded-xl font-black transition-all text-sm ${quantity === q ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-110 border border-cyan-300' : 'bg-[#1a1c29] text-[#8f9ac6] border border-[#2a2d42] hover:border-cyan-500/50 hover:text-white'}`}
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-8 mt-6 w-full pt-4 border-t border-[#2a2d42]">
                        <label className="flex items-center gap-3 cursor-pointer group/toggle">
                            <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isFastRoll ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-[#1a1c29] border border-[#374151]'}`}>
                                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm ${isFastRoll ? 'left-6' : 'left-1'}`}></div>
                            </div>
                            <span className="text-white font-black text-xs uppercase tracking-widest group-hover/toggle:text-cyan-400 transition-colors">Fast ⚡</span>
                            <input type="checkbox" className="hidden" checked={isFastRoll} onChange={e => setIsFastRoll(e.target.checked)} />
                        </label>
                        
                        <label className="flex items-center gap-3 cursor-pointer group/toggle">
                            <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isAutoOpen ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-[#1a1c29] border border-[#374151]'}`}>
                                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm ${isAutoOpen ? 'left-6' : 'left-1'}`}></div>
                            </div>
                            <span className="text-white font-black text-xs uppercase tracking-widest group-hover/toggle:text-purple-400 transition-colors">Auto 🔄</span>
                            <input type="checkbox" className="hidden" checked={isAutoOpen} onChange={e => setIsAutoOpen(e.target.checked)} />
                        </label>
                    </div>
                </div>

                <button onClick={openCase} disabled={spinning} className="w-full py-5 rounded-2xl font-black text-2xl text-white uppercase tracking-widest shadow-[0_10px_30px_rgba(6,182,212,0.4)] hover:shadow-[0_15px_40px_rgba(6,182,212,0.7)] transition-all hover:-translate-y-1 bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center gap-4 z-10 active:scale-95">
                  OPEN {quantity > 1 ? `x${quantity}` : ''} <span className="opacity-50">|</span> <GreenCoin cls="w-7 h-7"/> {formatValue(selectedCase.price * quantity)}
                </button>
              </div>

              {/* Case Contents */}
              <div className="w-full lg:w-2/3 bg-gradient-to-b from-[#11131a] to-[#0a0a0a] border-2 border-[#2a2d42] rounded-[2.5rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.6)] relative overflow-hidden">
                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-[0.2em] mb-8 border-b-2 border-[#2a2d42] pb-6 flex items-center gap-4">
                  <span className="text-cyan-500 text-4xl">📦</span> Contents
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {selectedCase.items.map((rawItem, idx) => {
                    const dbItem = getRealItemData(rawItem);
                    if (!dbItem) return null; 

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

        {/* --- OPENING VIEW (SPINNER ÉPICO) --- */}
        {view === 'opening' && (
          <div className="animate-fade-in flex flex-col items-center justify-center min-h-[70vh] relative">
            {/* Efecto de velocidad en el fondo */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-30">
                 <div className="speed-lines"></div>
            </div>

            <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-[0.3em] mb-16 drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] z-10 unboxing-text animate-pulse">
              Rolling...
            </h2>
            
            <div className={`flex flex-col gap-6 w-full max-w-[1100px] z-10 ${quantity > 5 ? 'grid grid-cols-2' : ''}`}>
                {spinnerTracks.map((track, trackIdx) => {
                    const isMulti = quantity > 1;
                    const containerHeight = isMulti ? "h-[150px]" : "h-[300px]";

                    return (
                        <div key={trackIdx} className={`relative w-full ${containerHeight} bg-[#040508] border-y-4 border-[#1f2937] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] rounded-[2rem] flex items-center`}>
                          {/* Sombras Laterales */}
                          <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-[#040508] via-[#040508]/80 to-transparent z-20 pointer-events-none"></div>
                          <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-[#040508] via-[#040508]/80 to-transparent z-20 pointer-events-none"></div>
                          
                          {/* Puntero Láser Neón */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-cyan-400 z-30 shadow-[0_0_30px_4px_rgba(34,211,238,1)] -translate-x-1/2 pointer-events-none flex flex-col justify-between items-center">
                              <div className="w-6 h-6 bg-cyan-400 rotate-45 -mt-3 shadow-[0_0_20px_rgba(34,211,238,1)]"></div>
                              <div className="w-6 h-6 bg-cyan-400 rotate-45 -mb-3 shadow-[0_0_20px_rgba(34,211,238,1)]"></div>
                          </div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent z-20 -translate-x-1/2 pointer-events-none"></div>
                          
                          <div className="absolute top-0 bottom-0 left-1/2 flex items-center w-max z-10">
                            <div ref={el => slidersRef.current[trackIdx] = el} className="flex items-center h-full will-change-transform sliders-container">
                              {track.map((item, idx) => (
                                <div key={idx} className="shrink-0 mx-2">
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

        {/* --- RESULT VIEW (RESULTADOS MASIVOS) --- */}
        {view === 'result' && winningItems.length > 0 && (
          <div className={`w-full flex flex-col items-center justify-center min-h-[75vh] relative z-20 ${hasLimitedWin ? 'animate-epic-reveal' : 'animate-bounce-in-up'}`}>
            
            {/* Efectos de fondo para victorias */}
            <div className="fixed inset-0 bg-black/80 z-0 animate-fade-in pointer-events-none backdrop-blur-sm"></div>
            {hasLimitedWin && (
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                    <div className="w-[150vw] h-[150vw] rounded-full bg-gradient-to-tr from-yellow-600/40 via-yellow-400/10 to-transparent animate-spin-slow blur-[100px]"></div>
                    <div className="absolute w-full h-full bg-yellow-500/10 animate-pulse-fast particles-bg"></div>
                </div>
            )}
            {!hasLimitedWin && (
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                    <div className="absolute w-full h-full bg-cyan-500/5 animate-pulse particles-bg"></div>
                </div>
            )}

            <h2 className={`text-5xl md:text-7xl font-black uppercase tracking-[0.3em] mb-16 z-10 text-center ${hasLimitedWin ? 'text-yellow-400 drop-shadow-[0_0_40px_rgba(250,204,21,0.9)] animate-pulse' : 'text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.7)]'}`}>
              {hasLimitedWin ? '🌟 LEGENDARY WIN! 🌟' : (quantity > 1 ? 'Items Unboxed!' : 'Item Unboxed!')}
            </h2>
            
            {quantity === 1 ? (
                // --- GANANCIA ÚNICA (TARJETA GIGANTE isResult=true) ---
                <div className="z-10 w-full flex flex-col items-center">
                    <PetVisualCard item={winningItems[0]} chance={0} isResult={true} /> 
                    
                    <div className="flex gap-6 w-full mt-16 relative z-10 max-w-lg">
                        <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="flex-1 bg-[#11131a] hover:bg-[#1a1c29] border-2 border-[#374151] text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:-translate-y-1">
                          STORE
                        </button>
                        {isAutoOpen ? (
                            <button onClick={() => setIsAutoOpen(false)} className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border-none px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(220,38,38,0.5)] hover:shadow-[0_0_30px_rgba(220,38,38,0.7)] hover:-translate-y-1">
                                STOP 🛑
                            </button>
                        ) : (
                            <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] hover:-translate-y-1">
                                SPIN AGAIN
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                // --- GANANCIA MÚLTIPLE (GRID) ---
                <div className="flex flex-col items-center w-full max-w-[1200px] z-10 animate-fade-in-up">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-12 w-full max-h-[55vh] overflow-y-auto custom-scrollbar p-5 bg-[#0a0a0a]/70 backdrop-blur-md rounded-[2.5rem] border-2 border-[#2a2d42] shadow-[0_30px_60px_rgba(0,0,0,0.8)]">
                        {winningItems.map((winItem, idx) => (
                             <PetVisualCard key={idx} item={winItem} chance={0} />
                        ))}
                    </div>
                    
                    <div className="text-3xl font-black text-white mb-12 flex items-center gap-5 bg-gradient-to-r from-[#11131a] to-[#1a1c29] border-2 border-[#374151] px-12 py-6 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.7)] relative z-10">
                        TOTAL VALUE: <span className="text-cyan-400 flex items-center gap-3 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]"><GreenCoin cls="w-10 h-10"/> {formatValue(winningItems.reduce((acc, curr) => acc + (curr.valor||0), 0))}</span>
                    </div>

                    <div className="flex gap-6 w-full max-w-xl relative z-10">
                        <button onClick={() => { setView('store'); setIsAutoOpen(false); }} className="flex-1 bg-[#11131a] hover:bg-[#1a1c29] border-2 border-[#374151] text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:border-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:-translate-y-1">
                          STORE
                        </button>
                        {isAutoOpen ? (
                            <button onClick={() => setIsAutoOpen(false)} className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border-none px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(220,38,38,0.5)] hover:-translate-y-1">
                                STOP 🛑
                            </button>
                        ) : (
                            <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-[0_15px_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] hover:-translate-y-1">
                                SPIN {quantity} MORE
                            </button>
                        )}
                    </div>
                </div>
            )}
          </div>
        )}

      </div>
      
      {/* --- ESTILOS VISUALES PREMIUM Y ANIMACIONES --- */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e14; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; border: 2px solid #0b0e14; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }

        /* --- SISTEMA DE CARTAS DE MASCOTAS --- */
        .pet-card-visual {
            background: #11131a;
            border-radius: 1.5rem;
            padding: 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            overflow: hidden;
            width: 100%;
            height: 230px; 
            border: 2px solid transparent;
        }

        .pet-card-visual:not(.is-spinner-item):not(.is-result-item):hover {
            transform: translateY(-10px) scale(1.03);
            box-shadow: 0 25px 50px rgba(0,0,0,0.8), 0 0 25px var(--item-color, #ffffff)40;
            z-index: 10;
        }

        /* --- LA TARJETA GIGANTE DEL RESULTADO (EL FIX) --- */
        .pet-card-visual.is-result-item {
            width: 280px !important;
            height: 380px !important;
            border-radius: 2rem;
            box-shadow: 0 30px 60px rgba(0,0,0,0.9), 0 0 60px var(--item-color, #ffffff)50;
            border: 3px solid var(--item-color, #ffffff)80;
            animation: epic-float 4s ease-in-out infinite;
            z-index: 50;
            background: linear-gradient(180deg, rgba(17,19,26,0.9) 0%, rgba(10,10,10,0.95) 100%);
        }
        
        .pet-card-visual.is-result-item .pet-image {
            max-width: 95%;
            max-height: 180px;
            filter: drop-shadow(0 20px 25px rgba(0,0,0,0.9)) drop-shadow(0 0 30px var(--item-color, #ffffff)60);
        }
        
        .pet-card-visual.is-result-item .pet-name {
            font-size: 1.5rem;
            line-height: 1.4;
            padding-bottom: 0.5rem;
        }
        
        .pet-card-visual.is-result-item .pet-info-bar {
            padding: 1.5rem 1rem;
            border-radius: 0 0 1.8rem 1.8rem;
            background: rgba(0,0,0,0.6);
            border-top: 2px solid var(--item-color, #ffffff)40;
        }

        /* Ajustes para la ruleta */
        .pet-card-visual.is-spinner-item {
            width: 190px; 
            height: 260px;
            box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
            border: 1px solid #2a2d42;
            background: #0a0a0a;
        }
        
        .opening-view grid .pet-card-visual.is-spinner-item {
            width: 130px;
            height: 130px;
            border-radius: 1.2rem;
        }

        /* Capas básicas */
        .pet-glow-layer {
            position: absolute; inset: 0; opacity: 0.15; transition: opacity 0.4s; pointer-events: none;
        }
        .pet-card-visual:not(.is-result-item):hover .pet-glow-layer { opacity: 0.5; }
        .pet-card-visual.is-result-item .pet-glow-layer { opacity: 0.6; }

        .pet-info-bar {
            width: 100%; text-align: center; margin-top: auto;
            border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.5);
            padding: 0.75rem 0.5rem; z-index: 10; border-radius: 0 0 1.3rem 1.3rem;
            backdrop-filter: blur(10px);
        }

        .pet-name {
            font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.85rem;
            color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;
        }

        .pet-value {
            color: #8f9ac6; font-size: 0.75rem; font-weight: 900; margin-top: 0.4rem;
            display: flex; align-items: center; justify-content: center; gap: 0.3rem;
        }

        .pet-image-container {
            flex: 1; display: flex; align-items: center; justify-content: center;
            position: relative; z-index: 5; padding: 0.5rem; width: 100%;
        }

        .pet-image {
            width: auto; max-width: 85%; height: auto; max-height: 100%; object-contain;
            drop-shadow: 0 15px 25px rgba(0,0,0,0.9); transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .pet-card-visual:not(.is-spinner-item):not(.is-result-item):hover .pet-image {
            transform: scale(1.2) rotate(-5deg);
        }

        .pet-chance-badge {
            position: absolute; top: 0.75rem; right: 0.75rem; background: rgba(0,0,0,0.8);
            border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(5px);
            color: white; font-weight: 900; font-size: 0.65rem; padding: 0.3rem 0.7rem;
            border-radius: 2rem; z-index: 15; letter-spacing: 0.05em;
        }

        /* --- RAREZAS --- */
        .rarity-standard .pet-glow-layer { background: radial-gradient(circle at center, var(--item-color, #ffffff) 0%, transparent 70%); }
        .rarity-standard:not(.is-spinner-item) { border-color: rgba(255,255,255,0.05); }
        .rarity-standard .pet-name { color: var(--item-color, white); }

        /* Shiny ⚡ */
        .rarity-shiny { border-color: #00FFFF40; box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px #00FFFF20; }
        .rarity-shiny .pet-glow-layer { background: radial-gradient(circle at center, #00FFFF 0%, transparent 75%); opacity: 0.25; }
        .rarity-shiny .pet-name { color: #00FFFF; text-shadow: 0 0 12px #00FFFF80; }
        .rarity-shiny .pet-sparkle-overlay {
            position: absolute; inset: 0; background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L52 52L50 54L48 52Z" fill="%23fff" fill-opacity="0.5"/%3E%3C/svg%3E');
            opacity: 0.15; animation: shine-sparkle 3s linear infinite;
        }

        /* Mythic 🔮 */
        .rarity-mythic { border-color: #DC143C40; box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px #DC143C20; }
        .rarity-mythic .pet-glow-layer { background: radial-gradient(circle at center, #DC143C 0%, #300000 80%, transparent 100%); opacity: 0.3; }
        .rarity-mythic .pet-name { color: #FF4D6D; text-shadow: 0 0 15px #DC143C90; }
        .rarity-mythic:not(.is-spinner-item):hover { animation: breathe-mythic 1.5s ease-in-out infinite; }

        /* Shiny Mythic 🌟 */
        .rarity-shiny-mythic { border-color: #fff3; box-shadow: 0 15px 40px rgba(0,0,0,0.7); background: linear-gradient(135deg, #11131a 0%, #1a1a2e 100%); }
        .rarity-shiny-mythic .pet-glow-layer { background: radial-gradient(circle at center, #00FFFF 0%, #DC143C 40%, transparent 80%); opacity: 0.35; }
        .rarity-shiny-mythic:after { 
            content: ''; position: absolute; inset: -2px; background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
            z-index: -1; border-radius: 1.5rem; opacity: 0.5; animation: rainbow-rotate 4s linear infinite;
        }
        .rarity-shiny-mythic .pet-name { 
            background: linear-gradient(90deg, #FF69B4, #00FFFF, #FF69B4); -webkit-background-clip: text; background-clip: text; color: transparent;
            text-shadow: 0 0 15px rgba(255,255,255,0.4); animation: rainbow-rotate 4s linear infinite; background-size: 200% 100%;
        }

        /* XL 🏆 */
        .rarity-xl { border: 3px solid transparent; background: linear-gradient(135deg, #1a1608 0%, #050505 100%); box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 30px #FFD70020; }
        .rarity-xl:before {
            content: ''; position: absolute; inset: -3px; border-radius: 1.5rem;
            background: linear-gradient(135deg, #8a6e12 0%, #FFD700 30%, #fff8d1 50%, #FFD700 70%, #8a6e12 100%);
            animation: gradient-shift 3s ease infinite; background-size: 400% 400%; z-index: -1;
        }
        .rarity-xl .pet-glow-layer { background: radial-gradient(circle at center, #FFD700 0%, transparent 75%); opacity: 0.4; }
        .rarity-xl .pet-name { color: #FFD700; text-shadow: 0 0 20px #FFD700, 0 2px 4px rgba(0,0,0,0.8); font-size: 1.1rem; }
        .xl-particle-effect {
            position: absolute; inset: 0; background-image: radial-gradient(#FFD700 1.5px, transparent 1.5px);
            background-size: 20px 20px; opacity: 0.15; animation: particles-rise 3s linear infinite;
        }
        .rarity-xl:not(.is-spinner-item):not(.is-result-item):hover { animation: wobble-xl 0.8s ease-in-out infinite; }

        /* < 1% LOW PERCENTAGE */
        .pet-card-visual.is-rare .pet-glow-layer { opacity: 0.6; }
        .pet-card-visual.is-rare .pet-image { filter: drop-shadow(0 0 20px var(--item-color, #ffffff)70); }
        .pet-card-visual.is-rare .pet-chance-badge {
            background: #ff000040; border-color: #ff4d4d80; color: #ffcccc; box-shadow: 0 0 15px #ff0000; animation: pulse-rare-badge 1s infinite;
        }

        /* --- BACKGROUND SPEED LINES --- */
        .speed-lines {
            position: absolute; top: 0; left: 0; width: 200%; height: 100%;
            background: repeating-linear-gradient(90deg, transparent 0%, transparent 40%, rgba(255,255,255,0.05) 45%, transparent 50%);
            animation: move-lines 0.5s linear infinite;
        }

        /* --- ANIMACIONES GLOBALES --- */
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-bounce-in-up { animation: bounceInUp 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-pulse-fast { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        .animate-spin-slow-reverse { animation: spin 30s linear infinite reverse; }
        .animate-epic-reveal { animation: epicReveal 1.2s cubic-bezier(0.1, 0.9, 0.2, 1) forwards; }
        .animate-float-box { animation: floatBox 4s ease-in-out infinite; }
        .animate-float-slow { animation: floatBox 6s ease-in-out infinite; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        
        @keyframes epic-float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
        }
        @keyframes floatBox { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes move-lines { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes shine-sparkle { 0% { background-position: 0 0; } 100% { background-position: 100px 100px; } }
        @keyframes breathe-mythic {
            0%, 100% { box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 20px #DC143C20; transform: translateY(-10px) scale(1.03); }
            50% { box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 40px #DC143C60; transform: translateY(-10px) scale(1.05); }
        }
        @keyframes rainbow-rotate { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes particles-rise { 0% { background-position: 0 0; opacity: 0.15; } 50% { opacity: 0.4; } 100% { background-position: 0 -100px; opacity: 0; } }
        @keyframes wobble-xl {
            0%, 100% { transform: translateY(-10px) scale(1.03); }
            25% { transform: translateY(-10px) rotate(-2deg) scale(1.04); }
            75% { transform: translateY(-10px) rotate(2deg) scale(1.04); }
        }
        @keyframes pulse-rare-badge { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes bounceInUp { 
            from { opacity: 0; transform: translateY(100px) scale(0.5); } 
            to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes epicReveal {
          0% { opacity: 0; transform: scale(0.1) rotate(-15deg); filter: brightness(3) contrast(2); }
          60% { transform: scale(1.15) rotate(5deg); filter: brightness(1.5) contrast(1.5); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: brightness(1) contrast(1); }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        
        .unboxing-text { text-shadow: 0 0 20px rgba(255,255,255,0.5), 0 0 40px cyan; }
      `}</style>
    </div>
  );
}
