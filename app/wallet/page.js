"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/Supabase'; 

// 👇 AQUÍ IMPORTAS TU COMPONENTE ORIGINAL INTACTO 👇
import PetCard from '@/components/PetCard'; // <-- AJUSTA ESTA RUTA A DONDE TENGAS TU COMPONENTE

// Helpers básicos
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5 inline-block"}) => <img src="/green-coin.png" className={cls} alt="G" />;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5 inline-block"}) => <img src="/red-coin.png" className={cls} alt="R" />; 
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
    let taxRate = 0.10; // Default: 10% tax para mascotas pequeñas
    
    if (price >= 10000000) taxRate = 0.01;      // 1% tax para 10M+
    else if (price >= 5000000) taxRate = 0.03;  // 3% tax para 5M+
    else if (price >= 1000000) taxRate = 0.05;  // 5% tax para 1M+
    else if (price >= 100000) taxRate = 0.08;   // 8% tax para 100k+

    return Math.floor(price * (1 - taxRate));
};

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

  // Estados de Modales
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState(null);
  const [showQuickSellModal, setShowQuickSellModal] = useState(false);
  const [quickSellTotal, setQuickSellTotal] = useState({ raw: 0, taxed: 0 });
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

      // TRAER INVENTARIO
      const { data: inventoryData, error: invError } = await supabase.from('inventory').select('*, items(*)').eq('user_id', userData.user.id);
      if (invError) throw invError;

      // TRAER MARKET
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

  // --- INTERACCIÓN LOCAL ---
  const handleToggleSelect = useCallback((id) => {
    setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleToggleLock = async (e, id) => {
    e.stopPropagation(); // Evita que se seleccione la carta al bloquear
    const isNowLocked = !lockedItemIds.has(id);
    setLockedItemIds(prev => {
        const newSet = new Set(prev);
        if (isNowLocked) newSet.add(id); else newSet.delete(id);
        return newSet;
    });
    // Deseleccionar si se bloquea
    if (isNowLocked) setSelectedItemIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    await supabase.from('inventory').update({ is_locked: isNowLocked }).eq('id', id);
  };

  // --- COMPRAR DEL MARKET (ARREGLADO) ---
  const handleMarketItemClick = useCallback((item) => {
      if(item.seller_id === currentUser?.id) return alert("You cannot buy your own item!");
      setItemToBuy(item);
      setShowBuyModal(true);
  }, [currentUser]);

  const handleConfirmPurchase = async () => {
      if (!itemToBuy) return;
      if (balances.green < itemToBuy.market_price) return alert("Not enough Green Coins!");

      try {
          // 1. Quitar del market PRIMERO para evitar compras dobles
          const { error: deleteErr } = await supabase.from('marketplace').delete().eq('id', itemToBuy.id);
          if (deleteErr) throw deleteErr;

          // 2. Descontar dinero al comprador
          await supabase.from('profiles').update({ saldo_verde: balances.green - itemToBuy.market_price }).eq('id', currentUser.id);
          
          // 3. Dar mascota al comprador (Inventario)
          await supabase.from('inventory').insert([{ user_id: currentUser.id, item_id: itemToBuy.item_id }]);
          
          // 4. Pagarle al vendedor
          const { data: sellerInfo } = await supabase.from('profiles').select('saldo_verde').eq('id', itemToBuy.seller_id).single();
          if (sellerInfo) {
              await supabase.from('profiles').update({ saldo_verde: sellerInfo.saldo_verde + itemToBuy.market_price }).eq('id', itemToBuy.seller_id);
          }

          setShowBuyModal(false);
          setItemToBuy(null);
          fetchData(); // Recarga todo para asegurar sincronización
      } catch (e) {
          console.error(e);
          alert("Purchase failed. Item might already be sold.");
      }
  };

  // --- QUICK SELL CON TAXES (ARREGLADO) ---
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

  // --- LISTAR Y TRANSFERIR ---
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
          setShowTransferModal(false);
      } catch (e) { alert("Error transferring."); }
  };

  // --- ANTI-LAG FILTERS ---
  const currentItemsRaw = activeTab === 'inventory' ? inventoryItems : marketItems;
  const filteredAndSortedItems = useMemo(() => {
    let result = [...currentItemsRaw];
    if (searchTerm) result = result.filter(item => (item.name || item.items?.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    result.sort((a, b) => {
      const pA = activeTab === 'market' ? (a.market_price || 0) : (a.price || 0);
      const pB = activeTab === 'market' ? (b.market_price || 0) : (b.price || 0);
      return sortBy === 'price_asc' ? pA - pB : pB - pA;
    });
    return result;
  }, [currentItemsRaw, searchTerm, sortBy, activeTab]);

  const handleSelectAll = () => {
      if (selectedItemIds.size > 0) setSelectedItemIds(new Set()); 
      else {
          const idsToAdd = filteredAndSortedItems.filter(item => !lockedItemIds.has(item.id)).map(item => item.id);
          setSelectedItemIds(new Set(idsToAdd));
      }
  };

  const paginatedItems = filteredAndSortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); setSelectedItemIds(new Set()); }, [searchTerm, sortBy, activeTab]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto relative z-10">
        
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white mb-8">Economy & Vault</h1>

        {/* TARJETAS BALANCE */}
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
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Total Value</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white"><GreenCoin cls="w-8 h-8 grayscale opacity-70" /> {formatValue(balances.totalValue)}</div>
            </div>
        </div>

        {/* TABS */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-[#2a2d42] pb-6">
            <button onClick={() => setActiveTab('inventory')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'inventory' ? 'bg-[#6366f1] text-white' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🎒 My Pets <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs">{inventoryItems.length}</span>
            </button>
            <button onClick={() => setActiveTab('marketplace')} className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 ${activeTab === 'marketplace' ? 'bg-cyan-500 text-white' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white'}`}>
                🏪 Global Market
            </button>
        </div>

        {/* PANEL PRINCIPAL */}
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

            {/* THE GRID - AQUÍ VA TU TARJETA INTACTA */}
            {isLoading ? (
                <div className="flex justify-center items-center py-40 flex-col gap-6"><div className="w-20 h-20 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin"></div></div>
            ) : paginatedItems.length === 0 ? (
                <div className="text-center py-32 text-[#4a506b] font-black uppercase text-xl">No items found</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5 pb-32">
                    {paginatedItems.map((item) => {
                        const isSelected = selectedItemIds.has(item.id);
                        const isLocked = lockedItemIds.has(item.id);
                        
                        return (
                            <div 
                                key={item.id} 
                                className={`relative cursor-pointer transition-transform duration-200 ${activeTab === 'market' ? 'hover:-translate-y-2' : ''} ${isSelected ? 'scale-95 ring-2 ring-cyan-500 rounded-xl' : ''}`}
                                onClick={() => activeTab === 'market' ? handleMarketItemClick(item) : handleToggleSelect(item.id)}
                            >
                                {/* OVERLAY: Checkbox (Solo Inventario) */}
                                {activeTab === 'inventory' && (
                                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-50 shadow-lg ${isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-black/60 border-gray-500 backdrop-blur-md'}`}>
                                        {isSelected && <span className="text-white text-sm font-black drop-shadow-md">✓</span>}
                                    </div>
                                )}
                                
                                {/* OVERLAY: Candado (Solo Inventario) */}
                                {activeTab === 'inventory' && (
                                    <div onClick={(e) => handleToggleLock(e, item.id)} className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-50 backdrop-blur-md border ${isLocked ? 'bg-black/80 border-amber-500/50' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30'}`}>
                                        <LockIcon isLocked={isLocked} />
                                    </div>
                                )}

                                {/* OVERLAY: Etiqueta de Vendedor (Solo Market) */}
                                {activeTab === 'market' && item.seller && (
                                    <div className="absolute top-2 right-2 bg-black/80 border border-[#2a2d42] backdrop-blur-md px-2 py-1 rounded-lg z-50 shadow-lg max-w-[90px]">
                                        <span className="text-[8px] font-bold text-[#8f9ac6] uppercase block leading-none">Seller</span>
                                        <span className="text-[10px] font-black text-white truncate block">{item.seller}</span>
                                    </div>
                                )}

                                {/* TU COMPONENTE PETCARD ORIGINAL */}
                                {/* Asegúrate de que PetCard acepte la prop "item" y "mode" si necesitas mostrar el market_price */}
                                <div className="pointer-events-none">
                                    <PetCard item={item} mode={activeTab} />
                                </div>
                            </div>
                        );
                    })}
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

        {/* BARRA FLOTANTE (INVENTARIO) */}
        {selectedItemIds.size > 0 && activeTab === 'inventory' && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0b0e14]/95 backdrop-blur-xl border-2 border-indigo-500/50 rounded-2xl py-4 px-6 z-50 flex flex-col md:flex-row items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col"><span className="text-white font-black text-xl">{selectedItemIds.size} Selected</span></div>
                <div className="hidden md:block w-px h-12 bg-[#2a2d42]"></div>
                <div className="flex gap-3">
                    <button onClick={handleListToMarket} className="bg-cyan-500 text-white px-6 py-3 rounded-xl font-black uppercase text-sm">🏪 List</button>
                    <button onClick={handleTransferClick} className="bg-[#1a1c29] text-white border border-[#374151] px-6 py-3 rounded-xl font-black uppercase text-sm">Transfer</button>
                    <button onClick={handleQuickSellClick} className="bg-red-600 text-white border border-red-500/50 px-6 py-3 rounded-xl font-black uppercase text-sm">Quick Sell</button>
                </div>
            </div>
        )}
      </div>

      {/* --- MODALES --- */}

      {/* MODAL: COMPRAR (Market) */}
      {showBuyModal && itemToBuy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#11131a] border-2 border-[#2a2d42] rounded-3xl p-8 max-w-sm w-full relative flex flex-col items-center">
                <button onClick={() => setShowBuyModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
                <h2 className="text-2xl font-black uppercase text-center mb-6 text-white">Buy Item</h2>
                
                {/* Mostramos TU tarjeta en el modal */}
                <div className="w-full max-w-[200px] mb-6 pointer-events-none">
                    <PetCard item={itemToBuy} mode="market" />
                </div>
                
                <div className="w-full bg-[#0b0e14] p-4 rounded-2xl mb-6 flex justify-between items-center border border-[#2a2d42]">
                    <span className="text-[#8f9ac6] font-black text-xs uppercase tracking-widest">PRICE:</span>
                    <span className="text-white font-black text-xl flex items-center gap-2">
                        <GreenCoin /> {formatValue(itemToBuy.market_price)}
                    </span>
                </div>
                <button onClick={handleConfirmPurchase} className="w-full bg-green-500 hover:bg-green-600 text-white font-black uppercase py-4 rounded-xl transition-colors shadow-[0_0_20px_rgba(34,197,94,0.3)]">Confirm Purchase</button>
            </div>
        </div>
      )}

      {/* MODAL: QUICK SELL (Con Cálculo de Tax) */}
      {showQuickSellModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#1a1315] border-2 border-red-500/50 rounded-3xl p-8 max-w-sm w-full relative">
                <button onClick={() => setShowQuickSellModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
                <h2 className="text-3xl font-black uppercase text-center mb-6 text-red-500">Quick Sell</h2>
                
                <div className="w-full bg-[#0b0e14] p-4 rounded-xl mb-4 border border-[#2a2d42]">
                    <div className="flex justify-between mb-2">
                        <span className="text-[#8f9ac6] font-bold text-sm">Raw Value:</span>
                        <span className="text-gray-400 font-bold line-through">{formatValue(quickSellTotal.raw)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#2a2d42] pt-2 mt-2">
                        <span className="text-[#8f9ac6] font-black uppercase tracking-widest text-xs">You Earn (Tax Applied):</span>
                        <span className="text-green-400 font-black flex items-center gap-2"><GreenCoin/> {formatValue(quickSellTotal.taxed)}</span>
                    </div>
                </div>

                <div className="flex gap-4 mt-6">
                    <button onClick={() => setShowQuickSellModal(false)} className="flex-1 bg-[#1a1c29] text-white font-black uppercase py-4 rounded-xl border border-[#374151]">Cancel</button>
                    <button onClick={handleConfirmQuickSell} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-colors">Sell All</button>
                </div>
            </div>
        </div>
      )}

      {/* Modal: Listar */}
      {showListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#11131a] border-2 border-cyan-500/50 rounded-3xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowListModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-3xl font-black uppercase text-center mb-8 text-cyan-400">List Items</h2>
            <div className="bg-[#0b0e14] p-5 rounded-2xl border border-[#2a2d42] mb-8">
                <label className="text-xs font-black text-[#8f9ac6] uppercase block mb-3">Price per item (Green Coins)</label>
                <div className="flex items-center gap-3 bg-[#161925] border border-[#374151] rounded-xl px-4 py-3">
                    <GreenCoin cls="w-6 h-6"/>
                    <input type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="0" className="bg-transparent border-none outline-none text-white font-black text-2xl w-full" />
                </div>
            </div>
            <button onClick={handleConfirmListing} disabled={!listPrice || listPrice <= 0} className="w-full bg-cyan-500 text-white font-black uppercase py-4 rounded-xl disabled:opacity-50">Confirm</button>
        </div></div>
      )}

      {/* Modal: Transferir */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80"><div className="bg-[#11131a] border-2 border-indigo-500/50 rounded-3xl p-8 max-w-md w-full relative">
            <button onClick={() => setShowTransferModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] font-black text-xl">✕</button>
            <h2 className="text-3xl font-black uppercase text-center mb-6 text-indigo-400">Transfer</h2>
            <div className="bg-[#0b0e14] p-5 rounded-2xl border border-[#2a2d42] mb-8">
                <label className="text-xs font-black text-[#8f9ac6] uppercase block mb-3">Username</label>
                <input type="text" value={transferUsername} onChange={e => setTransferUsername(e.target.value)} className="bg-[#161925] border border-[#374151] rounded-xl px-4 py-3 text-white font-black w-full outline-none" />
            </div>
            <button onClick={handleConfirmTransfer} disabled={!transferUsername.trim()} className="w-full bg-indigo-500 text-white font-black uppercase py-4 rounded-xl disabled:opacity-50">Confirm</button>
        </div></div>
      )}

    </div>
  );
}
