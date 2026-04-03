"use client";
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function WalletPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState('inventory'); // 'inventory' | 'market'
  
  // Datos Reales
  const [saldoVerde, setSaldoVerde] = useState(0);
  const [saldoRojo, setSaldoRojo] = useState(0);
  const [inventario, setInventario] = useState([]);
  const [marketItems, setMarketItems] = useState([]);
  
  // Estados de UI y Multi-Sell
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false); 
  const [selectedIds, setSelectedIds] = useState(new Set()); // Para el Multi-Sell

  // Filtros
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('highest');

  const fetchData = async () => {
    setCargando(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setCargando(false);
        return;
    }
    setCurrentUser(user);

    // Mantenemos la reparación por si acaso
    await supabase.rpc('reparar_pet_35k', { p_user_id: user.id });

    const { data: profile } = await supabase.from('profiles').select('saldo_verde, saldo_rojo').eq('id', user.id).single();
    if (profile) {
        setSaldoVerde(profile.saldo_verde || 0);
        setSaldoRojo(profile.saldo_rojo || 0);
    }

    await cargarInventario(user.id);
    await cargarMarket();

    setCargando(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cargarInventario = async (uid) => {
    // CORRECCIÓN: Quitamos max_quantity de la tabla items porque no existe ahí.
    const { data, error } = await supabase
        .from('inventory')
        .select(`id, item_id, is_limited, serial_number, original_owner, items (name, value, image_url, color)`)
        .eq('user_id', uid);
    
    if (error) {
        console.error("Error al cargar inventario:", error);
        return;
    }

    if (data) {
        setInventario(data.filter(row => row.items !== null).map(row => ({
            inventarioId: row.id,
            itemId: row.item_id,
            nombre: row.items.name,
            valor: row.items.value,
            img: row.items.image_url,
            color: row.items.color || '#9ca3af',
            isLimited: row.is_limited || false,
            serial: row.serial_number || 0,
            originalOwner: row.original_owner || 'Unknown'
        })));
    }
  };

  const cargarMarket = async () => {
    const { data, error } = await supabase
        .from('marketplace')
        .select(`id, price, items (id, name, image_url, color)`);
    
    if (!error && data) {
        setMarketItems(data.filter(row => row.items !== null).map(row => ({
            marketId: row.id,
            itemId: row.items.id,
            nombre: row.items.name,
            precio: row.price,
            img: row.items.image_url,
            color: row.items.color || '#9ca3af'
        })));
    }
  };

  // --- LÓGICA DE VENTA MULTIPLE & COMISIONES ---
  const calcularVenta = (valorOriginal) => {
    let feePercentage = 0.10; 
    if (valorOriginal > 1000000) feePercentage = 0.02; 
    else if (valorOriginal > 500000) feePercentage = 0.04; 
    else if (valorOriginal > 100000) feePercentage = 0.06; 
    else if (valorOriginal > 10000) feePercentage = 0.08; 

    const feeAmount = Math.floor(valorOriginal * feePercentage);
    const sellPrice = valorOriginal - feeAmount;
    
    return { sellPrice, feePercentage: (feePercentage * 100).toFixed(0) };
  };

  const toggleSelect = (invId) => {
    if (tab !== 'inventory') return;
    const newSet = new Set(selectedIds);
    if (newSet.has(invId)) newSet.delete(invId);
    else newSet.add(invId);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredInventory.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredInventory.map(p => p.inventarioId)));
  };

  const venderSeleccionadas = async () => {
    if (procesando || selectedIds.size === 0) return;
    
    const petsToSell = inventario.filter(p => selectedIds.has(p.inventarioId));
    let totalSellPrice = 0;
    let marketInserts = [];

    petsToSell.forEach(pet => {
        const { sellPrice } = calcularVenta(pet.valor);
        totalSellPrice += sellPrice;
        marketInserts.push({ seller_id: currentUser.id, item_id: pet.itemId, price: pet.valor });
    });

    if (!confirm(`¿Vender ${petsToSell.length} mascotas?\nRecibirás: ${totalSellPrice.toLocaleString()} 🟢`)) return;
    
    setProcesando(true);
    
    try {
      const nuevoSaldo = saldoVerde + totalSellPrice;
      await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);

      const idsToDelete = Array.from(selectedIds);
      await supabase.from('inventory').delete().in('id', idsToDelete);
      await supabase.from('marketplace').insert(marketInserts);

      alert(`¡Venta Múltiple Exitosa!\nRecibiste: ${totalSellPrice.toLocaleString()} 🟢\nTus items ahora están en el mercado.`);
      setSelectedIds(new Set());
      await fetchData(); 
    } catch (error) {
      console.error("Error al vender múltiples:", error);
      alert("Error al intentar vender las mascotas.");
    }
    
    setProcesando(false);
  };

  const comprarDelMarket = async (marketId, petName, precio, itemId) => {
    if (procesando) return;
    if (saldoVerde < precio) return alert("No tienes suficiente Saldo Verde para comprar esto.");
    if (!confirm(`¿Comprar ${petName} por ${precio.toLocaleString()} 🟢?`)) return;

    setProcesando(true);
    
    try {
      const nuevoSaldo = saldoVerde - precio;
      await supabase.from('profiles').update({ saldo_verde: nuevoSaldo }).eq('id', currentUser.id);
      await supabase.from('inventory').insert({ user_id: currentUser.id, item_id: itemId });
      await supabase.from('marketplace').delete().eq('id', marketId);

      alert(`¡Compraste ${petName} con éxito! Ve a revisar tu inventario.`);
      await fetchData(); 
    } catch (error) {
      alert("Error al intentar comprar la mascota.");
    }
    
    setProcesando(false);
  };

  const filteredInventory = useMemo(() => {
    let result = [...inventario];
    if (search.trim() !== '') result = result.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));
    
    result.sort((a, b) => {
        if (sortBy === 'highest') return b.valor - a.valor;
        if (sortBy === 'lowest') return a.valor - b.valor;
        if (sortBy === 'limited') return (b.isLimited ? 1 : 0) - (a.isLimited ? 1 : 0);
        if (sortBy === 'name') return a.nombre.localeCompare(b.nombre);
        return 0;
    });
    return result;
  }, [inventario, search, sortBy]);

  const filteredMarket = useMemo(() => {
    let result = [...marketItems];
    if (search.trim() !== '') result = result.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));
    
    result.sort((a, b) => {
        if (sortBy === 'highest') return b.precio - a.precio;
        if (sortBy === 'lowest') return a.precio - b.precio;
        if (sortBy === 'name') return a.nombre.localeCompare(b.nombre);
        return 0;
    });
    return result;
  }, [marketItems, search, sortBy]);

  const totalInventoryValue = useMemo(() => inventario.reduce((sum, pet) => sum + pet.valor, 0), [inventario]);
  const selectedValue = inventario.filter(p => selectedIds.has(p.inventarioId)).reduce((sum, p) => sum + calcularVenta(p.valor).sellPrice, 0);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden font-sans pb-32">
      {/* Luces Ambientales de Fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[150px] pointer-events-none z-0"></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* === HEADER === */}
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
                       <GreenCoin cls="w-7 h-7 animate-pulse-slow"/> {formatValue(saldoVerde)}
                   </p>
               </div>
            </div>

            <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-[#ef4444]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
               <div className="relative z-10">
                   <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Red Balance (Withdraw)</p>
                   <p className="text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                       <RedCoin cls="w-7 h-7 animate-pulse-slow"/> {formatValue(saldoRojo)}
                   </p>
               </div>
            </div>

            <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-6 flex flex-col justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-7xl opacity-5 grayscale">🎒</div>
               <p className="text-[#555b82] text-xs font-black uppercase tracking-widest mb-1 relative z-10">Total Vault Value</p>
               <p className="text-2xl font-black text-[#8f9ac6] flex items-center gap-2 relative z-10">
                   <RedCoin cls="w-6 h-6 grayscale opacity-50"/> {formatValue(totalInventoryValue)}
               </p>
               <p className="text-[#555b82] text-[10px] font-black uppercase mt-1 relative z-10">{inventario.length} items owned</p>
            </div>
          </div>
        </div>

        {/* === TABS === */}
        <div className="flex gap-4 mb-8 border-b border-[#252839] pb-4 relative z-10">
          <button 
            onClick={() => { setTab('inventory'); setSelectedIds(new Set()); }} 
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm shadow-lg ${tab === 'inventory' ? 'bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white shadow-[0_0_20px_rgba(108,99,255,0.4)] hover:scale-105' : 'bg-[#14151f] text-[#8f9ac6] border border-[#252839] hover:bg-[#1c1f2e] hover:-translate-y-1'}`}
          >
            My Pets ({inventario.length})
          </button>
          <button 
            onClick={() => setTab('market')} 
            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition-all text-sm flex items-center gap-2 shadow-lg ${tab === 'market' ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0b0e14] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-105' : 'bg-[#14151f] text-[#8f9ac6] border border-[#252839] hover:bg-[#1c1f2e] hover:-translate-y-1'}`}
          >
            Marketplace 🏪
          </button>
        </div>

        {/* === ZONA PRINCIPAL === */}
        <div className="bg-[#14151f]/80 backdrop-blur-xl border border-[#252839] rounded-[2rem] p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] min-h-[500px] relative z-10">
            
            <img src="/teto.png" alt="Teto Decoración" className="absolute -right-10 -bottom-10 w-64 opacity-[0.03] pointer-events-none z-0" onError={(e) => e.target.style.display = 'none'} />

            {/* FILTROS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 relative z-10">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2 drop-shadow-md">
                      {tab === 'inventory' ? 'Inventory' : 'Global Market'}
                      {procesando && <span className="w-5 h-5 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin ml-3 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>}
                  </h2>
                  {tab === 'inventory' && filteredInventory.length > 0 && (
                    <button onClick={selectAll} className="text-[#8f9ac6] hover:text-white text-xs font-black uppercase tracking-widest transition-colors bg-[#0b0e14] px-4 py-2 rounded-lg border border-[#252839]">
                      {selectedIds.size === filteredInventory.length ? 'Deselect All' : 'Select All'}
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

            {/* ESTADOS */}
            {cargando ? (
                <div className="py-32 flex flex-col items-center justify-center relative z-10">
                    <div className="w-16 h-16 border-4 border-[#252839] border-t-[#6C63FF] rounded-full animate-spin mb-6 shadow-[0_0_15px_#6C63FF]"></div>
                    <p className="text-[#8f9ac6] font-black uppercase tracking-widest animate-pulse">Loading assets...</p>
                </div>
            ) : tab === 'inventory' && filteredInventory.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#0b0e14]/50 rounded-3xl border-2 border-dashed border-[#252839] relative z-10">
                    <span className="text-6xl opacity-30 grayscale mb-6 drop-shadow-md">🎒</span>
                    <p className="text-[#8f9ac6] font-black text-2xl mb-2 uppercase tracking-widest">No pets found</p>
                    <p className="text-[#555b82] text-sm font-bold text-center px-4">Your inventory is empty. Open some cases or buy in the market!</p>
                </div>
            ) : tab === 'market' && filteredMarket.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#0b0e14]/50 rounded-3xl border-2 border-dashed border-[#252839] relative z-10">
                    <span className="text-6xl opacity-30 grayscale mb-6 drop-shadow-md">🏪</span>
                    <p className="text-[#8f9ac6] font-black text-2xl mb-2 uppercase tracking-widest">Market is empty</p>
                    <p className="text-[#555b82] text-sm font-bold text-center px-4">No one is selling anything right now. Check back later.</p>
                </div>
            ) : (
                /* GRID DE ITEMS CON DISEÑO CABRÓN Y MULTI-SELL */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5 max-h-[650px] overflow-y-auto custom-scrollbar pr-2 pb-6 relative z-10">
                    
                    {tab === 'inventory' && filteredInventory.map((pet, i) => {
                      const { sellPrice } = calcularVenta(pet.valor);
                      const isSelected = selectedIds.has(pet.inventarioId);
                      
                      return (
                        <div 
                           key={pet.inventarioId} 
                           onClick={() => toggleSelect(pet.inventarioId)}
                           className={`cursor-pointer relative bg-[#0b0e14] border-2 rounded-2xl p-4 flex flex-col items-center justify-between transition-all duration-300 group overflow-hidden h-[250px] animate-fade-in-up
                            ${pet.isLimited ? 'border-[#facc15]' : isSelected ? 'border-[#22c55e]' : 'border-[#252839] hover:border-white/20'}
                            ${isSelected ? 'shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-[1.02] -translate-y-2' : 'hover:-translate-y-1'}
                           `} 
                           style={{animationDelay: `${i * 30}ms`}}
                        >
                            {/* EFECTO HOLOGRÁFICO PARA LIMITADOS */}
                            {pet.isLimited && (
                               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0" style={{ backgroundSize: '200% 200%', animation: 'shimmer 3s infinite linear' }}></div>
                            )}

                            {/* CHECKBOX DE MULTI-SELL */}
                            <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-20
                               ${isSelected ? 'bg-[#22c55e] border-[#22c55e]' : 'bg-[#0b0e14] border-[#4a506b]'}
                            `}>
                               {isSelected && <span className="text-[#0b0e14] text-xs font-black">✓</span>}
                            </div>

                            {/* BADGE LIMITADO Y NÚMERO DE SERIE */}
                            {pet.isLimited && (
                              <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-500 to-yellow-600 text-[#0b0e14] font-black text-[9px] px-2 py-1 rounded-bl-lg rounded-tr-lg shadow-md z-20">
                                #{pet.serial}
                              </div>
                            )}

                            {/* Gradiente dinámico de fondo */}
                            <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity duration-500 z-0" style={{ background: `radial-gradient(circle at center, ${pet.color} 0%, transparent 80%)` }}></div>

                            <img src={pet.img} className={`w-20 h-20 object-contain mt-5 mb-3 z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] transition-transform duration-500 ${isSelected ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3'}`} alt="pet"/>
                            
                            <div className="w-full text-center z-10 mt-auto bg-[#14151f]/60 rounded-xl py-2 px-1 backdrop-blur-sm border border-[#252839]/50 group-hover:border-[#252839] transition-colors">
                                <div className="text-[11px] truncate text-white font-black uppercase tracking-wide px-1" style={{textShadow: `0 0 10px ${pet.color}80`}}>{pet.nombre}</div>
                                
                                {pet.isLimited && (
                                   <div className="text-[8px] font-bold text-[#8f9ac6] truncate px-1 mt-0.5 uppercase">Minter: {pet.originalOwner}</div>
                                )}

                                <div className="text-xs font-black text-[#8f9ac6] flex items-center justify-center gap-1 mt-1">
                                    <RedCoin cls="w-3 h-3 grayscale opacity-70"/> {formatValue(pet.valor)}
                                </div>
                            </div>
                        </div>
                      );
                    })}

                    {tab === 'market' && filteredMarket.map((m, i) => (
                        <div key={m.marketId} className="relative bg-[#0b0e14] border-2 border-[#252839] hover:border-[#22c55e]/50 rounded-2xl p-4 flex flex-col items-center justify-between transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(34,197,94,0.15)] group overflow-hidden h-[250px] animate-fade-in-up" style={{animationDelay: `${i * 30}ms`}}>
                            
                            <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity duration-500" style={{ background: `radial-gradient(circle at center, ${m.color} 0%, transparent 80%)` }}></div>
                            <div className="absolute top-2 right-2 bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0b0e14] text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-md z-20">SALE</div>

                            <img src={m.img} className="w-20 h-20 object-contain mt-4 mb-3 z-10 drop-shadow-[0_10px_15px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform duration-500" alt="pet" style={{filter: `drop-shadow(0 0 15px ${m.color}40)`}}/>
                            
                            <div className="w-full text-center z-10 mt-auto bg-[#14151f]/60 rounded-xl py-2 px-1 backdrop-blur-sm border border-[#252839]/50">
                                <div className="text-[11px] truncate text-white font-black uppercase tracking-wide px-1" style={{textShadow: `0 0 10px ${m.color}80`}}>{m.nombre}</div>
                                <div className="text-sm font-black text-[#22c55e] flex items-center justify-center gap-1 mt-1 drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]">
                                    <GreenCoin cls="w-4 h-4"/> {formatValue(m.precio)}
                                </div>
                            </div>

                            <button 
                                onClick={() => comprarDelMarket(m.marketId, m.nombre, m.precio, m.itemId)}
                                disabled={procesando}
                                className="w-full mt-3 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#16a34a] hover:to-[#15803d] text-[#0b0e14] text-[11px] font-black uppercase tracking-widest py-2.5 rounded-xl transition-all duration-300 z-10 shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50"
                            >
                                BUY PET
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>

      {/* BARRA FLOTANTE DE MULTI-SELL */}
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
              onClick={venderSeleccionadas} disabled={procesando}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] px-8 py-3 rounded-full font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {procesando ? 'Processing...' : 'Sell to Market'}
            </button>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { opacity: 0; animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
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
      `}} />
    </div>
  );
}
