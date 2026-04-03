"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/utils/Supabase';
import PetCard from '@/components/PetCard';

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
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price_asc'); 
  const [view, setView] = useState('store'); 
  const [selectedCase, setSelectedCase] = useState(null);
  
  const [quantity, setQuantity] = useState(1);

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
    const fetchData = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setCurrentUser(userData.user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
        setUserProfile(profile);
      }

      const { data: itemsDbData } = await supabase.from('items').select('name, is_limited, max_quantity, value, image_url, color, id');
      const itemMap = {};
      if(itemsDbData) {
          itemsDbData.forEach(i => itemMap[i.name] = i);
      }
      setDbItemsMap(itemMap);

      const { data: dbCases } = await supabase.from('cases').select('*');
      if (dbCases) {
        const formatCases = dbCases.map(c => ({
          id: c.id, name: c.name, price: c.price, img: c.image_url,
          color: c.color, shadow: c.shadow, items: c.items
        }));
        setCasesData(formatCases);
      }
      setIsLoading(false);
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

  const openCase = async () => {
    if (!currentUser || !userProfile) return alert("Please log in first.");
    if (spinning) return;

    const totalCost = selectedCase.price * quantity;

    if (userProfile.saldo_verde < totalCost) {
      setMoneyNeeded(totalCost);
      setShowNoMoneyModal(true);
      return;
    }
    
    setView('opening');
    setSpinning(true); 
    setHasLimitedWin(false);

    try {
      // --- ANTI-BYPASS FOR LIMITED PETS ---
      const validItemsToRoll = [];
      let totalChance = 0;

      for (let item of selectedCase.items) {
          const dbItem = dbItemsMap[item.name];
          const isLim = dbItem?.is_limited || item.is_limited;
          const maxQ = dbItem?.max_quantity || item.max_quantity;
          
          if (isLim && maxQ) {
              const itemId = dbItem?.id || item.id || item.item_id;
              if (itemId) {
                  const { count } = await supabase
                      .from('inventory')
                      .select('*', { count: 'exact', head: true })
                      .eq('item_id', itemId);
                  
                  if (count >= maxQ) {
                      continue; // Global limit reached, remove from pool
                  }
              }
          }
          validItemsToRoll.push(item);
          totalChance += item.chance;
      }

      if (validItemsToRoll.length === 0) throw new Error("No items available in this case (all reached their global limit).");

      // Recalculate chances
      const normalizedItems = validItemsToRoll.map(item => ({
          ...item,
          chance: (item.chance / totalChance) * 100
      }));
      // ---------------------------------------------------

      const newBalance = userProfile.saldo_verde - totalCost;
      const { error: chargeError } = await supabase.from('profiles').update({ saldo_verde: newBalance }).eq('id', currentUser.id);

      if (chargeError) throw new Error("Failed to deduct balance: " + chargeError.message);

      const winners = [];
      const inventoryInserts = [];
      let foundLimited = false;
      
      for (let i = 0; i < quantity; i++) {
          const rawWinner = getRandomVisualItem(normalizedItems);
          const dbItem = dbItemsMap[rawWinner.name];

          let realItemId = rawWinner.id || rawWinner.item_id || dbItem?.id;
          let isLim = dbItem?.is_limited || rawWinner.is_limited;

          if (!realItemId) {
             const { data: itemData } = await supabase.from('items').select('id, is_limited').eq('name', rawWinner.name).single();
             if (itemData) {
                 realItemId = itemData.id;
                 isLim = itemData.is_limited;
             }
             else {
                 // Rollback balance
                 await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde }).eq('id', currentUser.id);
                 throw new Error(`Could not find real ID for "${rawWinner.name}" in database. Balance refunded.`);
             }
          }
          
          if (isLim) foundLimited = true;

          // Normalize for PetCard compatibility
          const finalWinner = { 
              ...rawWinner, 
              isLimited: isLim,
              id: realItemId,
              valor: rawWinner.valor || rawWinner.value || dbItem?.value || 0,
              img: rawWinner.img || rawWinner.image_url || dbItem?.image_url,
              color: rawWinner.color || dbItem?.color || '#ffffff'
          };
          
          winners.push(finalWinner);
          
          // Secure Inventory Insert Payload
          inventoryInserts.push({ 
              user_id: currentUser.id, 
              item_id: realItemId,
              is_limited: isLim,
              original_owner: isLim ? (userProfile.username || currentUser.email?.split('@')[0] || 'Player') : null
          });
      }

      const { data: insertedInv, error: invError } = await supabase.from('inventory').insert(inventoryInserts).select();

      if (invError) {
          // --- SECURITY ROLLBACK ---
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde }).eq('id', currentUser.id);
          throw new Error("Failed to insert items into inventory. Your balance was refunded. " + invError.message);
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

      setTimeout(() => {
        if (slidersRef.current) {
          slidersRef.current.forEach(el => {
            if (el) {
              el.style.transition = 'none';
              el.style.transform = `translateX(0px)`;
              setTimeout(() => {
                el.style.transition = 'transform 6s cubic-bezier(0.15, 0.85, 0.15, 1)';
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

        // --- EPIC SOUND AND FLASH FOR LIMITEDS ---
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

        supabase.auth.getUser().then(res => {
             supabase.from('profiles').select('*').eq('id', res.data.user.id).single().then(p => {
                 if(p.data) setUserProfile(p.data);
             });
        });
      }, 6500);

    } catch (error) {
      console.error(error);
      alert(error.message);
      setSpinning(false);
      setView('store'); // Return to store on fail
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

        {/* INSPECT VIEW */}
        {view === 'inspect' && selectedCase && (
          <div className="animate-fade-in">
            <button onClick={() => setView('store')} className="text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-2 transition-colors mb-8 bg-[#1c1f2e] px-5 py-2.5 rounded-xl border border-[#252839] w-max shadow-md hover:border-cyan-500/50">
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
                </div>

                <button onClick={openCase} disabled={spinning} className="w-full py-4 rounded-2xl font-black text-xl text-white uppercase tracking-widest shadow-[0_5px_20px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.6)] transition-all hover:-translate-y-1 bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center gap-3 z-10">
                  OPEN {quantity > 1 ? `x${quantity}` : ''} FOR <GreenCoin cls="w-6 h-6"/> {formatValue(selectedCase.price * quantity)}
                </button>
              </div>

              <div className="w-full lg:w-2/3 bg-[#0a0a0a] border-2 border-[#1f2937] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-6 border-b border-[#374151] pb-4">
                  Case Contents
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedCase.items.map((item, idx) => {
                    const isLimitedItem = dbItemsMap[item.name]?.is_limited === true || item.is_limited === true || item.limited === true;

                    return (
                    <div key={idx} className={`bg-[#111827] border-2 rounded-xl p-1 flex flex-col items-center justify-center relative group transition-all hover:-translate-y-1 shadow-md h-40 ${isLimitedItem ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : ''}`} style={!isLimitedItem ? { borderColor: `${item.color}40` } : {}}>
                      <div className="absolute inset-1 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300" style={{ background: `radial-gradient(circle at center, ${isLimitedItem ? '#facc15' : item.color} 0%, transparent 70%)` }}></div>
                      
                      <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20">
                          <span className="text-[10px] font-black uppercase text-white/50 bg-black/60 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">
                              Chance
                          </span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full shadow-sm border ${isLimitedItem ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : ''}`} style={!isLimitedItem ? { backgroundColor: `${item.color}20`, color: item.color, borderColor: `${item.color}50` } : {}}>
                            {item.chance}%
                          </span>
                      </div>
                      
                      {isLimitedItem && (
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center z-0 opacity-20 pointer-events-none">
                              <span className="text-4xl">🌟</span>
                          </div>
                      )}

                      <div className="relative w-full flex-1 flex items-center justify-center mt-6">
                         <div className="absolute w-12 h-12 rounded-full blur-[15px] opacity-30 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: isLimitedItem ? '#facc15' : item.color }}></div>
                         <img src={item.img} className="w-16 h-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform z-10 relative" alt={item.name} />
                      </div>
                      
                      <div className="w-full text-center mt-auto border-t border-[#374151]/50 bg-[#0a0a0a]/50 py-2 px-1 z-10 rounded-b-lg">
                        <p className={`font-black text-[11px] uppercase tracking-wide w-full truncate px-1 ${isLimitedItem ? 'text-yellow-400' : ''}`} style={!isLimitedItem ? {color: item.color} : {}}>{item.name}</p>
                        <p className="text-gray-400 text-[10px] font-bold mt-0.5 flex items-center justify-center gap-1">
                            <GreenCoin cls="w-3 h-3 grayscale opacity-80"/> {formatValue(item.valor || item.value || dbItemsMap[item.name]?.value || 0)}
                        </p>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* OPENING VIEW (SPINNER) */}
        {view === 'opening' && (
          <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] relative">
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-widest mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10">
              Unboxing...
            </h2>
            
            <div className={`flex flex-col gap-4 w-full max-w-[1000px] z-10 ${quantity > 5 ? 'grid grid-cols-2' : ''}`}>
                {spinnerTracks.map((track, trackIdx) => {
                    const isMulti = quantity > 1;
                    const containerHeight = isMulti ? "h-[120px]" : "h-[240px]";
                    const itemWidthClass = isMulti ? "w-[120px] h-[100px]" : "w-[180px] h-[190px]";
                    const imgClass = isMulti ? "w-12 h-12 mt-2" : "w-24 h-24";
                    const textSize = isMulti ? "text-[9px]" : "text-sm";

                    return (
                        <div key={trackIdx} className={`relative w-full ${containerHeight} bg-[#0a0a0a] border-y-4 border-[#1f2937] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-xl flex items-center`}>
                          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0a0a0a] to-transparent z-20 pointer-events-none"></div>
                          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0a0a0a] to-transparent z-20 pointer-events-none"></div>
                          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-cyan-400 z-30 shadow-[0_0_25px_rgba(34,211,238,1)] -translate-x-1/2"></div>
                          
                          <div className="absolute top-0 bottom-0 left-1/2 flex items-center w-max z-10">
                            <div ref={el => slidersRef.current[trackIdx] = el} className="flex items-center h-full will-change-transform">
                              {track.map((item, idx) => (
                                <div key={idx} className={`${itemWidthClass} shrink-0 border border-[#374151]/50 bg-[#111827] rounded-lg mx-1 flex flex-col items-center justify-center relative overflow-hidden`} style={{ boxShadow: `inset 0 0 30px ${item.color}10` }}>
                                  <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${item.color} 0%, transparent 60%)`}}></div>
                                  <img src={item.img} className={`${imgClass} object-contain mb-1 drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)] relative z-10`} alt={item.name} />
                                  <div className="w-full text-center border-t border-[#374151]/50 pt-1 pb-1 relative z-10 bg-[#0a0a0a]/60 mt-auto">
                                    <p className={`font-black ${textSize} uppercase tracking-wide w-full px-1 truncate`} style={{color: item.color}}>{item.name}</p>
                                  </div>
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

        {/* RESULT VIEW */}
        {view === 'result' && winningItems.length > 0 && (
          <div className={`w-full flex flex-col items-center justify-center min-h-[70vh] relative ${hasLimitedWin ? 'animate-epic-reveal' : 'animate-bounce-in'}`}>
            
            {hasLimitedWin && (
                <>
                    <div className="fixed inset-0 bg-black/90 z-0 animate-fade-in pointer-events-none"></div>
                    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
                        <div className="w-[200vw] h-[200vw] rounded-full bg-gradient-to-tr from-yellow-500/20 via-yellow-400/40 to-transparent animate-spin-slow blur-[100px]"></div>
                        <div className="absolute w-full h-full bg-yellow-500/10 animate-pulse"></div>
                    </div>
                </>
            )}

            <h2 className={`text-5xl font-black uppercase tracking-widest mb-10 z-10 ${hasLimitedWin ? 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-pulse' : 'text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]'}`}>
              {hasLimitedWin ? '🌟 LIMITED UNBOXED! 🌟' : (quantity > 1 ? 'Items Unboxed!' : 'Item Unboxed!')}
            </h2>
            
            {quantity === 1 ? (
                // EPIC HUGE REVEAL FOR 1 ITEM
                <div className={`bg-[#0a0a0a]/90 backdrop-blur-xl border-2 rounded-3xl p-12 flex flex-col items-center max-w-md w-full shadow-[0_0_80px_rgba(0,0,0,0.8)] z-10 relative ${hasLimitedWin ? 'border-yellow-500 animate-shake shadow-[0_0_100px_rgba(234,179,8,0.5)] scale-110' : ''}`} style={!hasLimitedWin ? { borderColor: winningItems[0].color, boxShadow: `0 0 50px ${winningItems[0].color}40` } : {}}>
                  <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: `radial-gradient(circle at center, ${hasLimitedWin ? '#eab308' : winningItems[0].color} 0%, transparent 60%)`}}></div>
                  <div className={`absolute -top-6 bg-[#0a0a0a] px-6 py-2 border-2 rounded-full font-black uppercase tracking-widest shadow-lg ${hasLimitedWin ? 'border-yellow-400 text-yellow-400 animate-pulse' : ''}`} style={!hasLimitedWin ? { borderColor: winningItems[0].color, color: winningItems[0].color } : {}}>
                    {hasLimitedWin ? '⭐ LIMITED ⭐' : 'NEW ITEM'}
                  </div>
                  
                  <div className="relative">
                      {hasLimitedWin && <div className="absolute inset-0 bg-yellow-500 blur-[50px] opacity-50 rounded-full animate-pulse"></div>}
                      <img src={winningItems[0].img} className={`w-56 h-56 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] mb-8 relative z-10 ${hasLimitedWin ? 'animate-float' : 'animate-pulse-slow'}`} alt={winningItems[0].name} />
                  </div>
                  
                  <h3 className="text-3xl font-black uppercase text-center mb-2 tracking-widest relative z-10" style={hasLimitedWin ? { color: '#facc15', textShadow: `0 0 30px rgba(250,204,21,0.8)` } : { color: winningItems[0].color, textShadow: `0 0 20px ${winningItems[0].color}80` }}>
                    {winningItems[0].name}
                  </h3>

                  <p className="text-gray-300 font-bold text-lg flex items-center gap-2 mb-10 bg-[#111827] px-4 py-2 rounded-lg border border-[#374151] relative z-10 shadow-inner mt-2">
                    Value: <GreenCoin cls="w-5 h-5 grayscale opacity-80"/> {formatValue(winningItems[0].valor || 0)}
                  </p>
                  
                  <div className="flex gap-4 w-full relative z-10">
                    <button onClick={() => setView('store')} className="flex-1 bg-[#111827] hover:bg-[#1f2937] border border-[#374151] text-white px-6 py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-md hover:border-cyan-500/50">
                      Store
                    </button>
                    <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_25px_rgba(6,182,212,0.6)]">
                      Spin Again
                    </button>
                  </div>
                </div>
            ) : (
                // MULTIPLE ITEMS REVEAL (USING PETCARD)
                <div className="flex flex-col items-center w-full max-w-[1200px] z-10">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-10 w-full max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                        {winningItems.map((winItem, idx) => (
                            <PetCard 
                                key={idx} 
                                item={winItem} 
                                showValue={true} 
                            />
                        ))}
                    </div>
                    
                    <div className="text-xl font-black text-white mb-8 flex items-center gap-3 bg-[#111827] border border-[#374151] px-8 py-4 rounded-2xl shadow-lg relative z-10">
                        Total Value: <span className="text-cyan-400 flex items-center gap-2"><GreenCoin cls="w-6 h-6 grayscale opacity-80"/> {formatValue(winningItems.reduce((acc, curr) => acc + (curr.valor||0), 0))}</span>
                    </div>

                    <div className="flex gap-4 w-full max-w-md relative z-10">
                        <button onClick={() => setView('store')} className="flex-1 bg-[#111827] hover:bg-[#1f2937] border border-[#374151] text-white px-6 py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-md hover:border-cyan-500/50">
                          Store
                        </button>
                        <button onClick={() => openCase()} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border-none px-6 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_5px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_25px_rgba(6,182,212,0.6)]">
                          Spin {quantity} More
                        </button>
                    </div>
                </div>
            )}
          </div>
        )}

      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }

        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-epic-reveal { animation: epicReveal 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.3); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes epicReveal {
          0% { opacity: 0; transform: scale(0.1) rotate(-10deg); filter: brightness(2) contrast(2); }
          50% { transform: scale(1.2) rotate(5deg); filter: brightness(1.5) contrast(1.5); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); filter: brightness(1) contrast(1); }
        }
      `}</style>
    </div>
  );
}
