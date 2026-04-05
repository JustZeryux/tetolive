"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// 🚀 OPTIMIZACIÓN: CARTA MEMOIZADA (Sirve para Inventario y Market)
const PetVisualCard = React.memo(({ item, mode, isSelected, isLocked, onToggleSelect, onToggleLock, onMarketClick }) => {
  const isDBLimited = item.is_limited || item.limited || false;
  const variants = getPetVariants(item.name || item.item?.name, isDBLimited);
  const banner = getBannerInfo(variants);
  
  const name = item.name || item.item?.name || 'Unknown';
  const img = item.img || item.image_url || item.item?.image_url || '/default-pet.png';
  const color = item.color || item.item?.color || '#ffffff';
  // En market el precio puede ser item.market_price, en inv es item.value
  const price = mode === 'market' ? (item.market_price || item.price) : (item.price || item.valor || item.item?.value || 0);
  const serial = item.serial_number || item.serial || null;
  const seller = item.seller_name || item.seller || null; // Para el market

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

      {/* Banner de Rareza */}
      {banner && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-max max-w-[95%] z-40 pointer-events-none">
              <div className={`font-black py-0.5 rounded-b-lg uppercase tracking-[0.2em] border-b-2 text-center whitespace-nowrap ${banner.bgClass} ${banner.textScale}`}>
                  {banner.text}
              </div>
          </div>
      )}

      {/* INVENTORY MODE: Checkbox y Candado */}
      {mode === 'inventory' && (
        <>
            <div 
                onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-50 cursor-pointer shadow-lg
                ${isSelected ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-black/60 border-gray-500 hover:border-white backdrop-blur-md'}
                `}
            >
                {isSelected && <span className="text-white text-sm font-black drop-shadow-md">✓</span>}
            </div>

            {onToggleLock && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }}
                    className={`absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center transition-all z-50 cursor-pointer backdrop-blur-md border
                        ${isLocked ? 'bg-black/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30'}
                    `}
                >
                    <LockIcon isLocked={isLocked} />
                </div>
            )}
        </>
      )}

      {/* MARKET MODE: Etiqueta de Vendedor en vez de candados */}
      {mode === 'market' && seller && (
          <div className="absolute top-2 right-2 bg-black/70 border border-[#2a2d42] backdrop-blur-md px-2 py-1 rounded-lg z-50 shadow-lg max-w-[90px]">
              <span className="text-[9px] font-bold text-[#8f9ac6] uppercase block leading-none">Seller</span>
              <span className="text-[10px] font-black text-white truncate block">{seller}</span>
          </div>
      )}

      {/* Imagen Animada */}
      <div className="pet-image-container z-30 mt-5 pointer-events-none">
        {(variants.isXL || variants.isMythic || variants.isLimited) && (
            <div className={`absolute bottom-0 w-24 h-5 blur-[12px] rounded-full mix-blend-screen transition-opacity duration-500 pet-floor-shadow
                ${variants.isLimited ? 'bg-fuchsia-500/50' : variants.isXL ? 'bg-yellow-500/50' : 'bg-red-500/50'}`}>
            </div>
        )}
        <img src={img} alt={name} className="pet-image" loading="lazy" />
      </div>

      {/* Info Bottom */}
      <div className="pet-info-bar z-40">
        <p className={`pet-name ${variants.isShiny && variants.isMythic ? 'holo-text' : ''}`}>{name}</p>
        
        {(variants.isMythic || variants.isLimited) && serial && (
            <span className={`text-[10px] font-black uppercase tracking-[0.1em] block mt-0.5 ${variants.isLimited ? 'text-fuchsia-400' : 'text-yellow-400'}`}>
                #{serial}
            </span>
        )}

        <div className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1 mt-1.5 border w-full backdrop-blur-md transition-colors
            ${mode === 'market' ? 'bg-cyan-950/40 border-cyan-500/30 group-hover:bg-cyan-600/50' : 'bg-black/60 border-white/10'}
        `}>
            {/* Si es market, podemos usar un botón de "Buy", o solo el precio destacado */}
            <GreenCoin cls="w-3.5 h-3.5 grayscale opacity-80" /> 
            <span className={`text-[12px] font-black tracking-widest ${mode === 'market' ? 'text-cyan-400' : 'text-gray-100'}`}>
                {formatValue(price)}
            </span>
        </div>
      </div>
    </div>
  );
});

export default function EconomyPage() {
  // --- ESTADOS GLOBALES ---
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'marketplace'
  const [isLoading, setIsLoading] = useState(true);
  
  // Economy Stats (Sustituir con tu Fetch a Supabase real)
  const [balances, setBalances] = useState({ green: 3830000, red: 1580000, totalValue: 1580000 });
  
  // Items Data
  const [inventoryItems, setInventoryItems] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  
  // Controles de Inventario
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [lockedItemIds, setLockedItemIds] = useState(new Set());

  // Controles de Búsqueda y Paginación (Unificados para evitar lag)
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30; 

  // --- ESTADOS DE MODALES Y FUNCIONES EXTRAS ---
  const [showListModal, setShowListModal] = useState(false);
  const [listPrice, setListPrice] = useState('');
  const [itemToList, setItemToList] = useState(null); // Si se selecciona solo 1, o para el grupo
  
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [itemToBuy, setItemToBuy] = useState(null);

  // --- CARGA DE DATOS (MOCK) ---
// --- CARGA DE DATOS REAL DESDE SUPABASE ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Obtener usuario actual
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
            setIsLoading(false);
            return;
        }

        // 2. Obtener Perfil para los Balances Reales
        const { data: profile } = await supabase.from('profiles')
          .select('*')
          .eq('id', userData.user.id)
          .single();

        if (profile) {
          setBalances(prev => ({
            ...prev,
            green: profile.saldo_verde || 0,
            red: profile.saldo_rojo || 0 // Cambia 'saldo_rojo' si tu columna se llama distinto
          }));
        }

        // 3. Obtener Inventario Real (Haciendo Join con la tabla de items)
        const { data: inventoryData, error: invError } = await supabase
          .from('inventory')
          .select('*, items(*)') // Trae la data del inventario Y la info de la mascota
          .eq('user_id', userData.user.id);

        if (invError) throw invError;

        // 4. Obtener Market Real (Ajusta 'marketplace' si tu tabla se llama diferente)
        const { data: marketData, error: mktError } = await supabase
          .from('marketplace')
          .select('*, items(*)'); 

        if (mktError) throw mktError;

        // Formatear Inventario y calcular el Total Value
        let totalVal = 0;
        const lockedSet = new Set();

        const formattedInv = (inventoryData || []).map(row => {
           // Dependiendo de cómo hiciste el join, la data de la pet está en row.items o row.item
           const petData = row.items || row.item || {}; 
           const price = petData.value || petData.valor || petData.price || 0;
           totalVal += price;
           
           if (row.is_locked) lockedSet.add(row.id); // Si tienes sistema de bloqueo en BD

           return {
               ...row, // id del inventario, user_id, etc.
               ...petData, // name, image_url, color, etc.
               id: row.id, // Sobrescribimos el ID para usar el del inventario
               item_id: petData.id,
               price: price // Normalizamos el precio
           };
        });

        // Formatear Marketplace
        const formattedMarket = (marketData || []).map(row => {
           const petData = row.items || row.item || {};
           return {
               ...row,
               ...petData,
               id: row.id,
               item_id: petData.id,
               market_price: row.price || row.market_price || petData.value // El precio al que se listó
           };
        });

        // Actualizar los estados con TU data real
        setBalances(prev => ({ ...prev, totalValue: totalVal }));
        setLockedItemIds(lockedSet);
        setInventoryItems(formattedInv);
        setMarketItems(formattedMarket);

      } catch (error) {
        console.error("🚨 Error cargando datos de Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // --- LÓGICA DEL INVENTARIO ---
  const handleToggleSelect = useCallback((id) => {
    setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  const handleToggleLock = useCallback((id) => {
    setLockedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
    // TODO: Supabase UPDATE -> set is_locked = true/false
  }, []);

  // --- LÓGICA DEL MARKETPLACE ---
  const handleMarketItemClick = useCallback((item) => {
      setItemToBuy(item);
      setShowBuyModal(true);
  }, []);

  const handleConfirmPurchase = async () => {
      if (!itemToBuy) return;
      alert(`Comprando ${itemToBuy.name} por ${formatValue(itemToBuy.market_price)}! (Aquí va tu lógica de Supabase)`);
      setShowBuyModal(false);
      setItemToBuy(null);
  };

  const handleListToMarket = () => {
      // Abre el modal para listar los items seleccionados
      setShowListModal(true);
  };

  const handleConfirmListing = async () => {
      alert(`Listando ${selectedItemIds.size} items por ${formatValue(Number(listPrice))} cada uno!`);
      setShowListModal(false);
      setListPrice('');
      setSelectedItemIds(new Set());
  };

  // --- MOTOR ANTI-LAG (FILTROS Y PAGINACIÓN) ---
  const currentItemsRaw = activeTab === 'inventory' ? inventoryItems : marketItems;
  
  const filteredAndSortedItems = useMemo(() => {
    let result = [...currentItemsRaw];
    
    if (searchTerm) {
        result = result.filter(item => {
            const name = (item.name || item.item?.name || '').toLowerCase();
            return name.includes(searchTerm.toLowerCase());
        });
    }

    result.sort((a, b) => {
      const priceA = activeTab === 'market' ? (a.market_price || 0) : (a.price || a.item?.value || 0);
      const priceB = activeTab === 'market' ? (b.market_price || 0) : (b.price || b.item?.value || 0);
      
      if (sortBy === 'price_asc') return priceA - priceB;
      if (sortBy === 'price_desc') return priceB - priceA;
      return 0;
    });

    return result;
  }, [currentItemsRaw, searchTerm, sortBy, activeTab]);

  const handleSelectAll = () => {
      if (selectedItemIds.size > 0) {
          setSelectedItemIds(new Set()); // Deseleccionar
      } else {
          // Seleccionar solo filtrados que NO estén bloqueados
          const idsToAdd = filteredAndSortedItems
              .filter(item => !lockedItemIds.has(item.id))
              .map(item => item.id);
          setSelectedItemIds(new Set(idsToAdd));
      }
  };

  const paginatedItems = filteredAndSortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

  // Reseteos automáticos al cambiar de pestaña
  useEffect(() => { 
      setCurrentPage(1); 
      setSelectedItemIds(new Set()); 
  }, [searchTerm, sortBy, activeTab]);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans selection:bg-cyan-500 relative overflow-hidden">
      
      {/* Fondos Decorativos */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6366f1]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* --- HEADER --- */}
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mb-8">
            Economy & Vault
        </h1>

        {/* --- TARJETAS DE BALANCE --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden transition-transform hover:-translate-y-1 hover:border-green-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Green Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white">
                    <GreenCoin cls="w-8 h-8" /> {formatValue(balances.green)}
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden transition-transform hover:-translate-y-1 hover:border-red-500/50">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Red Balance</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white">
                    <RedCoin cls="w-8 h-8" /> {formatValue(balances.red)}
                </div>
            </div>

            <div className="bg-gradient-to-br from-[#11131a] to-[#0a0c10] border border-[#2a2d42] rounded-3xl p-6 shadow-lg relative overflow-hidden transition-transform hover:-translate-y-1 hover:border-cyan-500/50 sm:col-span-2 md:col-span-1">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2">Total Inventory Value</p>
                <div className="flex items-center gap-3 text-3xl font-black text-white">
                    <GreenCoin cls="w-8 h-8 grayscale opacity-70" /> {formatValue(balances.totalValue)}
                </div>
                <p className="text-[#4a506b] text-[10px] font-bold uppercase tracking-wider mt-2">{inventoryItems.length} Items Owned</p>
            </div>
        </div>

        {/* --- SELECTOR DE PESTAÑAS --- */}
        <div className="flex flex-wrap gap-4 mb-8 border-b border-[#2a2d42] pb-6">
            <button 
                onClick={() => setActiveTab('inventory')} 
                className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3 
                ${activeTab === 'inventory' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-[0_0_25px_rgba(99,102,241,0.5)] border-transparent scale-105' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white hover:border-[#6366f1]'}`}
            >
                🎒 My Pets <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs">{inventoryItems.length}</span>
            </button>
            <button 
                onClick={() => setActiveTab('marketplace')} 
                className={`px-8 py-3.5 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-md flex items-center gap-3
                ${activeTab === 'marketplace' ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_25px_rgba(6,182,212,0.5)] border-transparent scale-105' : 'bg-[#11131a] text-[#8f9ac6] border border-[#2a2d42] hover:text-white hover:border-cyan-500'}`}
            >
                🏪 Global Market <span className="bg-black/30 px-2 py-0.5 rounded-md text-xs">Live</span>
            </button>
        </div>

        {/* --- CONTENEDOR PRINCIPAL --- */}
        <div className="bg-[#0f1118]/80 backdrop-blur-xl border border-[#2a2d42] rounded-[2rem] p-4 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden min-h-[600px]">
            
            {/* TOOLBAR (Buscador y Filtros) */}
            <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-5">
                
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className={`text-2xl font-black uppercase tracking-widest ${activeTab === 'market' ? 'text-cyan-400' : 'text-white'}`}>
                        {activeTab === 'inventory' ? 'Inventory' : 'Marketplace'}
                    </h2>
                    {activeTab === 'inventory' && !isLoading && (
                        <button onClick={handleSelectAll} className="bg-[#1a1c29] border border-[#374151] hover:border-cyan-500 text-white text-xs font-black uppercase tracking-wider px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-md">
                            {selectedItemIds.size > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-72">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8f9ac6] text-sm">🔍</span>
                        <input 
                            type="text" placeholder="Search pets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 pl-10 pr-4 focus:border-cyan-500 outline-none transition-all font-bold text-sm shadow-inner"
                        />
                    </div>
                    
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full sm:w-auto bg-[#161925] border border-[#2a2d42] text-white rounded-xl py-3 px-5 font-bold text-sm outline-none cursor-pointer focus:border-cyan-500 shadow-sm">
                        <option value="price_desc">Highest Value</option>
                        <option value="price_asc">Lowest Value</option>
                    </select>
                </div>
            </div>

            {/* THE GRID */}
            {isLoading ? (
                <div className="flex justify-center items-center py-40 flex-col gap-6">
                    <div className="w-20 h-20 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(99,102,241,0.5)]"></div>
                    <span className="text-[#8f9ac6] font-black uppercase tracking-[0.2em] animate-pulse">Loading Vault...</span>
                </div>
            ) : paginatedItems.length === 0 ? (
                <div className="flex justify-center items-center py-32 flex-col gap-4 bg-[#11131a]/50 rounded-[2rem] border-2 border-dashed border-[#2a2d42]">
                    <span className="text-6xl grayscale opacity-50">📦</span>
                    <span className="text-[#4a506b] text-xl font-black uppercase tracking-widest">No items found</span>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5 pb-32">
                    {paginatedItems.map((item) => (
                        <PetVisualCard 
                            key={item.id} 
                            item={item} 
                            mode={activeTab}
                            isSelected={selectedItemIds.has(item.id)}
                            isLocked={lockedItemIds.has(item.id)}
                            onToggleSelect={handleToggleSelect}
                            onToggleLock={handleToggleLock}
                            onMarketClick={handleMarketItemClick}
                        />
                    ))}
                </div>
            )}

            {/* PAGINATION */}
            {!isLoading && totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-8 pb-4 absolute bottom-6 left-1/2 -translate-x-1/2 w-full">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white flex justify-center items-center font-black disabled:opacity-30 hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all border border-[#2a2d42]">&lsaquo;</button>
                    <div className="bg-[#11131a] border border-[#2a2d42] px-6 py-3 rounded-xl shadow-inner">
                        <span className="text-[#8f9ac6] font-black text-sm uppercase tracking-widest">Page <span className="text-white mx-1">{currentPage}</span> of {totalPages}</span>
                    </div>
                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="w-12 h-12 rounded-xl bg-[#1a1c29] text-white flex justify-center items-center font-black disabled:opacity-30 hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all border border-[#2a2d42]">&rsaquo;</button>
                </div>
            )}
        </div>

        {/* --- FLOATING ACTION BAR (INVENTARIO) --- */}
        {selectedItemIds.size > 0 && activeTab === 'inventory' && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0b0e14]/95 backdrop-blur-xl border-2 border-indigo-500/50 rounded-2xl py-4 px-6 md:px-10 shadow-[0_30px_60px_rgba(0,0,0,0.9),_0_0_40px_rgba(99,102,241,0.3)] z-50 flex flex-col md:flex-row items-center gap-4 md:gap-10 animate-bounce-in-up w-[95%] md:w-auto">
                
                <div className="flex flex-col text-center md:text-left">
                    <span className="text-white font-black text-xl tracking-wide">{selectedItemIds.size} Items Selected</span>
                    <span className="text-[#8f9ac6] font-bold text-[10px] uppercase tracking-widest">Locked items are protected</span>
                </div>
                
                <div className="hidden md:block w-px h-12 bg-[#2a2d42]"></div>
                
                <div className="flex flex-wrap justify-center gap-3 w-full md:w-auto">
                    {/* Botón List on Market */}
                    <button onClick={handleListToMarket} className="flex-1 md:flex-none bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_5px_20px_rgba(6,182,212,0.4)] transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
                        🏪 List on Market
                    </button>
                    {/* Botón Transfer */}
                    <button className="flex-1 md:flex-none bg-[#1a1c29] hover:bg-[#2a2d42] border border-[#374151] hover:border-white/50 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all hover:-translate-y-1 active:scale-95">
                        Transfer
                    </button>
                    {/* Botón Quick Sell */}
                    <button className="flex-1 md:flex-none bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 border border-red-500/50 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_5px_15px_rgba(220,38,38,0.4)] transition-all hover:-translate-y-1 active:scale-95">
                        Quick Sell
                    </button>
                </div>
            </div>
        )}

      </div>

      {/* --- MODALES DE MARKETPLACE --- */}

      {/* Modal: Listar en el Mercado */}
      {showListModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/80 animate-fade-in">
            <div className="bg-[#11131a] border-2 border-cyan-500/50 rounded-3xl p-8 max-w-md w-full shadow-[0_0_60px_rgba(6,182,212,0.2)] relative overflow-hidden animate-bounce-in-up">
                <button onClick={() => setShowListModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] hover:text-white font-black text-xl">✕</button>
                <h2 className="text-3xl font-black uppercase text-center mb-2 tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">List Items</h2>
                <p className="text-[#8f9ac6] text-center mb-8 font-bold text-sm">You are about to list {selectedItemIds.size} item(s) on the Global Market.</p>
                
                <div className="bg-[#0b0e14] p-5 rounded-2xl border border-[#2a2d42] mb-8">
                    <label className="text-xs font-black text-[#8f9ac6] uppercase tracking-widest block mb-3">Price per item (Green Coins)</label>
                    <div className="flex items-center gap-3 bg-[#161925] border border-[#374151] rounded-xl px-4 py-3 focus-within:border-cyan-500 transition-colors">
                        <GreenCoin cls="w-6 h-6"/>
                        <input 
                            type="number" value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="0"
                            className="bg-transparent border-none text-white font-black text-2xl outline-none w-full placeholder:text-gray-600"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleConfirmListing} 
                    disabled={!listPrice || listPrice <= 0}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_10px_20px_rgba(6,182,212,0.4)] hover:shadow-[0_15px_30px_rgba(6,182,212,0.6)] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                    Confirm Listing
                </button>
            </div>
        </div>
      )}

      {/* Modal: Comprar del Mercado */}
      {showBuyModal && itemToBuy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/80 animate-fade-in">
            <div className="bg-[#11131a] border-2 border-[#2a2d42] rounded-3xl p-8 max-w-sm w-full shadow-[0_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden animate-bounce-in-up flex flex-col items-center">
                <button onClick={() => setShowBuyModal(false)} className="absolute top-4 right-4 text-[#8f9ac6] hover:text-white font-black text-xl">✕</button>
                
                <h2 className="text-2xl font-black uppercase text-center mb-6 tracking-widest text-white">Purchase Item</h2>
                
                {/* Visual del item en el modal */}
                <div className="w-40 h-48 pointer-events-none mb-6">
                    <PetVisualCard item={itemToBuy} mode="inventory" /> 
                </div>

                <div className="w-full bg-[#0b0e14] p-4 rounded-2xl border border-[#2a2d42] mb-6 flex justify-between items-center">
                    <span className="text-xs font-black text-[#8f9ac6] uppercase tracking-widest">Price:</span>
                    <span className="text-xl font-black text-white flex items-center gap-2"><GreenCoin/> {formatValue(itemToBuy.market_price)}</span>
                </div>

                <button onClick={handleConfirmPurchase} className="w-full bg-gradient-to-r from-green-500 to-emerald-700 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-[0_10px_20px_rgba(34,197,94,0.4)] hover:shadow-[0_15px_30px_rgba(34,197,94,0.6)] hover:-translate-y-1 transition-all">
                    Confirm Buy
                </button>
            </div>
        </div>
      )}


      <style jsx global>{`
        /* --- MOTOR ANTI-LAG (60 FPS) --- */
        .pet-card-visual {
            background: #11131a; border-radius: 1.2rem; padding: 0.5rem; display: flex; flex-direction: column;
            align-items: center; justify-content: center; position: relative; 
            transition: transform 0.2s ease-out, box-shadow 0.2s ease-out, border-color 0.2s ease-out;
            box-shadow: 0 10px 20px rgba(0,0,0,0.6); overflow: hidden; width: 100%; height: 210px; border: 2px solid transparent;
            
            /* HARDWARE ACCELERATION Y SKIP RENDER PARA INVENTARIOS GIGANTES */
            will-change: transform, box-shadow; 
            transform: translateZ(0); 
            content-visibility: auto; 
            contain-intrinsic-size: 210px; 
        }

        .pet-card-visual:not(.is-market-item):hover { transform: translateY(-5px) scale(1.02); box-shadow: 0 15px 30px rgba(0,0,0,0.8), 0 0 15px var(--item-color, #ffffff)30; z-index: 10; }
        .pet-card-visual.is-market-item:hover { border-color: #06b6d450; box-shadow: 0 15px 30px rgba(0,0,0,0.8), 0 0 20px rgba(6,182,212,0.3); z-index: 10; }

        .pet-card-visual.is-selected { border-color: #06b6d4 !important; box-shadow: 0 10px 30px rgba(0,0,0,0.7), inset 0 0 20px rgba(6,182,212,0.2) !important; }

        /* Capas base */
        .pet-glow-layer { position: absolute; inset: 0; opacity: 0.15; pointer-events: none; z-index: 1; background: radial-gradient(circle at center, var(--item-color, #ffffff) 0%, transparent 75%); }
        .pet-card-visual:hover .pet-glow-layer { opacity: 0.3; }

        .pet-info-bar { width: 100%; text-align: center; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.7); padding: 0.4rem; z-index: 40; border-radius: 0 0 1rem 1rem; }
        
        .pet-image-container { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; width: 100%; z-index: 30;}
        .pet-image { width: auto; max-width: 80%; height: auto; max-height: 85px; object-fit: contain; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.8)); transition: transform 0.3s ease; }
        .pet-floor-shadow { transition: opacity 0.3s ease, transform 0.3s ease; opacity: 0.4; transform: scale(1); }

        .pet-card-visual:hover .pet-image { transform: scale(1.1) rotate(-3deg); filter: drop-shadow(0 15px 20px rgba(0,0,0,0.9)) drop-shadow(0 0 10px var(--item-color, #ffffff)40); }
        .pet-card-visual:hover .pet-floor-shadow { opacity: 0.7; transform: scale(1.2); }

        .pet-name { font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.65rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white; }

        /* --- EFECTOS MODULARES --- */
        .is-standard { border-color: rgba(255,255,255,0.05); }

        /* SHINY */
        .has-shiny { box-shadow: 0 10px 20px rgba(0,0,0,0.6), 0 0 10px #00FFFF10; }
        .has-shiny.is-standard { border-color: #00FFFF30; }
        .has-shiny .pet-name { color: #00FFFF; text-shadow: 0 0 10px #00FFFF60; }
        .shiny-glint { position: absolute; top: 0; left: -100%; width: 40%; height: 100%; z-index: 25; background: linear-gradient(to right, transparent, rgba(0, 255, 255, 0.4), transparent); transform: skewX(-25deg); animation: shiny-laser 5s infinite; pointer-events: none; mix-blend-mode: color-dodge; }

        /* MYTHIC */
        .has-mythic { border-color: #DC143C40; box-shadow: inset 0 0 15px #DC143C20; }
        .has-mythic .pet-name { color: #FF4D6D; text-shadow: 0 0 10px #DC143C80; }
        .mythic-aura { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 150%; height: 150%; background: radial-gradient(circle, rgba(220, 20, 60, 0.25) 0%, transparent 60%); animation: pulse-aura 4s infinite alternate; pointer-events: none; z-index: 2; mix-blend-mode: screen; }

        /* SHINY MYTHIC */
        .has-shiny-mythic { border-color: #fff3; background: linear-gradient(135deg, #11131a 0%, #1a1a2e 100%); }
        .holo-text { background: linear-gradient(90deg, #FF69B4, #00FFFF, #FFD700, #FF69B4); -webkit-background-clip: text; color: transparent; animation: rainbow-bg 5s linear infinite; background-size: 300% 100%; }
        .holographic-sweep { position: absolute; inset: 0; z-index: 25; opacity: 0.3; mix-blend-mode: color-dodge; pointer-events: none; background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.4) 25%, rgba(0,255,255,0.4) 30%, transparent 35%, transparent 40%, rgba(255,0,255,0.3) 45%, transparent 50%); background-size: 200% 200%; animation: holo-shine 5s linear infinite; }

        /* XL */
        .has-xl { border-color: transparent !important; box-shadow: 0 15px 30px rgba(0,0,0,0.8), 0 0 20px #FFD70020 !important; }
        .has-xl:before { content: ''; position: absolute; inset: -2px; border-radius: 1.2rem; pointer-events: none; background: linear-gradient(135deg, #8a6e12 0%, #FFD700 30%, #fff8d1 50%, #FFD700 70%, #8a6e12 100%); background-size: 400% 400%; z-index: -1; }
        .has-xl .pet-name { color: #FFD700 !important; -webkit-text-fill-color: initial; background: none; }
        .xl-god-rays { position: absolute; top: 50%; left: 50%; width: 250%; height: 250%; transform: translate(-50%, -50%); background: repeating-conic-gradient(from 0deg, transparent 0deg 15deg, rgba(255, 215, 0, 0.1) 15deg 30deg); animation: spin-rays 30s linear infinite; pointer-events: none; z-index: 3; }
        .xl-particles { position: absolute; inset: 0; opacity: 0.2; animation: particles-rise 5s linear infinite; pointer-events: none; z-index: 4; background-image: radial-gradient(#FFD700 2px, transparent 2px); background-size: 30px 30px; }

        /* LIMITED */
        .has-limited { border-color: transparent !important; background: #000 !important;}
        .has-limited:after { content: ''; position: absolute; inset: -2px; border-radius: 1.2rem; pointer-events: none; background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000); background-size: 200% auto; animation: rainbow-bg 3s linear infinite; z-index: -1; }
        .has-limited .pet-name { background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important; -webkit-background-clip: text !important; color: transparent !important; animation: rainbow-bg 4s linear infinite !important; background-size: 200% auto !important; }
        .limited-galaxy-bg { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(255,0,255,0.2) 0%, rgba(0,0,255,0.2) 50%, transparent 100%); z-index: 2; mix-blend-mode: screen; }
        .limited-stars { position: absolute; inset: 0; background-image: radial-gradient(#fff 1.5px, transparent 1.5px); background-size: 20px 20px; animation: spin-rays 25s linear infinite; opacity: 0.4; z-index: 5; pointer-events: none; }

        .pet-sparkle-overlay { position: absolute; inset: 0; opacity: 0.1; animation: shine-sparkle 8s linear infinite; pointer-events: none; z-index: 6; background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L52 52L50 54L48 52Z" fill="%23fff" fill-opacity="0.5"/%3E%3C/svg%3E'); }

        /* --- ANIMACIONES GENERALES --- */
        @keyframes shiny-laser { 0%, 50% { left: -100%; } 100% { left: 200%; } }
        @keyframes pulse-aura { 0% { transform: translate(-50%, -50%) scale(0.9); } 100% { transform: translate(-50%, -50%) scale(1.1); } }
        @keyframes holo-shine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes spin-rays { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes shine-sparkle { 0% { background-position: 0 0; } 100% { background-position: 100px 100px; } }
        @keyframes rainbow-bg { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes particles-rise { 0% { background-position: 0 0; } 100% { background-position: 0 -100px; } }
        
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-bounce-in-up { animation: bounceInUp 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
        @keyframes bounceInUp { from { opacity: 0; transform: translate(-50%, 50px) scale(0.9); } to { opacity: 1; transform: translate(-50%, 0) scale(1); } }
        
        /* Scrollbar custom */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e14; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; border: 2px solid #0b0e14; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}
