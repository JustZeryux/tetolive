"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/Supabase'; 
import PetCard from '@/components/PetCard'; // 🔥 AQUÍ IMPORTAMOS TU COMPONENTE ORIGINAL SIN LAG

// --- ICONOS Y HELPERS ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R" onError={e=>e.target.style.display='none'}/>; 
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

// 🔥 MATEMÁTICA DE TAXES PROGRESIVOS 🔥
const calculateTaxedValue = (price) => {
    if (!price || price <= 0) return 0;
    let taxRate = 0.10; // Default 10%
    if (price >= 10000000) taxRate = 0.01;      // 1% tax para 10M+
    else if (price >= 5000000) taxRate = 0.03;  // 3% tax para 5M+
    else if (price >= 1000000) taxRate = 0.05;  // 5% tax para 1M+
    else if (price >= 100000) taxRate = 0.08;   // 8% tax para 100k+
    return Math.floor(price * (1 - taxRate));
};

// 🚀 WRAPPER OPTIMIZADO PARA TU PETCARD ORIGINAL
// Esto envuelve tu tarjeta para agregar las capas de selección, candado y la info de la tienda sin alterar tu PetCard base
const PetCardWrapper = React.memo(({ item, mode, isSelected, isLocked, onToggleSelect, onToggleLock, onMarketClick }) => {
  // Distinguir precios de Market vs Inventario
  const realValue = item.value || item.valor || item.items?.value || item.item?.value || 0;
  const marketPrice = item.market_price || item.price || 0;
  const seller = item.seller || item.profiles?.username || item.seller_name || null; 

  return (
    <div 
      className={`relative flex flex-col h-full transition-transform duration-200 ${isSelected ? 'ring-2 ring-cyan-500 scale-95 rounded-xl' : 'hover:scale-[1.02]'} ${mode === 'market' ? 'cursor-pointer' : 'cursor-pointer'}`}
      onClick={() => mode === 'market' ? onMarketClick(item) : onToggleSelect(item.id)}
    >
      {/* OVERLAYS DE INVENTARIO Y MARKET */}
      {mode === 'inventory' && (
        <>
            <div className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-50 shadow-lg ${isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-black/60 border-gray-500 backdrop-blur-md'}`}>
                {isSelected && <span className="text-white text-sm font-black drop-shadow-md">✓</span>}
            </div>
            <div onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }} className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-50 backdrop-blur-md border ${isLocked ? 'bg-black/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30'}`}>
                <LockIcon isLocked={isLocked} />
            </div>
        </>
      )}

      {mode === 'market' && seller && (
          <div className="absolute top-2 right-2 bg-black/80 border border-[#2a2d42] backdrop-blur-md px-2 py-1 rounded-lg z-50 shadow-lg max-w-[90px]">
              <span className="text-[8px] font-bold text-[#8f9ac6] uppercase block leading-none">Seller</span>
              <span className="text-[10px] font-black text-white truncate block">{seller}</span>
          </div>
      )}

      {/* RENDERIZADO DE TU COMPONENTE ORIGINAL */}
      {/* Pasamos 'pet' y 'item' por si tu componente usa una u otra prop */}
      <div className="flex-grow">
          <PetCard pet={item} item={item} />
      </div>

      {/* INFO BOTTOM EN MODO TIENDA (Valor Real vs Precio) */}
      {mode === 'market' && (
        <div className="bg-[#11131a] mt-1 p-2.5 rounded-lg border border-[#2a2d42] flex flex-col gap-1 shadow-md">
            <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Valor real:</span>
                <span className="flex items-center gap-1">
                    <GreenCoin cls="w-3.5 h-3.5 grayscale opacity-70"/> {formatValue(realValue)}
                </span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-white">
                <span>Precio:</span>
                <span className="flex items-center gap-1">
                    <GreenCoin cls="w-4 h-4"/> {formatValue(marketPrice)}
                </span>
            </div>
        </div>
      )}
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
  const [filterRarity, setFilterRarity] = useState('all'); 
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; 

  // Modales
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState(null);
  const [showQuickSellModal, setShowQuickSellModal] = useState(false);
  const [quickSellTotal, setQuickSellTotal] = useState({ raw: 0, taxed: 0 });

  // --- CARGA DESDE SUPABASE ---
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return setIsLoading(false);
      setCurrentUser(userData.user);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userData.user.id).single();
      if (profile) setBalances(prev => ({ ...prev, green: profile.saldo_verde || 0, red: profile.saldo_rojo || 0 }));

      // Inventario
      const { data: inventoryData } = await supabase.from('inventory').select('*, items(*)').eq('user_id', userData.user.id);
      
      // Market
      const { data: marketData } = await supabase.from('marketplace').select('*, items(*), profiles(username)'); 

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
         return { ...row, ...petData, id: row.id, item_id: petData.id || row.item_id, market_price: row.price, seller: row.profiles?.username };
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

  // --- LÓGICAS DE INTERACCIÓN ---
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
    if (isNowLocked) setSelectedItemIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    await supabase.from('inventory').update({ is_locked: isNowLocked }).eq('id', id);
  };

  // --- COMPRAR DEL MARKETPLACE ---
  const handleMarketItemClick = useCallback((item) => {
      if(item.seller_id === currentUser?.id) return alert("You cannot buy your own item!");
      setItemToBuy(item);
      setShowBuyModal(true);
  }, [currentUser]);

  const handleConfirmPurchase = async () => {
      if (!itemToBuy) return;
      if (balances.green < itemToBuy.market_price) return alert("Not enough Green Coins!");

      try {
          // 1. Cobrar al comprador
          await supabase.from('profiles').update({ saldo_verde: balances.green - itemToBuy.market_price }).eq('id', currentUser.id);
          // 2. Quitar del market
          await supabase.from('marketplace').delete().eq('id', itemToBuy.id);
          // 3. Dar item al comprador
          await supabase.from('inventory').insert([{ user_id: currentUser.id, item_id: itemToBuy.item_id }]);
          // 4. Pagar al vendedor
          const { data: sellerInfo } = await supabase.from('profiles').select('saldo_verde').eq('id', itemToBuy.seller_id).single();
          if (sellerInfo) {
              await supabase.from('profiles').update({ saldo_verde: sellerInfo.saldo_verde + itemToBuy.market_price }).eq('id', itemToBuy.seller_id);
          }

          setShowBuyModal(false);
          setItemToBuy(null);
          fetchData(); // Sincroniza al 100%
      } catch (e) { alert("Purchase failed. Item might already be sold."); }
  };

  // --- QUICK SELL CON TAXES ---
  const handleQuickSellClick = () => {
      let rawTotal = 0;
      let taxedTotal = 0;

      Array.from(selectedItemIds).forEach(id => {
          const item = inventoryItems.find(i => i.id === id);
          if (item) {
              const price = item.price || 0;
              rawTotal += price;
              taxedTotal += calculateTaxedValue(price);
          }
      });
      
      setQuickSellTotal({ raw: rawTotal, taxed: taxedTotal });
      setShowQuickSellModal(true);
  };

  const handleConfirmQuickSell = async () => {
      try {
          const idsArray = Array.from(selectedItemIds);
          await supabase.from('inventory').delete().in('id', idsArray);
          await supabase.from('profiles').update({ saldo_verde: balances.green + quickSellTotal.taxed }).eq('id', currentUser.id);

          setBalances(prev => ({ ...prev, green: prev.green + quickSellTotal.taxed, totalValue: prev.totalValue - quickSellTotal.raw }));
          setInventoryItems(prev => prev.filter(item => !selectedItemIds.has(item.id)));
          setSelectedItemIds(new Set());
          setShowQuickSellModal(false);
      } catch (e) { alert("Error selling items"); }
  };

  // --- LISTAR EN MARKETPLACE ---
  const handleListToMarket = () => setShowListModal(true);
  const handleConfirmListing = async () => {
      try {
        const priceNum = Number(listPrice);
        if (priceNum <= 0) return alert("Price must be greater than 0");
        const idsArray = Array.from(selectedItemIds);
        const itemsToInsert = idsArray.map(id => {
            const item = inventoryItems.find(i => i.id === id);
            return { seller_id: currentUser.id, item_id: item.item_id, price: priceNum };
        });

        await supabase.from('marketplace').insert(itemsToInsert);
        await supabase.from('inventory').delete().in('id', idsArray);

        setShowListModal(false);
        setListPrice('');
        setSelectedItemIds(new Set());
        fetchData();
      } catch (e) { alert("Error listing items"); }
  };

  // --- FILTROS ---
  const currentItemsRaw = activeTab === 'inventory' ? inventoryItems : marketItems;
  const filteredAndSortedItems = useMemo(() => {
    let result = [...currentItemsRaw];
    
    // 1. Buscador por nombre
    if (searchTerm) {
        result = result.filter(item => (item.name || item.items?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 2. Filtro de Rareza Nuevo
    if (filterRarity !== 'all') {
        result = result.filter(item => {
            const name = (item.name || item.items?.name || '').toLowerCase();
            const isLim = item.is_limited || item.limited;
            if (filterRarity === 'limited') return isLim;
            if (filterRarity === 'mythic') return name.includes('mythic');
            if (filterRarity === 'shiny') return name.includes('shiny');
            if (filterRarity === 'xl') return name.includes('xl');
            return true;
        });
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
      const pA = activeTab === 'market' ? (a.market_price || 0) : (a.price || 0);
      const pB = activeTab === 'market' ? (b.market_price || 0) : (b.price || 0);
      return sortBy === 'price_asc' ? pA - pB : pB - pA;
    });
    
    return result;
  }, [currentItemsRaw, searchTerm, sortBy, filterRarity, activeTab]);

  const paginatedItems = filteredAndSortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); setSelectedItemIds(new Set()); }, [searchTerm, sortBy, filterRarity, activeTab]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans selection:bg-cyan-500">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[600px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mb-8">Economy & Vault</h1>

        {/* --- TARJETAS DE BALANCE --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            <div className="bg-[#11131a] border border-[#2a2d42] rounded-3xl p-6 shadow-lg">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Green Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><GreenCoin cls="w-8 h-8" /> {formatValue(balances.green)}</div>
            </div>
            <div className="bg-[#11131a] border border-[#2a2d42] rounded-3xl p-6 shadow-lg">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Red Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><RedCoin cls="w-8 h-8" /> {formatValue(balances.red)}</div>
            </div>
            <div className="bg-[#11131a] border border-[#2a2d42] rounded-3xl p-6 shadow-lg sm:col-span-2 md:col-span-1">
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Total Inventory Value</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><GreenCoin cls="w-8 h-8 grayscale opacity-70" /> {formatValue(balances.totalValue)}</div>
            </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-[#2a2d42] pb-6">
            <button onClick={() => setActiveTab('inventory')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'inventory' ? 'bg-[#6C63FF] text-white shadow-[0_0_25px_rgba(108,99,255,0.5)]' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🎒 My Pets <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs">{inventoryItems.length}</span>
            </button>
            <button onClick={() => setActiveTab('marketplace')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'marketplace' ? 'bg-cyan-500 text-white shadow-[0_0_25px_rgba(6,182,212,0.5)]' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🏪 Global Market <span className="text-[10px] text-cyan-200 animate-pulse">LIVE</span>
            </button>
        </div>

        {/* --- CONTENEDOR PRINCIPAL --- */}
        <div className="bg-[#0f1118]/80 backdrop-blur-xl border border-[#2a2d42] rounded-[2rem] p-4 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative min-h-[600px]">
            
            {/* TOOLBAR AVANZADO */}
            <div className="flex flex-col xl:flex-row justify-between items-center mb-8 gap-5">
                <h2 className="text-2xl font-black uppercase tracking-widest text-white whitespace-nowrap">
                    {activeTab === 'inventory' ? 'Your Inventory' : 'Global Marketplace'}
                </h2>
                
                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
                    {activeTab === 'inventory' && !isLoading && (
                        <button onClick={() => selectedItemIds.size > 0 ? setSelectedItemIds(new Set()) : setSelectedItemIds(new Set(filteredAndSortedItems.filter(i=>!lockedItemIds.has(i.id)).map(i=>i.id)))} 
                        className="bg-[#1a1c29] border border-[#374151] hover:border-[#6C63FF] text-white text-xs font-black uppercase px-4 py-3 rounded-xl transition-colors">
                            {selectedItemIds.size > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full sm:w-auto flex-1 md:flex-none bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-4 outline-none font-bold text-sm focus:border-cyan-500" />
                    
                    <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} className="w-full sm:w-auto bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-4 font-bold text-sm outline-none cursor-pointer focus:border-cyan-500">
                        <option value="all">💎 All Rarities</option>
                        <option value="limited">🌌 Limiteds Only</option>
                        <option value="mythic">🔮 Mythics Only</option>
                        <option value="xl">🏆 XL Pure</option>
                        <option value="shiny">⚡ Shinys</option>
                    </select>

                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full sm:w-auto bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-4 font-bold text-sm outline-none cursor-pointer focus:border-cyan-500">
                        <option value="price_desc">💰 Highest Value</option>
                        <option value="price_asc">📉 Lowest Value</option>
                    </select>
                </div>
            </div>

            {/* THE GRID (CARGANDO TUS PET CARDS LIMPIAS) */}
            {isLoading ? (
                <div className="flex justify-center items-center py-40 flex-col gap-6">
                    <div className="w-20 h-20 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-black uppercase tracking-widest text-[#8f9ac6] animate-pulse">Loading Database...</p>
                </div>
            ) : paginatedItems.length === 0 ? (
                <div className="text-center py-32 text-[#4a506b] font-black uppercase text-xl">No items found</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5 pb-32">
                    {paginatedItems.map((item) => (
                        <PetCardWrapper 
                            key={item.id} item={item} mode={activeTab} 
                            isSelected={selectedItemIds.has(item.id)} isLocked={lockedItemIds.has(item.id)} 
                            onToggleSelect={handleToggleSelect} onToggleLock={handleToggleLock} onMarketClick={handleMarketItemClick} 
                        />
                    ))}
                </div>
            )}

            {/* PAGINACIÓN */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center gap-4 mt-8 pb-4 absolute bottom-6 left-1/2 -translate-x-1/2 w-full">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white font-black border border-[#2a2d42] disabled:opacity-30 hover:bg-cyan-500 transition-colors">&lsaquo;</button>
                    <div className="bg-[#11131a] border border-[#2a2d42] px-6 py-3 rounded-xl"><span className="text-[#8f9ac6] font-black text-sm uppercase tracking-widest">Page <span className="text-white mx-1">{currentPage}</span> of {totalPages}</span></div>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white font-black border border-[#2a2d42] disabled:opacity-30 hover:bg-cyan-500 transition-colors">&rsaquo;</button>
                </div>
            )}
        </div>

        {/* BARRA FLOTANTE INVENTARIO */}
        {selectedItemIds.size > 0 && activeTab === 'inventory' && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0b0e14]/95 backdrop-blur-xl border-2 border-[#6C63FF]/50 rounded-2xl py-4 px-6 md:px-10 z-50 flex flex-col md:flex-row items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
                <div className="flex flex-col text-center md:text-left">
                    <span className="text-white font-black text-xl">{selectedItemIds.size} Selected</span>
                    <span className="text-[#8f9ac6] font-bold text-[10px] uppercase tracking-widest">Locked items protected</span>
                </div>
                <div className="hidden md:block w-px h-12 bg-[#2a2d42]"></div>
                <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={handleListToMarket} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-sm hover:scale-105 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.4)]">🏪 List on Market</button>
                    <button onClick={handleQuickSellClick} className="bg-gradient-to-r from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-black uppercase text-sm hover:scale-105 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.4)]">Quick Sell</button>
                </div>
            </div>
        )}
      </div>

      {/* --- MODALES --- */}

      {/* COMPRAR DEL MARKET */}
      {showBuyModal && itemToBuy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#11131a] border-2 border-cyan-500/50 rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center">
                <button onClick={() => setShowBuyModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
                <h2 className="text-2xl font-black uppercase text-center mb-6 text-white tracking-widest">Confirm Purchase</h2>
                <div className="w-48 mb-6 pointer-events-none"><PetCard pet={itemToBuy} item={itemToBuy} /></div>
                <div className="w-full bg-[#0b0e14] p-4 rounded-xl border border-[#2a2d42] mb-6 flex justify-between items-center">
                    <span className="text-[#8f9ac6] font-black text-xs uppercase tracking-widest">PRICE:</span>
                    <span className="text-white font-black text-xl flex items-center gap-2"><GreenCoin/> {formatValue(itemToBuy.market_price)}</span>
                </div>
                <button onClick={handleConfirmPurchase} className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105 transition-transform">Buy Now</button>
            </div>
        </div>
      )}

      {/* QUICK SELL + TAXES */}
      {showQuickSellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1315] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full relative">
                <button onClick={() => setShowQuickSellModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
                <h2 className="text-3xl font-black uppercase text-center mb-6 text-red-500 tracking-widest">Quick Sell</h2>
                <div className="w-full bg-[#0b0e14] p-5 rounded-xl border border-[#2a2d42] mb-8">
                    <div className="flex justify-between mb-2">
                        <span className="text-[#8f9ac6] font-bold text-sm">Raw Value:</span>
                        <span className="text-gray-400 font-bold line-through">{formatValue(quickSellTotal.raw)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#2a2d42] pt-3 mt-2">
                        <span className="text-[#8f9ac6] font-black uppercase text-xs tracking-widest flex items-center">After Tax:</span>
                        <span className="text-green-400 font-black flex items-center gap-2 text-xl"><GreenCoin/> {formatValue(quickSellTotal.taxed)}</span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setShowQuickSellModal(false)} className="flex-1 bg-[#1a1c29] text-white font-black uppercase py-4 rounded-xl border border-[#374151]">Cancel</button>
                    <button onClick={handleConfirmQuickSell} className="flex-1 bg-red-600 text-white font-black uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.4)]">Sell All</button>
                </div>
            </div>
        </div>
      )}

      {/* LISTAR AL MARKET */}
      {showListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#11131a] border-2 border-cyan-500/50 rounded-3xl p-8 max-w-md w-full relative">
                <button onClick={() => setShowListModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
                <h2 className="text-3xl font-black uppercase text-center mb-6 text-cyan-400 tracking-widest">List Items</h2>
                <p className="text-center text-[#8f9ac6] text-sm mb-6">Set the price for your {selectedItemIds.size} item(s).</p>
                <div className="bg-[#0b0e14] p-5 rounded-2xl border border-[#2a2d42] mb-8">
                    <div className="flex items-center gap-3 bg-[#161925] border border-[#374151] rounded-xl px-4 py-3 focus-within:border-cyan-500 transition-colors">
                        <GreenCoin cls="w-6 h-6"/>
                        <input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="Price per item" className="bg-transparent border-none outline-none text-white font-black text-2xl w-full" />
                    </div>
                </div>
                <button onClick={handleConfirmListing} disabled={!listPrice || listPrice <= 0} className="w-full bg-cyan-500 text-white font-black uppercase py-4 rounded-xl disabled:opacity-50 hover:bg-cyan-400 transition-colors">Publish to Market</button>
            </div>
        </div>
      )}

    </div>
  );
}
