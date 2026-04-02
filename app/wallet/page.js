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
  
  // Estados de UI
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false); // Para evitar doble clics

  // Filtros
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('highest'); // highest, lowest, name

  const fetchData = async () => {
    setCargando(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        setCargando(false);
        return;
    }
    setCurrentUser(user);

    // 1. Parche de la Pet de 35k (Se ejecuta silenciosamente)
    await supabase.rpc('reparar_pet_35k', { p_user_id: user.id });

    // 2. Cargar Saldos
    const { data: profile } = await supabase.from('perfiles').select('saldo_verde, saldo_rojo').eq('id', user.id).single();
    if (profile) {
        setSaldoVerde(profile.saldo_verde || 0);
        setSaldoRojo(profile.saldo_rojo || 0);
    }

    // 3. Cargar Mi Inventario
    await cargarInventario(user.id);
    
    // 4. Cargar Market
    await cargarMarket();

    setCargando(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const cargarInventario = async (uid) => {
    const { data, error } = await supabase
        .from('inventory')
        .select(`id, item_id, items (name, value, image_url, color)`)
        .eq('user_id', uid);
    
    if (!error && data) {
        setInventario(data.filter(row => row.items !== null).map(row => ({
            inventarioId: row.id,
            itemId: row.item_id,
            nombre: row.items.name,
            valor: row.items.value,
            img: row.items.image_url,
            color: row.items.color || '#9ca3af'
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

  // --- ACCIONES ---
  const venderPet = async (invId, petName) => {
    if (procesando) return;
    if (!confirm(`¿Vender ${petName} instantáneamente?\nEl sistema cobrará una pequeña comisión (fee) y te dará el resto en Saldo Verde.`)) return;
    
    setProcesando(true);
    const { data, error } = await supabase.rpc('procesar_venta_instantanea', { p_inv_id: invId });
    
    if (error || data?.error) {
        alert("Error al vender la mascota: " + (data?.error || error.message));
    } else {
        alert(`¡Venta Exitosa!\nRecibiste: ${data.recibido.toLocaleString()} 🟢\nComisión del sistema: ${data.fee}%`);
        await fetchData(); // Recargar todo para actualizar saldos, market e inventario
    }
    setProcesando(false);
  };

  const comprarDelMarket = async (marketId, petName, precio) => {
    if (procesando) return;
    if (saldoVerde < precio) return alert("No tienes suficiente Saldo Verde para comprar esto.");
    if (!confirm(`¿Comprar ${petName} por ${precio.toLocaleString()} 🟢?`)) return;

    setProcesando(true);
    const { data, error } = await supabase.rpc('comprar_item_market', { p_market_id: marketId, p_buyer_id: currentUser.id });

    if (error || data?.error) {
        alert("Error en la compra: " + (data?.error || error.message));
    } else {
        alert(`¡Compraste ${petName} con éxito! Ya está en tu inventario.`);
        await fetchData();
    }
    setProcesando(false);
  };

  // --- FILTROS Y ORDENAMIENTO MÚLTIPLE ---
  const filteredInventory = useMemo(() => {
    let result = [...inventario];
    if (search.trim() !== '') result = result.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));
    
    result.sort((a, b) => {
        if (sortBy === 'highest') return b.valor - a.valor;
        if (sortBy === 'lowest') return a.valor - b.valor;
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

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* =========================================
            HEADER: SALDOS Y STATS
        ========================================= */}
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md mb-6">
            Economy & Vault
          </h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* GREEN BALANCE */}
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden group">
               <div className="absolute inset-0 bg-[#22c55e] opacity-5 group-hover:opacity-10 transition-opacity"></div>
               <div>
                   <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Green Balance</p>
                   <p className="text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                       <GreenCoin cls="w-7 h-7 animate-pulse"/> {formatValue(saldoVerde)}
                   </p>
               </div>
               <button className="bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/50 hover:bg-[#22c55e]/30 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors z-10 shadow-sm">Get More</button>
            </div>

            {/* RED BALANCE */}
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 flex items-center justify-between shadow-lg relative overflow-hidden group">
               <div className="absolute inset-0 bg-[#ef4444] opacity-5 group-hover:opacity-10 transition-opacity"></div>
               <div>
                   <p className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-1">Red Balance (Withdraw)</p>
                   <p className="text-3xl font-black text-white flex items-center gap-2 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                       <RedCoin cls="w-7 h-7 animate-pulse"/> {formatValue(saldoRojo)}
                   </p>
               </div>
               <button className="bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/50 hover:bg-[#ef4444]/30 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-colors z-10 shadow-sm">Withdraw</button>
            </div>

            {/* VAULT STATS */}
            <div className="bg-[#141323] border border-[#2F3347] rounded-2xl p-6 flex flex-col justify-center shadow-inner relative overflow-hidden">
               <div className="absolute -right-4 -top-4 text-7xl opacity-5 grayscale">🎒</div>
               <p className="text-[#555b82] text-xs font-black uppercase tracking-widest mb-1">Total Vault Value</p>
               <p className="text-xl font-black text-[#8f9ac6] flex items-center gap-2">
                   <RedCoin cls="w-5 h-5 grayscale opacity-50"/> {formatValue(totalInventoryValue)}
               </p>
               <p className="text-[#555b82] text-[10px] font-black uppercase mt-1">{inventario.length} items owned</p>
            </div>
          </div>
        </div>

        {/* =========================================
            TABS: INVENTORY / MARKET
        ========================================= */}
        <div className="flex gap-4 mb-6 border-b border-[#252839] pb-4">
          <button 
            onClick={() => setTab('inventory')} 
            className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all text-sm ${tab === 'inventory' ? 'bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] text-white shadow-[0_4px_15px_rgba(108,99,255,0.4)]' : 'bg-[#1c1f2e] text-[#8f9ac6] border border-[#252839] hover:bg-[#252839]'}`}
          >
            My Pets ({inventario.length})
          </button>
          <button 
            onClick={() => setTab('market')} 
            className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all text-sm flex items-center gap-2 ${tab === 'market' ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0b0e14] shadow-[0_4px_15px_rgba(34,197,94,0.4)]' : 'bg-[#1c1f2e] text-[#8f9ac6] border border-[#252839] hover:bg-[#252839]'}`}
          >
            Marketplace 🏪
          </button>
        </div>

        {/* =========================================
            ZONA PRINCIPAL (FILTROS Y GRID)
        ========================================= */}
        <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl min-h-[500px]">
            
            {/* FILTROS */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
                    {tab === 'inventory' ? 'Inventory' : 'Global Market'}
                    {procesando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></span>}
                </h2>
                
                <div className="flex w-full md:w-auto gap-3">
                    <div className="relative flex-1 md:w-64">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555b82]">🔍</span>
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-[#141323] border border-[#2F3347] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white outline-none focus:border-[#6C63FF] transition-colors shadow-inner"
                        />
                    </div>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#141323] border border-[#2F3347] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#6C63FF] cursor-pointer appearance-none shadow-inner"
                    >
                        <option value="highest">Highest Value</option>
                        <option value="lowest">Lowest Value</option>
                        <option value="name">Name (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* ESTADOS DE CARGA Y VACÍOS */}
            {cargando ? (
                <div className="py-20 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 border-4 border-[#252839] border-t-[#6C63FF] rounded-full animate-spin mb-4"></div>
                    <p className="text-[#555b82] font-black uppercase tracking-widest">Loading assets...</p>
                </div>
            ) : tab === 'inventory' && filteredInventory.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#141323] rounded-xl border border-dashed border-[#2F3347]">
                    <span className="text-5xl opacity-50 grayscale mb-4">🎒</span>
                    <p className="text-[#8f9ac6] font-black text-lg mb-2">No pets found</p>
                    <p className="text-[#555b82] text-sm font-bold">Your inventory is empty. Go open some cases or buy in the market!</p>
                </div>
            ) : tab === 'market' && filteredMarket.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-[#141323] rounded-xl border border-dashed border-[#2F3347]">
                    <span className="text-5xl opacity-50 grayscale mb-4">🏪</span>
                    <p className="text-[#8f9ac6] font-black text-lg mb-2">Market is empty</p>
                    <p className="text-[#555b82] text-sm font-bold">No one is selling anything right now.</p>
                </div>
            ) : (
                /* GRID DE ITEMS */
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-4">
                    
                    {tab === 'inventory' && filteredInventory.map((pet) => (
                        <div key={pet.inventarioId} className="relative bg-[#141323] border border-[#2F3347] rounded-xl p-3 flex flex-col items-center justify-between transition-all hover:border-[#4f567a] hover:-translate-y-1 hover:shadow-lg group overflow-hidden h-44">
                            <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${pet.color} 0%, transparent 70%)` }}></div>
                            
                            <img src={pet.img} className="w-14 h-14 object-contain mt-2 mb-2 z-10 drop-shadow-md group-hover:scale-110 transition-transform" alt="pet"/>
                            
                            <div className="w-full text-center z-10 mb-2">
                                <div className="text-[10px] truncate text-[#8f9ac6] font-bold" style={{color: pet.color}}>{pet.nombre}</div>
                                <div className="text-xs font-black text-white flex items-center justify-center gap-1 mt-0.5">
                                    <RedCoin cls="w-3 h-3"/> {formatValue(pet.valor)}
                                </div>
                            </div>

                            <button 
                                onClick={() => venderPet(pet.inventarioId, pet.nombre)}
                                disabled={procesando}
                                className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black py-2 rounded-lg transition-all z-10 border border-red-500/30 disabled:opacity-50"
                            >
                                SELL INSTANT
                            </button>
                        </div>
                    ))}

                    {tab === 'market' && filteredMarket.map((m) => (
                        <div key={m.marketId} className="relative bg-[#141323] border border-[#22c55e]/30 rounded-xl p-3 flex flex-col items-center justify-between transition-all hover:border-[#22c55e] hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(34,197,94,0.15)] group overflow-hidden h-44">
                            <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: `radial-gradient(circle at 50% 50%, ${m.color} 0%, transparent 70%)` }}></div>
                            
                            <div className="absolute top-1 right-1 bg-[#22c55e]/20 text-[#22c55e] text-[8px] font-black px-1.5 py-0.5 rounded border border-[#22c55e]/50 z-20">ON SALE</div>

                            <img src={m.img} className="w-14 h-14 object-contain mt-2 mb-2 z-10 drop-shadow-md group-hover:scale-110 transition-transform filter brightness-110" alt="pet" style={{filter: `drop-shadow(0 0 10px ${m.color}40)`}}/>
                            
                            <div className="w-full text-center z-10 mb-2">
                                <div className="text-[10px] truncate text-[#8f9ac6] font-bold">{m.nombre}</div>
                                <div className="text-xs font-black text-[#22c55e] flex items-center justify-center gap-1 mt-0.5">
                                    <GreenCoin cls="w-3 h-3"/> {formatValue(m.precio)}
                                </div>
                            </div>

                            <button 
                                onClick={() => comprarDelMarket(m.marketId, m.nombre, m.precio)}
                                disabled={procesando}
                                className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] text-[10px] font-black py-2 rounded-lg transition-all z-10 shadow-[0_2px_10px_rgba(34,197,94,0.3)] disabled:opacity-50"
                            >
                                BUY PET
                            </button>
                        </div>
                    ))}

                </div>
            )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2F3347; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4f567a; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
