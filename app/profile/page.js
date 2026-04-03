"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-5 h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-5 h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [inventory, setInventory] = useState([]);
  const [loadingInv, setLoadingInv] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);

        // --- FETCH INVENTARIO (Ahora incluye serial y owner) ---
        setLoadingInv(true);
        const { data: invData } = await supabase
          .from('inventory')
          .select(`
            id, 
            item_id, 
            created_at,
            is_limited,
            serial_number,
            original_owner,
            is_locked,
            items (name, image_url, rarity, valor, color, max_quantity)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (invData) setInventory(invData);
        setLoadingInv(false);
      }
      setLoading(false);
    };
    loadProfile();
  }, []);

  // --- FUNCIÓN PARA VENDER (PUNTO 19) ---
  const sellPet = async (petId, valueToSell) => {
    const confirmSell = window.confirm(`¿Estás seguro de vender esta mascota por ${valueToSell} G?`);
    if (!confirmSell) return;

    try {
      // 1. Borramos la mascota del inventario (Tu trigger update_red_coins actualizará los rojos)
      const { error: errDel } = await supabase.from('inventory').delete().eq('id', petId);
      if (errDel) throw errDel;

      // 2. Le sumamos el saldo verde al jugador
      const nuevoSaldoVerde = (profile.saldo_verde || 0) + valueToSell;
      const { error: errUpdate } = await supabase.from('profiles').update({ saldo_verde: nuevoSaldoVerde }).eq('id', profile.id);
      if (errUpdate) throw errUpdate;

      // 3. Actualizamos la interfaz sin recargar la página
      setProfile({ ...profile, saldo_verde: nuevoSaldoVerde });
      setInventory(prev => prev.filter(p => p.id !== petId));
      
    } catch (error) {
      alert("Error al vender: " + error.message);
    }
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
    </div>
  );
  
  if (!profile) return <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white flex items-center justify-center font-bold text-xl">Por favor, inicia sesión.</div>;

  const currentXP = profile.xp || 0;
  const displayLevel = profile.level || Math.floor(currentXP / 1000) + 1; 
  const xpBaseForCurrentLevel = (displayLevel - 1) * 1000;
  const xpNeededForNext = displayLevel * 1000;
  const progressPercent = Math.min(((currentXP - xpBaseForCurrentLevel) / (xpNeededForNext - xpBaseForCurrentLevel)) * 100, 100);

  const userTags = profile.tags || []; 
  if (profile.role === 'admin') userTags.push('👑 DEV');
  if (profile.is_vip) userTags.push('💎 VIP');

  const getTagColor = (tag) => {
    if (tag.includes('DEV') || tag.includes('ADMIN')) return 'border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] bg-red-500/10';
    if (tag.includes('VIP')) return 'border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)] bg-yellow-400/10';
    return 'border-[#6C63FF] text-[#a39dfa] shadow-[0_0_15px_rgba(108,99,255,0.4)] bg-[#6C63FF]/10';
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[100px] pointer-events-none z-0"></div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        
        {/* Tarjeta Superior */}
        <div className="bg-[#14151f]/80 backdrop-blur-xl rounded-[2rem] border-2 border-[#252839] p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
          <div className="relative group cursor-pointer shrink-0">
            <div className="absolute inset-0 bg-[#6C63FF] rounded-full blur-[20px] opacity-40 group-hover:opacity-70 transition-opacity"></div>
            <img src={profile.avatar_url || '/default-avatar.png'} className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#6C63FF] object-cover bg-[#0b0e14] relative z-10" alt="Avatar"/>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#0b0e14] border-2 border-[#6C63FF] px-6 py-1 rounded-full font-black text-[#6C63FF] whitespace-nowrap shadow-[0_0_20px_rgba(108,99,255,0.5)] z-20">
              LVL {displayLevel}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left z-10 w-full">
             <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                 <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#a39dfa]">{profile.username || 'Usuario'}</h1>
                 {userTags.length > 0 && (
                     <div className="flex flex-wrap justify-center md:justify-start gap-2">
                         {userTags.map((tag, idx) => (
                             <span key={idx} className={`px-3 py-1 border text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-sm animate-pulse-slow ${getTagColor(tag)}`}>{tag}</span>
                         ))}
                     </div>
                 )}
             </div>
             
             <div className="w-full bg-[#0b0e14] border-2 border-[#252839] rounded-full h-4 mb-2 overflow-hidden shadow-inner mt-6">
               <div className="bg-gradient-to-r from-cyan-500 to-[#6C63FF] h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
             </div>
             <div className="flex justify-between text-[10px] font-bold text-[#8f9ac6] uppercase tracking-widest px-2">
                <span>XP: {currentXP.toLocaleString()}</span>
                <span>Next: {xpNeededForNext.toLocaleString()}</span>
             </div>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex gap-4 mb-6 border-b border-[#252839] pb-4 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('inventory')} className={`px-6 py-2 font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'inventory' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:bg-[#14151f]'}`}>📦 Inventario</button>
            <button onClick={() => setActiveTab('stats')} className={`px-6 py-2 font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:bg-[#14151f]'}`}>📊 Estadísticas</button>
        </div>

        {activeTab === 'inventory' && (
            <div className="bg-[#14151f]/50 border border-[#252839] rounded-3xl p-6 md:p-8 min-h-[400px] animate-fade-in relative">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-[#252839] pb-4 gap-4">
                  <h3 className="text-2xl font-black text-white uppercase tracking-widest">Tus Mascotas ({inventory.length})</h3>
                  <span className="text-[#8f9ac6] font-bold bg-[#0b0e14] px-4 py-2 rounded-xl border border-[#252839] flex items-center gap-2">
                    Valor Total: <GreenCoin cls="w-5 h-5 grayscale opacity-80"/> {inventory.reduce((acc, pet) => acc + (pet.items?.valor || 0), 0).toLocaleString()}
                  </span>
                </div>

                {loadingInv ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin"></div></div>
                ) : inventory.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                        <div className="text-6xl mb-4 opacity-50">🎒</div>
                        <p className="text-[#8f9ac6] font-bold text-lg">Tu inventario está vacío.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {inventory.map((pet) => {
                            const item = pet.items;
                            if (!item) return null;
                            
                            const isEpic = pet.is_limited || item.rarity === 'Mythic' || item.rarity === 'Exotic';
                            const borderColor = item.color || '#374151';

                            return (
                                <div key={pet.id} className={`bg-[#0a0a0a] rounded-2xl p-3 flex flex-col items-center relative group cursor-pointer transition-all hover:-translate-y-2 border-2 shadow-lg overflow-hidden ${isEpic ? 'shadow-[0_0_20px_rgba(250,204,21,0.2)]' : ''}`} style={{ borderColor: isEpic ? '#facc15' : borderColor }}>
                                    
                                    {/* Fondo radial */}
                                    <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity" style={{ background: `radial-gradient(circle at center, ${isEpic ? '#facc15' : borderColor} 0%, transparent 80%)`}}></div>
                                    
                                    {/* Header (Rareza y Serial FIX PUNTO 5) */}
                                    <div className="w-full flex justify-between items-start mb-2 z-10">
                                        {pet.is_limited ? (
                                            <span className="text-[9px] font-black uppercase bg-yellow-500 text-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.8)]">LIMITED</span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase text-white/50 bg-[#111827] px-2 py-0.5 rounded-full border border-[#374151]">{item.rarity || 'Normal'}</span>
                                        )}
                                        
                                        {/* Aquí mostramos el Serial Real generado por tu trigger */}
                                        {pet.is_limited && pet.serial_number && (
                                            <span className="text-yellow-400 font-black text-[11px] bg-black/60 px-1.5 rounded-md border border-yellow-500/30">#{pet.serial_number}</span>
                                        )}
                                    </div>

                                    {/* Imagen */}
                                    <div className="relative w-20 h-20 mb-3 flex items-center justify-center">
                                        {isEpic && <div className="absolute inset-0 bg-yellow-500 blur-[20px] opacity-20 rounded-full animate-pulse"></div>}
                                        <img src={item.image_url || '/default-pet.png'} alt={item.name} className={`w-full h-full object-contain drop-shadow-xl z-10 relative group-hover:scale-110 transition-transform ${isEpic ? 'animate-float' : ''}`} />
                                    </div>

                                    {/* Info Info */}
                                    <div className="w-full text-center mt-auto bg-[#111827]/80 rounded-xl py-2 px-1 z-10 border border-[#252839]">
                                        <p className="font-black text-[10px] uppercase tracking-wide truncate w-full px-1" style={{color: isEpic ? '#facc15' : 'white'}}>{item.name}</p>
                                        <p className="text-gray-400 font-bold text-[10px] mt-1 flex items-center justify-center gap-1">
                                            <GreenCoin cls="w-3 h-3 grayscale"/> {item.valor?.toLocaleString() || 0}
                                        </p>
                                    </div>
                                    
                                    {/* --- Owner Tag Fix --- */}
                                    {pet.is_limited && pet.original_owner && (
                                        <div className="w-full text-center mt-1">
                                            <p className="text-[8px] font-bold text-gray-500 uppercase truncate">By: {pet.original_owner}</p>
                                        </div>
                                    )}

                                    {/* Menú de Acciones (VENDER FIX PUNTO 19) */}
                                    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 z-20">
                                        <div className="text-center mb-2">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Valor de Venta</p>
                                            <p className="text-green-400 font-black text-sm flex justify-center items-center gap-1"><GreenCoin cls="w-4 h-4"/> {item.valor}</p>
                                        </div>
                                        <button onClick={() => sellPet(pet.id, item.valor)} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] text-xs font-black px-6 py-2 rounded-lg w-5/6 uppercase tracking-widest transition-transform hover:scale-105">
                                            Vender
                                        </button>
                                        {/* Botón Guardar / Lock (Opcional futuro) */}
                                        <button className="bg-[#1f2937] hover:bg-[#374151] border border-[#4b5563] text-gray-300 text-[10px] font-bold px-4 py-1.5 rounded-lg w-5/6 uppercase transition-colors">
                                            {pet.is_locked ? 'Desbloquear' : 'Bloquear 🔒'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center shadow-lg">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3">Billetera Verde</span>
                  <div className="flex items-center gap-2"><GreenCoin cls="w-6 h-6"/><span className="text-3xl font-black text-white">{profile.saldo_verde?.toLocaleString() || 0}</span></div>
               </div>
               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center shadow-lg">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3">Billetera Roja</span>
                  <div className="flex items-center gap-2"><RedCoin cls="w-6 h-6"/><span className="text-3xl font-black text-white">{profile.saldo_rojo?.toLocaleString() || 0}</span></div>
               </div>
            </div>
        )}

      </div>
      <style jsx global>{`
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
