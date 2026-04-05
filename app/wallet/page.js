"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/Supabase'; 

// --- ICONOS Y HELPERS ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>; 
const LockIcon = ({ isLocked }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isLocked ? "#f59e0b" : "#9ca3af"} className="w-4 h-4 drop-shadow-md">
        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
    </svg>
);

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

// --- MOTOR DE VARIANTES MODULARES ---
const getPetVariants = (name, isDBLimited = false) => {
  const lowerName = (name || '').toLowerCase();
  return {
    isShiny: lowerName.includes('shiny'),
    isMythic: lowerName.includes('mythic'),
    isXL: lowerName.includes('xl'),
    isLimited: isDBLimited
  };
};

const getBannerInfo = (variants) => {
  if (!variants.isMythic && !variants.isXL && !variants.isLimited) return null; 
  let parts = [];
  if (variants.isLimited) parts.push("LIMITED");
  if (variants.isShiny) parts.push("SHINY");
  if (variants.isMythic && !variants.isLimited) parts.push("MYTHIC"); 
  if (variants.isXL) parts.push("XL");

  if (parts.length === 1 && variants.isXL) parts = ["XL PURE"];
  if (parts.length === 0) return null;
  
  const text = parts.join(" ");
  const textScale = parts.length > 2 ? 'text-[7px] px-2' : 'text-[9px] px-4'; 

  let bgClass = "bg-gradient-to-r from-gray-700 to-gray-500 text-white";
  if (variants.isLimited) bgClass = "bg-[linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] bg-[length:200%_auto] animate-rainbow-bg text-white border-white shadow-[0_0_20px_rgba(255,255,255,0.8)]";
  else if (variants.isXL) bgClass = "bg-gradient-to-r from-yellow-400 via-yellow-100 to-yellow-400 text-yellow-900 border-yellow-200 shadow-[0_0_15px_#FFD700] animate-pulse-slow";
  else if (variants.isShiny && variants.isMythic) bgClass = "bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 text-white border-cyan-200 shadow-[0_0_15px_#a855f7]";
  else if (variants.isMythic) bgClass = "bg-gradient-to-r from-red-600 via-rose-500 to-red-600 text-white border-rose-200 shadow-[0_0_15px_#DC143C]";

  return { text, bgClass, textScale };
};

// 🚀 OPTIMIZACIÓN: CARTA MEMOIZADA
const PetVisualCard = React.memo(({ item, mode, isSelected, isLocked, onToggleSelect, onToggleLock, onMarketClick }) => {
  const isDBLimited = item.is_limited || item.limited || false;
  // Soporta item.items (join de Supabase) o item directo
  const name = item.name || item.items?.name || item.item?.name || 'Unknown';
  const img = item.image_url || item.img || item.items?.image_url || item.item?.image_url || '/default-pet.png';
  const color = item.color || item.items?.color || item.item?.color || '#ffffff';
  const price = mode === 'market' ? (item.market_price || item.price) : (item.price || item.valor || item.items?.value || item.item?.value || 0);
  const serial = item.serial_number || item.serial || null;
  const seller = item.profiles?.username || item.seller_name || item.seller || null; 

  const variants = getPetVariants(name, isDBLimited);
  const banner = getBannerInfo(variants);

  const cardClasses = [
    'pet-card-visual',
    variants.isShiny ? 'has-shiny' : 'is-standard',
    variants.isMythic ? 'has-mythic' : '',
    variants.isShiny && variants.isMythic ? 'has-shiny-mythic' : '',
    variants.isXL ? 'has-xl' : '',
    variants.isLimited ? 'has-limited' : '',
    isSelected ? 'is-selected' : '',
    mode === 'market' ? 'is-market-item cursor-pointer hover:-translate-y-2' : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div className={cardClasses} style={{ '--item-color': color }} onClick={mode === 'market' ? () => onMarketClick(item) : undefined}>
      <div className="pet-glow-layer"></div>
      {variants.isShiny && <div className="shiny-glint"></div>}
      {variants.isMythic && <div className="mythic-aura"></div>}
      {variants.isShiny && variants.isMythic && <div className="holographic-sweep"></div>}
      {variants.isXL && (<><div className="xl-god-rays"></div><div className="xl-particles"></div></>)}
      {variants.isLimited && (<><div className="limited-galaxy-bg"></div><div className="limited-stars"></div></>)}
      <div className="pet-sparkle-overlay"></div>

      {banner && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-max max-w-[95%] z-40 pointer-events-none">
              <div className={`font-black py-0.5 rounded-b-lg uppercase tracking-[0.2em] border-b-2 text-center whitespace-nowrap ${banner.bgClass} ${banner.textScale}`}>
                  {banner.text}
              </div>
          </div>
      )}

      {mode === 'inventory' && (
        <>
            <div onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }} className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-50 cursor-pointer shadow-lg ${isSelected ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-black/60 border-gray-500 hover:border-white backdrop-blur-md'}`}>
                {isSelected && <span className="text-white text-sm font-black drop-shadow-md">✓</span>}
            </div>
            {onToggleLock && (
                <div onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }} className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-50 cursor-pointer backdrop-blur-md border ${isLocked ? 'bg-black/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30'}`}>
                    <LockIcon isLocked={isLocked} />
                </div>
            )}
        </>
      )}

      {mode === 'market' && seller && (
          <div className="absolute top-2 right-2 bg-black/70 border border-[#2a2d42] backdrop-blur-md px-2 py-1 rounded-lg z-50 shadow-lg max-w-[90px]">
              <span className="text-[9px] font-bold text-[#8f9ac6] uppercase block leading-none">Seller</span>
              <span className="text-[10px] font-black text-white truncate block">{seller}</span>
          </div>
      )}

      <div className="pet-image-container z-30 mt-5 pointer-events-none">
        {(variants.isXL || variants.isMythic || variants.isLimited) && (
            <div className={`absolute bottom-0 w-24 h-5 blur-[12px] rounded-full mix-blend-screen transition-opacity duration-500 pet-floor-shadow ${variants.isLimited ? 'bg-fuchsia-500/50' : variants.isXL ? 'bg-yellow-500/50' : 'bg-red-500/50'}`}></div>
        )}
        <img src={img} alt={name} className="pet-image" loading="lazy" />
      </div>

      <div className="pet-info-bar z-40">
        <p className={`pet-name ${variants.isShiny && variants.isMythic ? 'holo-text' : ''}`}>{name}</p>
        {(variants.isMythic || variants.isLimited) && serial && (
            <span className={`text-[10px] font-black uppercase tracking-[0.1em] block mt-0.5 ${variants.isLimited ? 'text-fuchsia-400' : 'text-yellow-400'}`}>#{serial}</span>
        )}
        <div className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1 mt-1.5 border w-full backdrop-blur-md transition-colors ${mode === 'market' ? 'bg-cyan-950/40 border-cyan-500/30 group-hover:bg-cyan-600/50' : 'bg-black/60 border-white/10'}`}>
            <GreenCoin cls="w-3.5 h-3.5 grayscale opacity-80" /> 
            <span className={`text-[12px] font-black tracking-widest ${mode === 'market' ? 'text-cyan-400' : 'text-gray-100'}`}>{formatValue(price)}</span>
        </div>
      </div>
    </div>
  );
});

export default function EconomyPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  const [isLoading, setIsLoading] = useState(true);
  
  const [balances, setBalances] = useState({ green: 0, red: 0, totalValue: 0 });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [lockedItemIds, setLockedItemIds] = useState(new Set());

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; 

  // Modales
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState(null);

  const [showQuickSellModal, setShowQuickSellModal] = useState(false);
  const [quickSellTotal, setQuickSellTotal] = useState(0);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferUsername, setTransferUsername] = useState('');

  // --- CARGA DE DATOS REAL DESDE SUPABASE ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return setIsLoading(false);
      setCurrentUser(userData.user);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
      if (profile) setBalances(prev => ({ ...prev, green: profile.saldo_verde || 0, red: profile.saldo_rojo || 0 }));

      // Inventario
      const { data: inventoryData, error: invError } = await supabase.from('inventory').select('*, items(*)').eq('user_id', userData.user.id);
      if (invError) throw invError;

      // Market (Trae la info del item y el nombre del vendedor)
      const { data: marketData, error: mktError } = await supabase.from('marketplace').select('*, items(*), profiles(username)'); 
      if (mktError) throw mktError;

      let totalVal = 0;
      const lockedSet = new Set();

      const formattedInv = (inventoryData || []).map(row => {
         const petData = row.items || row.item || {}; 
         const price = petData.value || petData.valor || petData.price || 0;
         totalVal += price;
         if (row.is_locked) lockedSet.add(row.id);
         return { ...row, ...petData, id: row.id, item_id: petData.id || row.item_id, price };
      });

      const formattedMarket = (marketData || []).map(row => {
         const petData = row.items || row.item || {};
         return { ...row, ...petData, id: row.id, item_id: petData.id || row.item_id, market_price: row.price };
      });

      setBalances(prev => ({ ...prev, totalValue: totalVal }));
      setLockedItemIds(lockedSet);
      setInventoryItems(formattedInv);
      setMarketItems(formattedMarket);
    } catch (error) {
      console.error("🚨 Error loading:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- LÓGICA DE INTERACCIÓN LOCAL ---
  const handleToggleSelect = useCallback((id) => {
    setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleToggleLock = async (id) => {
    const isNowLocked = !lockedItemIds.has(id);
    setLockedItemIds(prev => {
        const newSet = new Set(prev);
        if (isNowLocked) newSet.add(id); else newSet.delete(id);
        return newSet;
    });
    // Actualizar en BD (Opcional si tienes la columna)
    await supabase.from('inventory').update({ is_locked: isNowLocked }).eq('id', id);
  };

  // --- LÓGICA: LISTAR EN MARKET ---
  const handleListToMarket = () => setShowListModal(true);
  
  const handleConfirmListing = async () => {
      try {
        const priceNum = Number(listPrice);
        if (priceNum <= 0) return alert("Price must be greater than 0");

        // 1. Preparamos los items para el market
        const idsArray = Array.from(selectedItemIds);
        const itemsToInsert = idsArray.map(id => {
            const item = inventoryItems.find(i => i.id === id);
            return { seller_id: currentUser.id, item_id: item.item_id, price: priceNum };
        });

        // 2. Insertar en Marketplace
        const { error: insertErr } = await supabase.from('marketplace').insert(itemsToInsert);
        if (insertErr) throw insertErr;

        // 3. Borrar del Inventario
        const { error: delErr } = await supabase.from('inventory').delete().in('id', idsArray);
        if (delErr) throw delErr;

        // 4. Actualizar UI
        alert("Items listed successfully!");
        setShowListModal(false);
        setListPrice('');
        setSelectedItemIds(new Set());
        fetchData(); // Recargamos para reflejar cambios

      } catch (e) {
          console.error(e);
          alert("Error listing items");
      }
  };

  // --- LÓGICA: COMPRAR DEL MARKET ---
  const handleMarketItemClick = useCallback((item) => {
      if(item.seller_id === currentUser?.id) return alert("You cannot buy your own item!");
      setItemToBuy(item);
      setShowBuyModal(true);
  }, [currentUser]);

  const handleConfirmPurchase = async () => {
      if (!itemToBuy) return;
      if (balances.green < itemToBuy.market_price) return alert("Not enough Green Coins!");

      try {
          // 1. Descontar dinero al comprador
          await supabase.from('profiles').update({ saldo_verde: balances.green - itemToBuy.market_price }).eq('id', currentUser.id);
          
          // 2. Dar mascota al comprador
          await supabase.from('inventory').insert([{ user_id: currentUser.id, item_id: itemToBuy.item_id }]);
          
          // 3. Quitar del market
          await supabase.from('marketplace').delete().eq('id', itemToBuy.id);

          // 4. Dar dinero al vendedor
          const { data: sellerInfo } = await supabase.from('profiles').select('saldo_verde').eq('id', itemToBuy.seller_id).single();
          if (sellerInfo) {
              await supabase.from('profiles').update({ saldo_verde: sellerInfo.saldo_verde + itemToBuy.market_price }).eq('id', itemToBuy.seller_id);
          }

          alert("Purchase successful!");
          setShowBuyModal(false);
          setItemToBuy(null);
          fetchData(); // Refrescar info

      } catch (e) {
          console.error(e);
          alert("Purchase failed.");
      }
  };

  // --- LÓGICA: QUICK SELL ---
  const handleQuickSellClick = () => {
      const totalValue = Array.from(selectedItemIds).reduce((acc, id) => {
          const item = inventoryItems.find(i => i.id === id);
          return acc + (item ? item.price : 0);
      }, 0);
      setQuickSellTotal(totalValue);
      setShowQuickSellModal(true);
  };

  const handleConfirmQuickSell = async () => {
      try {
          const idsArray = Array.from(selectedItemIds);
          // Borrar items
          await supabase.from('inventory').delete().in('id', idsArray);
          // Dar dinero
          await supabase.from('profiles').update({ saldo_verde: balances.green + quickSellTotal }).eq('id', currentUser.id);

          setBalances(prev => ({ ...prev, green: prev.green + quickSellTotal, totalValue: prev.totalValue - quickSellTotal }));
          setInventoryItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
          setSelectedItemIds(new Set());
          setShowQuickSellModal(false);
      } catch (e) { alert("Error selling items"); }
  };

  // --- LÓGICA: TRANSFERIR ---
  const handleTransferClick = () => setShowTransferModal(true);

  const handleConfirmTransfer = async () => {
      if (!transferUsername.trim()) return alert("Invalid username!");
      try {
          const { data: receiver } = await supabase.from('profiles').select('id').eq('username', transferUsername).single();
          if (!receiver) return alert("User not found!");
          
          const idsArray = Array.from(selectedItemIds);
          await supabase.from('inventory').update({ user_id: receiver.id }).in('id', idsArray);

          setInventoryItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
          setSelectedItemIds(new Set());
          setTransferUsername('');
          setShowTransferModal(false);
          alert("Pets transferred successfully!");
      } catch (e) { alert("Error transferring."); }
  };

  // --- MOTOR ANTI-LAG (FILTROS) ---
  const currentItemsRaw = activeTab === 'inventory' ? inventoryItems : marketItems;
  const filteredAndSortedItems = useMemo(() => {
    let result = [...currentItemsRaw];
    if (searchTerm) {
        result = result.filter(item => (item.name || item.items?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    result.sort((a, b) => {
      const pA = activeTab === 'market' ? (a.market_price || 0) : (a.price || 0);
      const pB = activeTab === 'market' ? (b.market_price || 0) : (b.price || 0);
      return sortBy === 'price_asc' ? pA - pB : pB - pA;
    });
    return result;
  }, [currentItemsRaw, searchTerm, sortBy, activeTab]);

  const handleSelectAll = () => {
      if (selectedItemIds.size > 0) { setSelectedItemIds(new Set()); } 
      else {
          const idsToAdd = filteredAndSortedItems.filter(item => !lockedItemIds.has(item.id)).map(item => item.id);
          setSelectedItemIds(new Set(idsToAdd));
      }
  };

  const paginatedItems = filteredAndSortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); setSelectedItemIds(new Set()); }, [searchTerm, sortBy, activeTab]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans selection:bg-cyan-500 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6366f1]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mb-8">Economy & Vault</h1>

        {/* --- TARJETAS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Green Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><GreenCoin cls="w-8 h-8" /> {formatValue(balances.green)}</div>
            </div>
            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Red Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><RedCoin cls="w-8 h-8" /> {formatValue(balances.red)}</div>
            </div>
            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden sm:col-span-2 md:col-span-1">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Total Value</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><GreenCoin cls="w-8 h-8 grayscale opacity-70" /> {formatValue(balances.totalValue)}</div>
            </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-[#2a2d42] pb-6">
            <button onClick={() => setActiveTab('inventory')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'inventory' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent scale-105' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🎒 My Pets <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs">{inventoryItems.length}</span>
            </button>
            <button onClick={() => setActiveTab('marketplace')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'marketplace' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-transparent scale-105' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🏪 Global Market
            </button>
        </div>

        {/* --- PANEL --- */}
        <div className="bg-[#0f1118]/80 backdrop-blur-xl border border-[#2a2d42] rounded-[2rem] p-4 md:p-8 relative min-h-[600px]">
            <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-5">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="text-2xl font-black uppercase tracking-widest text-white">{activeTab === 'inventory' ? 'Inventory' : 'Marketplace'}</h2>
                    {activeTab === 'inventory' && !isLoading && (
                        <button onClick={handleSelectAll} className="bg-[#1a1c29] border border-[#374151] hover:border-cyan-500 text-white text-xs font-black uppercase px-4 py-2.5 rounded-xl">{selectedItemIds.size > 0 ? 'Deselect All' : 'Select All'}</button>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-72 bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-4 outline-none font-bold text-sm" />
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full sm:w-auto bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-5 font-bold outline-none cursor-pointer">
                        <option value="price_desc">Highest Value</option><option value="price_asc">Lowest Value</option>
                    </select>
                </div>
            </div>

            {/* GRID */}
            {isLoading ? (
                <div className="flex justify-center items-center py-40 flex-col gap-6"><div className="w-20 h-20 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div></div>
            ) : paginatedItems.length === 0 ? (
                <div className="text-center py-32 text-[#4a506b] font-black uppercase text-xl">No items found</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5 pb-32">
                    {paginatedItems.map((item) => (
                        <PetVisualCard key={item.id} item={item} mode={activeTab} isSelected={selectedItemIds.has(item.id)} isLocked={lockedItemIds.has(item.id)} onToggleSelect={handleToggleSelect} onToggleLock={handleToggleLock} onMarketClick={handleMarketItemClick} />
                    ))}
                </div>
            )}

            {/* PAGINACIÓN */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center gap-4 mt-8 pb-4 absolute bottom-6 left-1/2 -translate-x-1/2 w-full">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white font-black border border-[#2a2d42]">&lsaquo;</button>
                    <div className="bg-[#11131a] border border-[#2a2d42] px-6 py-3 rounded-xl"><span className="text-[#8f9ac6] font-black text-sm uppercase tracking-widest">Page <span className="text-white mx-1">{currentPage}</span> of {totalPages}</span></div>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white font-black border border-[#2a2d42]">&rsaquo;</button>
                </div>
            )}
        </div>

        {/* --- BARRA FLOTANTE --- */}
        {selectedItemIds.size > 0 && activeTab === 'inventory' && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0b0e14]/95 backdrop-blur-xl border-2 border-indigo-500/50 rounded-2xl py-4 px-6 md:px-10 z-50 flex flex-col md:flex-row items-center gap-4 animate-bounce-in-up">
                <div className="flex flex-col"><span className="text-white font-black text-xl">{selectedItemIds.size} Selected</span></div>
                <div className="hidden md:block w-px h-12 bg-[#2a2d42]"></div>
                <div className="flex gap-3">
                    <button onClick={handleListToMarket} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-sm">🏪 List</button>
                    <button onClick={handleTransferClick} className="bg-[#1a1c29] text-white border border-[#374151] px-6 py-3 rounded-xl font-black uppercase text-sm">Transfer</button>
                    <button onClick={handleQuickSellClick} className="bg-gradient-to-r from-red-700 to-red-900 text-white border border-red-500/50 px-6 py-3 rounded-xl font-black uppercase text-sm">Sell</button>
                </div>
            </div>
        )}
      </div>

      {/* --- MODALES --- */}

      {/* Modal: Listar */}
      {showListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#11131a] border-2 border-cyan-500/50 rounded-3xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowListModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-3xl font-black uppercase text-center mb-8 text-cyan-400">List Items</h2>
            <div className="bg-[#0b0e14] p-5 rounded-2xl border border-[#2a2d42] mb-8">
                <label className="text-xs font-black text-[#8f9ac6] uppercase block mb-3">Price per item</label>
                <input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="0" className="bg-[#161925] border border-[#374151] rounded-xl px-4 py-3 text-white font-black text-2xl w-full" />
            </div>
            <button onClick={handleConfirmListing} disabled={!listPrice || listPrice <= 0} className="w-full bg-cyan-500 text-white font-black uppercase py-4 rounded-xl disabled:opacity-50">Confirm</button>
        </div></div>
      )}

      {/* Modal: Comprar */}
      {showBuyModal && itemToBuy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#11131a] border-2 border-[#2a2d42] rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center">
            <button onClick={() => setShowBuyModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-2xl font-black uppercase text-center mb-6 text-white">Buy Item</h2>
            <div className="w-40 h-48 pointer-events-none mb-6"><PetVisualCard item={itemToBuy} mode="inventory" /></div>
            <div className="w-full bg-[#0b0e14] p-4 rounded-2xl mb-6 flex justify-between"><span className="text-[#8f9ac6] font-black">PRICE:</span><span className="text-white font-black">{formatValue(itemToBuy.market_price)}</span></div>
            <button onClick={handleConfirmPurchase} className="w-full bg-green-500 text-white font-black uppercase py-4 rounded-xl">Confirm Buy</button>
        </div></div>
      )}

      {/* Modal: Quick Sell */}
      {showQuickSellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#1a1315] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full relative">
            <button onClick={() => setShowQuickSellModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-3xl font-black uppercase text-center mb-6 text-red-500">Quick Sell</h2>
            <div className="w-full bg-[#0b0e14] p-4 rounded-2xl mb-8 flex justify-between"><span className="text-[#8f9ac6] font-black">EARN:</span><span className="text-white font-black">{formatValue(quickSellTotal)}</span></div>
            <div className="flex gap-4">
                <button onClick={() => setShowQuickSellModal(false)} className="flex-1 bg-[#1a1c29] text-white font-black uppercase py-4 rounded-xl">Cancel</button>
                <button onClick={handleConfirmQuickSell} className="flex-1 bg-red-600 text-white font-black uppercase py-4 rounded-xl">Sell All</button>
            </div>
        </div></div>
      )}

      {/* Modal: Transferir */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#11131a] border-2 border-indigo-500/50 rounded-3xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowTransferModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-3xl font-black uppercase text-center mb-6 text-indigo-400">Transfer</h2>
            <div className="bg-[#0b0e14] p-5 rounded-2xl mb-8">
                <label className="text-xs font-black text-[#8f9ac6] uppercase block mb-3">Username</label>
                <input type="text" value={transferUsername} onChange={e => setTransferUsername(e.target.value)} className="bg-[#161925] border border-[#374151] rounded-xl px-4 py-3 text-white font-black w-full" />
            </div>
            <button onClick={handleConfirmTransfer} disabled={!transferUsername.trim()} className="w-full bg-indigo-500 text-white font-black uppercase py-4 rounded-xl disabled:opacity-50">Confirm</button>
        </div></div>
      )}

      <style jsx global>{`
        /* CSS EXACTAMENTE IGUAL AL ANTERIOR (Solo comprimido para espacio) */
        .pet-card-visual { background: #11131a; border-radius: 1.2rem; padding: 0.5rem; display: flex; flex-direction: column; align-items: center; position: relative; transition: all 0.2s; box-shadow: 0 10px 20px rgba(0,0,0,0.6); overflow: hidden; width: 100%; height: 210px; border: 2px solid transparent; will-change: transform; }
        .pet-card-visual:not(.is-market-item):hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 15px 30px rgba(0,0,0,0.8); z-index: 10; }
        .pet-card-visual.is-market-item:hover { border-color: #06b6d450; box-shadow: 0 15px 30px rgba(0,0,0,0.8); z-index: 10; }
        .pet-card-visual.is-selected { border-color: #06b6d4 !important; }
        .pet-glow-layer { position: absolute; inset: 0; opacity: 0.15; z-index: 1; background: radial-gradient(circle, var(--item-color, #fff) 0%, transparent 75%); }
        .pet-info-bar { width: 100%; text-align: center; margin-top: auto; background: rgba(0,0,0,0.7); padding: 0.4rem; z-index: 40; border-radius: 0 0 1rem 1rem; }
        .pet-image-container { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; width: 100%; z-index: 30;}
        .pet-image { max-width: 80%; max-height: 85px; object-fit: contain; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.8)); transition: 0.3s; }
        .pet-floor-shadow { opacity: 0.4; transition: 0.3s; }
        .pet-card-visual:hover .pet-image { transform: scale(1.1) rotate(-3deg); }
        .pet-name { font-weight: 900; text-transform: uppercase; font-size: 0.65rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .has-shiny { box-shadow: 0 10px 20px rgba(0,0,0,0.6), 0 0 10px #00FFFF10; }
        .has-mythic { border-color: #DC143C40; box-shadow: inset 0 0 15px #DC143C20; }
        .has-xl { border-color: transparent !important; box-shadow: 0 15px 30px rgba(0,0,0,0.8), 0 0 20px #FFD70020 !important; }
        .has-limited { border-color: transparent !important; background: #000 !important;}
        
        .animate-bounce-in-up { animation: bounceInUp 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        @keyframes bounceInUp { from { opacity: 0; transform: translate(-50%, 50px) scale(0.9); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
      `}</style>
    </div>
  );
}
