"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';
import PetCard from '@/components/PetCard';
import { showToast } from '@/components/EpicToasts';

// Visual Components
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export default function WalletPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('inventory'); 
  
  // Real Data States
  const [greenBalance, setGreenBalance] = useState(0);
  const [redBalance, setRedBalance] = useState(0);
  const [inventory, setInventory] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); 
  const [selectedIds, setSelectedIds] = useState(new Set()); 

  // Modal & Animation States
  const [confirmSellModal, setConfirmSellModal] = useState(false);
  const [confirmBuyModal, setConfirmBuyModal] = useState(null);
  const [epicPurchaseData, setEpicPurchaseData] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('highest');

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setLoading(false);
        return;
    }
    setCurrentUser(user);

    const { data: profile } = await supabase.from('profiles').select('saldo_verde, saldo_rojo').eq('id', user.id).single();
    if (profile) {
        setGreenBalance(profile.saldo_verde || 0);
        setRedBalance(profile.saldo_rojo || 0);
    }

    await loadInventory(user.id);
    await loadMarket();
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadInventory = async (uid) => {
    const { data, error } = await supabase
        .from('inventory')
        // Usamos items(*) para evitar que la consulta rechace la petición si te faltan columnas en la tabla items
        .select(`id, item_id, serial_number, original_owner, locked, items (*)`)
        .eq('user_id', uid);
    
    if (error) {
        console.error("Error cargando inventario:", error);
        return;
    }

    if (data) {
        setInventory(data.filter(row => row.items !== null).map(row => ({
            inventoryId: row.id,
            itemId: row.item_id,
            name: row.items.name,
            value: row.items.value || 0,
            image_url: row.items.image_url,
            color: row.items.color || '#9ca3af',
            is_mythic: row.items.is_limited === true || row.items.is_mythic === true,
            is_shiny: row.items.is_shiny === true,
            serial_number: row.serial_number || 0,
            original_owner: row.original_owner || 'Unknown',
            isLocked: row.locked === true 
        })));
    }
  };
  
  const loadMarket = async () => {
    const { data, error } = await supabase
        .from('marketplace')
        // Igualmente usamos items(*) aquí por seguridad
        .select(`id, price, items (*)`);
    
    if (error) {
        console.error("Error cargando el mercado:", error);
        return;
    }

    if (data) {
        setMarketItems(data.filter(row => row.items !== null).map(row => ({
            marketId: row.id,
            itemId: row.items.id,
            name: row.items.name,
            price: row.price,
            value: row.price, 
            image_url: row.items.image_url,
            color: row.items.color || '#9ca3af',
            is_mythic: row.items.is_limited === true || row.items.is_mythic === true,
            is_shiny: row.items.is_shiny === true,
        })));
    }
  };

  const calculateSellFee = (originalValue) => {
    let feePercentage = 0.10; 
    if (originalValue > 1000000) feePercentage = 0.02; 
    else if (originalValue > 500000) feePercentage = 0.04; 
    else if (originalValue > 100000) feePercentage = 0.06; 
    else if (originalValue > 10000) feePercentage = 0.08; 

    const feeAmount = Math.floor(originalValue * feePercentage);
    const sellPrice = originalValue - feeAmount;
    
    return { sellPrice, feePercentage: (feePercentage * 100).toFixed(0) };
  };

  // --- SELECTION & LOCK LOGIC ---
  const toggleSelect = (pet) => {
    if (tab !== 'inventory') return;
    if (pet.isLocked) return;

    const newSet = new Set(selectedIds);
    if (newSet.has(pet.inventoryId)) newSet.delete(pet.inventoryId);
    else newSet.add(pet.inventoryId);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    const availablePets = filteredInventory.filter(p => !p.isLocked);
    
    if (selectedIds.size === availablePets.length && availablePets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availablePets.map(p => p.inventoryId)));
    }
  };

  const toggleLock = async (e, pet) => {
    e.stopPropagation(); 
    if (processing) return;

    const newLockedState = !pet.isLocked;

    // Optimistic UI Update
    setInventory(prev => prev.map(p => p.inventoryId === pet.inventoryId ? {...p, isLocked: newLockedState} : p));
    
    if (newLockedState && selectedIds.has(pet.inventoryId)) {
        const newSet = new Set(selectedIds);
        newSet.delete(pet.inventoryId);
        setSelectedIds(newSet);
    }

    const { error } = await supabase.from('inventory').update({ locked: newLockedState }).eq('id', pet.inventoryId);
    
    if (error) {
        showToast("Error updating lock status.", "error");
        setInventory(prev => prev.map(p => p.inventoryId === pet.inventoryId ? {...p, isLocked: !newLockedState} : p));
    }
  };

  // --- MULTI-SELL LOGIC ---
  const handleSellSelected = async () => {
    if (processing || selectedIds.size === 0) return;
    
    const petsToSell = inventory.filter(p => selectedIds.has(p.inventoryId) && !p.isLocked);
    if(petsToSell.length === 0) return;

    let totalSellPrice = 0;
    let marketInserts = [];

    petsToSell.forEach(pet => {
        const { sellPrice } = calculateSellFee(pet.value);
        totalSellPrice += sellPrice;
        marketInserts.push({ seller_id: currentUser.id, item_id: pet.itemId, price: pet.value });
    });

    setProcessing(true);
    
    try {
      const idsToDelete = Array.from(selectedIds);
      const deleteChunks = chunkArray(idsToDelete, 15);
      
      for (const chunk of deleteChunks) {
          const { error: delError } = await supabase.from('inventory').delete().in('id', chunk);
          if (delError) throw new Error("Database rejected deletion.");
      }

      const insertChunks = chunkArray(marketInserts, 50);
      for (const chunk of insertChunks) {
          await supabase.from('marketplace').insert(chunk);
      }

      const newBalance = greenBalance + totalSellPrice;
      await supabase.from('profiles').update({ saldo_verde: newBalance }).eq('id', currentUser.id);
      
      setGreenBalance(newBalance);
      setSelectedIds(new Set());
      setConfirmSellModal(false);
      
      showToast(`Sale Successful! +${totalSellPrice.toLocaleString()} GC`, "success");
      await fetchData(); 
      
    } catch (error) {
      showToast(`❌ Error: ${error.message}`, "error");
    }
    setProcessing(false);
  };

  // --- MARKET BUY LOGIC ---
  const handleMarketBuy = async () => {
    if (processing || !confirmBuyModal) return;
    const pet = confirmBuyModal;

    if (greenBalance < pet.price) {
        showToast("Insufficient Green Balance.", "error");
        setConfirmBuyModal(null);
        return;
    }

    setProcessing(true);
    try {
      const newBalance = greenBalance - pet.price;
      await supabase.from('profiles').update({ saldo_verde: newBalance }).eq('id', currentUser.id);
      await supabase.from('inventory').insert({ user_id: currentUser.id, item_id: pet.itemId });
      await supabase.from('marketplace').delete().eq('id', pet.marketId);

      setGreenBalance(newBalance);
      setConfirmBuyModal(null);
      
      setEpicPurchaseData(pet);
      await fetchData(); 
    } catch (error) {
      showToast("Error processing purchase.", "error");
    }
    setProcessing(false);
  };

  const filteredInventory = useMemo(() => {
    let result = [...inventory];
    if (search.trim() !== '') result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    result.sort((a, b) => {
        if (sortBy === 'highest') return b.value - a.value;
        if (sortBy === 'lowest') return a.value - b.value;
        if (sortBy === 'limited') return (b.is_mythic ? 1 : 0) - (a.is_mythic ? 1 : 0);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
    });
    return result;
  }, [inventory, search, sortBy]);

  const filteredMarket = useMemo(() => {
    let result = [...marketItems];
    if (search.trim() !== '') result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    
    result.sort((a, b) => {
        if (sortBy === 'highest') return b.price - a.price;
        if (sortBy === 'lowest') return a.price - b.price;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return 0;
    });
    return result;
  }, [marketItems, search, sortBy]);

  const totalInventoryValue = useMemo(() => inventory.reduce((sum, pet) => sum + pet.value, 0), [inventory]);
  const selectedValue = inventory.filter(p => selectedIds.has(p.inventoryId)).reduce((sum, p) => sum + calculateSellFee(p.value).sellPrice, 0);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden font-sans pb-32">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[150px] pointer-events-none z-0"></div>

      {/* --- EPIC PURCHASE MODAL --- */}
      {epicPurchaseData && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in overflow-hidden">
              <div className="absolute top-10 right-10 z-50">
                  <img src="/Affiliates.png" className="w-24 h-24 animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] filter grayscale brightness-200" alt="Backpack" />
              </div>
              <div className="text-[120px] leading-none mb-4 z-10 drop-shadow-[0_0_80px_rgba(34,197,94,0.8)] animate-bounce-slight">✨</div>
              <h2 className="text-5xl md:text-7xl font-black mb-12 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl text-cyan-400">PET ACQUIRED!</h2>
              
              <div className="flex flex-col md:flex-row gap-12 items-center justify-center max-w-4xl z-10 mb-16">
                  <div className="animate-fly-to-backpack drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                      <div className="scale-150 pointer-events-none"><PetCard pet={epicPurchaseData} /></div>
                  </div>
              </div>
              <button onClick={() => setEpicPurchaseData(null)} className="px-16 py-6 bg-white text-black text-2xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:scale-105 z-10 active:scale-95">
                  COLLECT LOOT
              </button>
          </div>
      )}

      {/* --- CONFIRMATION MODALS --- */}
      {confirmSellModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in p-4">
              <div className="bg-[#111] border-2 border-[#333] rounded-[2rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(34,197,94,0.2)] text-center">
                  <h2 className="text-3xl font-black uppercase tracking-widest mb-4">Confirm Sale</h2>
                  <p className="text-gray-400 mb-6 font-bold">Are you sure you want to sell {selectedIds.size} pets to the global market?</p>
                  <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 mb-8">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">You will receive</p>
                      <p className="text-3xl font-black text-[#22c55e] flex items-center justify-center gap-2">
                          <GreenCoin cls="w-8 h-8"/> +{formatValue(selectedValue)}
                      </p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setConfirmSellModal(false)} className="flex-1 py-4 bg-[#222] hover:bg-[#333] rounded-xl font-black uppercase tracking-widest transition-all">Cancel</button>
                      <button onClick={handleSellSelected} disabled={processing} className="flex-1 py-4 bg-[#22c55e] hover:bg-[#16a34a] text-black rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all">Confirm</button>
                  </div>
              </div>
          </div>
      )}

      {confirmBuyModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in p-4">
              <div className="bg-[#111] border-2 border-[#333] rounded-[2rem] p-8 max-w-md w-full shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center">
                  <h2 className="text-3xl font-black uppercase tracking-widest mb-4">Confirm Purchase</h2>
                  <p className="text-gray-400 mb-6 font-bold">Are you sure you want to buy <span className="text-white">{confirmBuyModal.name}</span>?</p>
                  <div className="flex justify-center mb-6 scale-110 pointer-events-none">
                      <PetCard pet={confirmBuyModal} />
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#222] rounded-2xl p-4 mb-8">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Cost</p>
                      <p className="text-3xl font-black text-red-500 flex items-center justify-center gap-2">
                          <GreenCoin cls="w-8 h-8 grayscale opacity-50"/> -{formatValue(confirmBuyModal.price)}
                      </p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setConfirmBuyModal(null)} className="flex-1 py-4 bg-[#222] hover:bg-[#333] rounded-xl font-black uppercase tracking-widest transition-all">Cancel</button>
                      <button onClick={handleMarketBuy} disabled={processing} className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all">Confirm</button>
                  </div>
              </div>
          </div>
      )}

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-8">
            Economy & Vault
          </h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-[#22c55e]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative z-10">
                   <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Green Balance</p>
                   <p className="text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                       <GreenCoin cls="w-7 h-7 animate-pulse-slow"/> {formatValue(greenBalance)}
                   </p>
               </div>
            </div>

            <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-[#ef4444]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative z-10">
                   <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Red Balance</p>
                   <p className="text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                       <RedCoin cls="w-7 h-7 animate-pulse-slow"/> {formatValue(redBalance)}
                   </p>
               </div>
            </div>

            <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 flex flex-col justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-7xl opacity-5 grayscale">🎒</div>
               <p className="text-[#555b82] text-xs font-black uppercase tracking-widest mb-1 relative z-10">Total Inventory Value</p>
               <p className="text-2xl font-black text-[#8f9ac6] flex items-center gap-2 relative z-10">
                   <RedCoin cls="w-6 h-6 grayscale opacity-50"/> {formatValue(totalInventoryValue)}
               </p>
               <p className="text-[#555b82] text-[10px] font-black uppercase mt-1 relative z-10">{inventory.length} items owned</p>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-8 border-b border-[#252839] pb-4 relative z-10">
          <button 
            onClick={() => { setTab('inventory'); setSelectedIds(new Set()); }} 
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm shadow-lg ${tab === 'inventory' ? 'bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:scale-105' : 'bg-[#14151f] text-[#8f9ac6] border border-[#252839] hover:bg-[#1c1f2e] hover:-translate-y-1'}`}
          >
            My Pets ({inventory.length})
          </button>
          <button 
            onClick={() => setTab('market')} 
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm flex items-center gap-2 shadow-lg ${tab === 'market' ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0b0e14] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105' : 'bg-[#14151f] text-[#8f9ac6] border border-[#252839] hover:bg-[#1c1f2e] hover:-translate-y-1'}`}
          >
            Marketplace 🏪
          </button>
        </div>

        {/* MAIN ZONE */}
        <div className="bg-[#14151f]/80 backdrop-blur-xl border border-[#252839] rounded-[2rem] p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] min-h-[500px] relative z-10">
            
            {/* FILTERS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                      {tab === 'inventory' ? 'Inventory' : 'Global Market'}
                      {processing && <span className="w-5 h-5 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin ml-3 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>}
                  </h2>
                  {tab === 'inventory' && filteredInventory.length > 0 && (
                    <button onClick={selectAll} className="text-[#8f9ac6] hover:text-white text-xs font-black uppercase tracking-widest transition-colors bg-[#0b0e14] px-4 py-2 rounded-lg border border-[#252839]">
                      {selectedIds.size === filteredInventory.filter(p => !p.isLocked).length && filteredInventory.filter(p => !p.isLocked).length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                
                <div className="flex w-full md:w-auto gap-3">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555b82]">🔍</span>
                        <input 
                            type="text" placeholder="Search pet..." value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-[#6C63FF] focus:shadow-[0_0_15px_rgba(108,99,255,0.3)] transition-all"
                        />
                    </div>
                    <select 
                        value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#0b0e14] border border-[#252839] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#6C63FF] focus:shadow-[0_0_15px_rgba(108,99,255,0.3)] cursor-pointer transition-all"
                    >
                        <option value="highest">Highest Value</option>
                        <option value="lowest">Lowest Value</option>
                        {tab === 'inventory' && <option value="limited">Limited First 🔥</option>}
                        <option value="name">Name (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* STATES */}
            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center relative z-10">
                    <div className="w-16 h-16 border-4 border-[#252839] border-t-[#6C63FF] rounded-full animate-spin mb-6 shadow-[0_0_15px_#6C63FF]"></div>
                    <p className="text-[#8f9ac6] font-black uppercase tracking-widest animate-pulse">Loading assets...</p>
                </div>
            ) : tab === 'inventory' && filteredInventory.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#0b0e14]/50 rounded-3xl border-2 border-dashed border-[#252839] relative z-10">
                    <span className="text-6xl opacity-30 grayscale mb-6 drop-shadow-md">🎒</span>
                    <p className="text-[#8f9ac6] font-black text-2xl mb-2 uppercase tracking-widest">No pets found</p>
                </div>
            ) : tab === 'market' && filteredMarket.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#0b0e14]/50 rounded-3xl border-2 border-dashed border-[#252839] relative z-10">
                    <span className="text-6xl opacity-30 grayscale mb-6 drop-shadow-md">🏪</span>
                    <p className="text-[#8f9ac6] font-black text-2xl mb-2 uppercase tracking-widest">Market is empty</p>
                </div>
            ) : (
                /* GRID DE ITEMS (PetCard Integration) */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 max-h-[650px] overflow-y-auto custom-scrollbar pr-2 pb-6 relative z-10 p-2">
                    
                    {tab === 'inventory' && filteredInventory.map((pet, i) => {
                      const isSelected = selectedIds.has(pet.inventoryId);
                      
                      return (
                        <div 
                           key={pet.inventoryId} 
                           onClick={() => toggleSelect(pet)}
                           className={`cursor-pointer relative transition-all duration-300 group animate-fade-in-up rounded-2xl
                            ${isSelected ? 'scale-105 -translate-y-2 ring-4 ring-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'hover:-translate-y-2'}
                            ${pet.isLocked ? 'grayscale-[40%] opacity-80 cursor-not-allowed' : ''}
                           `} 
                           style={{animationDelay: `${i * 30}ms`}}
                        >
                            {/* The Official PetCard */}
                            <div className="pointer-events-none w-full h-full"><PetCard pet={pet} /></div>

                            {/* Checkbox Overlay */}
                            <div className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-20 shadow-lg
                               ${isSelected ? 'bg-[#22c55e] border-[#22c55e]' : 'bg-[#0a0a0a]/80 border-[#374151] backdrop-blur-sm group-hover:border-cyan-500/50'}
                            `}>
                                {isSelected && <span className="text-[#0a0a0a] text-sm font-black">✓</span>}
                            </div>

                            {/* Lock Button Overlay */}
                            <button 
                                onClick={(e) => toggleLock(e, pet)}
                                className={`absolute top-2 right-2 p-1.5 rounded-lg border-2 transition-all z-30 shadow-lg backdrop-blur-md hover:scale-110 active:scale-95
                                    ${pet.isLocked ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-[#0a0a0a]/80 border-[#374151] text-gray-400 hover:text-white hover:border-gray-400'}
                                `}
                                title={pet.isLocked ? "Unlock pet" : "Lock pet from selling"}
                            >
                                {pet.isLocked ? '🔒' : '🔓'}
                            </button>
                        </div>
                      );
                    })}

                    {tab === 'market' && filteredMarket.map((m, i) => (
                        <div key={m.marketId} className="relative transition-all duration-300 group animate-fade-in-up hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] rounded-2xl" style={{animationDelay: `${i * 30}ms`}}>
                            
                            {/* The Official PetCard */}
                            <div className="pointer-events-none w-full h-full"><PetCard pet={m} /></div>
                            
                            {/* Market Overlays */}
                            <div className="absolute top-2 right-2 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0a0a0a] text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg shadow-lg z-20 border border-green-400">
                                ON SALE
                            </div>

                            <button 
                                onClick={() => setConfirmBuyModal(m)}
                                disabled={processing}
                                className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-[80%] bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[11px] font-black uppercase tracking-widest py-2 rounded-xl transition-all duration-300 z-20 shadow-[0_5px_15px_rgba(6,182,212,0.4)] hover:shadow-[0_8px_20px_rgba(6,182,212,0.6)] disabled:opacity-50 opacity-0 group-hover:opacity-100 group-hover:bottom-3"
                            >
                                BUY ({formatValue(m.price)} GC)
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>

      {/* FLOATING MULTI-SELL BAR */}
      <div className={`fixed bottom-0 left-0 right-0 p-6 flex justify-center transition-transform duration-500 z-50 pointer-events-none ${selectedIds.size > 0 ? 'translate-y-0' : 'translate-y-full'}`}>
         <div className="bg-[#14151f]/95 backdrop-blur-xl border border-[#22c55e]/50 rounded-full px-8 py-4 flex items-center gap-8 shadow-[0_0_50px_rgba(34,197,94,0.3)] pointer-events-auto scale-100 animate-fade-in-up">
            <div className="flex flex-col">
               <span className="text-[#8f9ac6] font-black uppercase text-[10px] tracking-widest">Selected ({selectedIds.size})</span>
               <div className="flex items-center gap-2">
                 <GreenCoin cls="w-5 h-5"/>
                 <span className="text-2xl font-black text-[#22c55e]">{formatValue(selectedValue)}</span>
               </div>
            </div>
            <button 
              onClick={() => setConfirmSellModal(true)} disabled={processing}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] px-8 py-3 rounded-full font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Sell to Market'}
            </button>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { opacity: 0; animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-bounce-slight { animation: bounceSlight 2s ease-in-out infinite; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(11, 14, 20, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; border: 2px solid #0b0e14; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f567a; }
        
        @keyframes fadeIn { 
            from { opacity: 0; } 
            to { opacity: 1; } 
        }
        @keyframes fadeInUp { 
            from { opacity: 0; transform: translateY(20px) scale(0.95); } 
            to { opacity: 1; transform: translateY(0) scale(1); } 
        }
        @keyframes bounceSlight { 
            0%, 100% { transform: translateY(0); } 
            50% { transform: translateY(-20px); } 
        }
        @keyframes flyToBackpack {
            0% { transform: scale(0) translateY(100px); opacity: 0; }
            15% { transform: scale(1.2) translateY(0); opacity: 1; }
            60% { transform: scale(1) translateY(0); opacity: 1; }
            100% { transform: scale(0.1) translate(calc(45vw - 100px), calc(-40vh + 100px)); opacity: 0; }
        }
        .animate-fly-to-backpack { animation: flyToBackpack 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
      `}} />
    </div>
  );
}
