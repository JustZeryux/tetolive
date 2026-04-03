"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase'; // Ajusta la ruta si la tienes diferente

// Helpers visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

// --- FIX DE NIVELES ---
// Fórmula exponencial realista. Si tenían un nivel roto en la BD, 
// esta matemática calcula su nivel real basado puramente en su XP total.
const calculateLevelData = (totalXp) => {
    let level = 1;
    let xpNeeded = Math.floor(100 * Math.pow(level, 1.5));
    let remainingXp = totalXp || 0;
    
    while(remainingXp >= xpNeeded) {
        remainingXp -= xpNeeded;
        level++;
        xpNeeded = Math.floor(100 * Math.pow(level, 1.5));
    }
    
    return { 
        realLevel: level, 
        currentXp: remainingXp, 
        xpNeededForNext: xpNeeded,
        progressPercent: Math.min(100, Math.floor((remainingXp / xpNeeded) * 100))
    };
};

export default function ProfilePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [limitedPets, setLimitedPets] = useState([]);
  const [almanac, setAlmanac] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user) {
            setCargando(false);
            return;
        }
        setCurrentUser(authData.user);
        const userId = authData.user.id;

        // 1. Obtener datos del perfil (tu tabla 'profiles')
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (profile) setUserProfile(profile);

        // 2. Cargar TODAS las mascotas (para el Almanaque) de la tabla 'items'
        const { data: allItems } = await supabase
            .from('items')
            .select('*')
            .order('value', { ascending: true });

        // 3. Cargar el inventario del usuario de la tabla 'inventory'
        const { data: myInventory } = await supabase
            .from('inventory')
            .select('*')
            .eq('user_id', userId);

        const safeItems = allItems || [];
        const safeInventory = myInventory || [];

        // 4. Mapear y procesar datos para la UI
        const unlockedIds = new Set(safeInventory.map(inv => inv.item_id));
        
        // Construir Almanaque
        const almanacData = safeItems.map(item => ({
            ...item,
            unlocked: unlockedIds.has(item.id)
        }));
        setAlmanac(almanacData);

        // Filtrar y cruzar datos para las Limitadas (El Flex Showcase)
        const myLimiteds = safeInventory
            .filter(inv => inv.is_limited)
            .map(inv => {
                const itemDetails = safeItems.find(i => i.id === inv.item_id) || {};
                return {
                    invId: inv.id,
                    serial: inv.serial_number,
                    originalOwner: inv.original_owner,
                    name: itemDetails.name || 'Unknown',
                    color: itemDetails.color || '#facc15',
                    img: itemDetails.image_url,
                    maxQuantity: itemDetails.max_quantity
                };
            })
            // Ordenar por serial más bajo (los primeros prints son más valiosos)
            .sort((a, b) => (a.serial || 999999) - (b.serial || 999999)); 

        setLimitedPets(myLimiteds);
        setCargando(false);

      } catch (error) {
        console.error("Error cargando perfil:", error);
        setCargando(false);
      }
    };

    fetchProfileData();
  }, []);

  if (cargando) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
    </div>
  );

  if (!currentUser || !userProfile) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <h1 className="text-3xl font-black mb-4">No estás logueado</h1>
      <p className="text-gray-400">Inicia sesión para ver tu perfil y flexear tus mascotas.</p>
    </div>
  );

  // Procesamos la XP en tiempo real para corregir los niveles rotos
  const { realLevel, currentXp, xpNeededForNext, progressPercent } = calculateLevelData(userProfile.xp);
  
  const totalPets = almanac.length;
  const unlockedCount = almanac.filter(p => p.unlocked).length;
  const collectionPercent = totalPets > 0 ? Math.floor((unlockedCount / totalPets) * 100) : 0;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Glow de fondo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>
      
      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* ================= HEADER DEL PERFIL ================= */}
        <div className="bg-[#0a0a0a]/80 backdrop-blur-md rounded-3xl border-2 border-[#1f2937] p-6 md:p-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] mb-8 flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative group">
                <div className="absolute inset-0 bg-[#6C63FF] blur-xl opacity-40 group-hover:opacity-70 transition-opacity rounded-full"></div>
                <img 
                    src={userProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.username || currentUser.id}`} 
                    alt="Avatar" 
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-[#252839] relative z-10 bg-[#111827] object-cover" 
                />
                {userProfile.is_vip && (
                    <div className="absolute -bottom-2 right-2 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.6)] z-20 border-2 border-black">
                        VIP
                    </div>
                )}
            </div>
            
            <div className="flex-1 text-center md:text-left w-full">
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] uppercase tracking-widest mb-2">
                    {userProfile.username || 'Usuario Anonimo'}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
                    <span className="bg-[#111827] border border-[#374151] px-4 py-1.5 rounded-lg text-sm font-bold text-cyan-400 shadow-inner">
                        Nivel {realLevel}
                    </span>
                    <span className="bg-[#111827] border border-[#374151] px-4 py-1.5 rounded-lg text-sm font-bold text-[#8f9ac6] shadow-inner uppercase tracking-widest">
                        {userProfile.role}
                    </span>
                    {/* Tags (si tienes array de tags en profiles) */}
                    {userProfile.tags && userProfile.tags.map(tag => (
                        <span key={tag} className="bg-[#6C63FF]/20 border border-[#6C63FF]/50 text-[#e0e5ff] px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Barra de XP */}
                <div className="w-full max-w-xl bg-[#111827] p-4 rounded-2xl border border-[#252839] shadow-inner">
                    <div className="flex justify-between text-xs font-bold uppercase text-[#8f9ac6] mb-2 tracking-widest">
                        <span>Progreso de Nivel</span>
                        <span>{currentXp} / {xpNeededForNext} XP</span>
                    </div>
                    <div className="w-full bg-[#0b0e14] rounded-full h-3 border border-[#252839] overflow-hidden relative">
                        <div 
                            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)] relative" 
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('/scanline.png')] opacity-30 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resumen de Cuentas (Opcional, pero se ve bien en el perfil) */}
            <div className="flex flex-col gap-3 w-full md:w-auto bg-[#111827]/50 p-4 rounded-2xl border border-[#252839]">
                <div className="flex items-center gap-3">
                    <GreenCoin cls="w-8 h-8"/>
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Saldo Verde</p>
                        <p className="font-black text-xl text-white">{userProfile.saldo_verde?.toLocaleString() || 0}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-t border-[#374151]/50 pt-3">
                    <RedCoin cls="w-8 h-8"/>
                    <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Saldo Rojo</p>
                        <p className="font-black text-xl text-white">{userProfile.saldo_rojo?.toLocaleString() || 0}</p>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* ================= ALMANAQUE (COLUMNA IZQUIERDA) ================= */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-[#0a0a0a] border-2 border-[#1f2937] rounded-3xl p-6 shadow-xl h-[600px] flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#6C63FF]/10 blur-3xl rounded-full"></div>
                    
                    <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2 flex justify-between items-center z-10">
                        Almanaque
                        <span className="text-sm bg-[#111827] text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-lg">
                            {collectionPercent}%
                        </span>
                    </h2>
                    <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest border-b border-[#252839] pb-4 mb-4 z-10">
                        Colección Completa: {unlockedCount} / {totalPets}
                    </p>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 z-10">
                        {almanac.map((item) => (
                            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.unlocked ? 'bg-[#111827] border-[#374151] hover:border-cyan-500/50' : 'bg-[#0b0e14]/50 border-[#1f2937]/50 opacity-50 grayscale'}`}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: item.unlocked ? `${item.color}20` : '#1f2937' }}>
                                    {item.unlocked && item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-8 h-8 object-contain drop-shadow-md" />
                                    ) : (
                                        <span className="text-gray-500 text-lg">?</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate uppercase tracking-wider ${item.unlocked ? (item.is_limited ? 'text-yellow-400' : 'text-white') : 'text-gray-500'}`}>
                                        {item.unlocked ? item.name : 'Mascota Oculta'}
                                    </p>
                                    {item.unlocked && item.is_limited && (
                                        <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/30">EDICIÓN LIMITADA</span>
                                    )}
                                </div>
                                <div className="text-lg">
                                    {item.unlocked ? '✅' : '🔒'}
                                </div>
                            </div>
                        ))}
                        {almanac.length === 0 && <p className="text-center text-gray-500 mt-10 text-sm">No hay items en la base de datos.</p>}
                    </div>
                </div>
            </div>

            {/* ================= SHOWCASE LIMITADAS (COLUMNA DERECHA) ================= */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="bg-[#0a0a0a] border-2 border-[#1f2937] rounded-3xl p-6 shadow-xl min-h-[600px] flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 blur-[100px] rounded-full pointer-events-none"></div>

                    <h2 className="text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-2 z-10 flex items-center gap-3">
                        🌟 Showcase
                        <span className="text-sm bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-3 py-1 rounded-lg font-bold tracking-widest">
                            LIMITADAS
                        </span>
                    </h2>
                    <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest border-b border-[#252839] pb-4 mb-6 z-10">
                        Tus mascotas más raras y valiosas para flexear.
                    </p>

                    {limitedPets.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-50 z-10">
                            <span className="text-6xl mb-4 grayscale">🤡</span>
                            <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest">Pobre Diablo</h3>
                            <p className="text-sm text-gray-600 mt-2">Aún no tienes mascotas limitadas para presumir.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
                            {limitedPets.map((pet) => (
                                <div key={pet.invId} className="bg-[#111827] border-2 border-yellow-500/30 hover:border-yellow-400 rounded-2xl p-6 relative group transition-all duration-300 hover:-translate-y-1 shadow-[0_0_15px_rgba(234,179,8,0.1)] hover:shadow-[0_10px_30px_rgba(234,179,8,0.3)] overflow-hidden">
                                    
                                    <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${pet.color || '#facc15'} 0%, transparent 70%)`}}></div>
                                    
                                    {/* Etiqueta de Serial (Print) */}
                                    <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-black px-4 py-1.5 rounded-bl-xl shadow-md z-20 flex flex-col items-center border-l-2 border-b-2 border-yellow-600">
                                        <span className="text-[8px] uppercase tracking-widest opacity-80 leading-tight">Print</span>
                                        <span className="text-sm">#{pet.serial || 'N/A'} {pet.maxQuantity ? `/ ${pet.maxQuantity}` : ''}</span>
                                    </div>

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className="bg-black/50 border border-yellow-500/20 px-3 py-1 rounded-lg backdrop-blur-md">
                                            <span className="text-[10px] text-gray-400 uppercase tracking-widest block leading-tight">Original Owner</span>
                                            <span className="text-xs font-bold text-yellow-400 truncate max-w-[100px] block">
                                                {pet.originalOwner || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-center my-6 relative z-10">
                                        <div className="absolute w-20 h-20 rounded-full blur-[30px] opacity-40 group-hover:opacity-70 transition-opacity" style={{ backgroundColor: pet.color || '#facc15' }}></div>
                                        <img src={pet.img || '/placeholder.png'} alt={pet.name} className="w-32 h-32 object-contain drop-shadow-[0_15px_20px_rgba(0,0,0,0.8)] group-hover:scale-110 transition-transform duration-500" />
                                    </div>

                                    <div className="text-center relative z-10 border-t border-[#374151]/50 pt-4">
                                        <h3 className="text-xl font-black text-white uppercase tracking-widest truncate w-full" style={{textShadow: `0 0 15px ${pet.color || '#facc15'}80`}}>
                                            {pet.name}
                                        </h3>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

      </div>
      
      <style jsx global>{`
        /* Scrollbar styling para el almanaque */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0a0a0a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
}
