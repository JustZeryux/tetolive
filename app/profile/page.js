"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-5 h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block`} alt="G" onError={e=>e.target.style.display='none'}/>;
const RedCoin = ({cls="w-5 h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R" onError={e=>e.target.style.display='none'}/>;

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Lee todos tus stats desde la base de datos real
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
      setLoading(false);
    };
    loadProfile();
  }, []);

  if (loading) return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 border-4 border-[#6C63FF] border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#6C63FF]"></div>
      <p className="font-bold text-lg text-[#8f9ac6] uppercase tracking-widest animate-pulse">Cargando Perfil...</p>
    </div>
  );
  
  if (!profile) return <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white flex items-center justify-center font-bold text-xl">Por favor, inicia sesión para ver tu perfil.</div>;

  // --- SISTEMA DE NIVELES (FIX) ---
  const currentXP = profile.xp || 0;
  // Si no tienes el 'level' guardado en la DB, lo calculamos dinámicamente. Cada 1000 XP es un nivel.
  const calculatedLevel = Math.floor(currentXP / 1000) + 1; 
  const displayLevel = profile.level || calculatedLevel;
  
  const xpBaseForCurrentLevel = (displayLevel - 1) * 1000;
  const xpNeededForNext = displayLevel * 1000;
  const xpProgress = currentXP - xpBaseForCurrentLevel;
  const xpRequired = xpNeededForNext - xpBaseForCurrentLevel;
  const progressPercent = Math.min((xpProgress / xpRequired) * 100, 100);

  // --- SISTEMA DE TAGS / INSIGNIAS (FIX) ---
  // Simulamos/leemos tags de la DB. (Asegúrate de tener una columna 'tags' como array de texto en tu tabla profiles, o usar 'role')
  const userTags = profile.tags || []; 
  if (profile.role === 'admin') userTags.push('👑 DEV');
  if (profile.is_vip) userTags.push('💎 VIP');

  const getTagColor = (tag) => {
    if (tag.includes('DEV') || tag.includes('ADMIN')) return 'border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)] bg-red-500/10';
    if (tag.includes('VIP')) return 'border-yellow-400 text-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.4)] bg-yellow-400/10';
    if (tag.includes('BETA')) return 'border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)] bg-cyan-400/10';
    return 'border-[#6C63FF] text-[#a39dfa] shadow-[0_0_15px_rgba(108,99,255,0.4)] bg-[#6C63FF]/10';
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[400px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[100px] pointer-events-none z-0"></div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        
        {/* Tarjeta Superior */}
        <div className="bg-[#14151f]/80 backdrop-blur-xl rounded-[2rem] border-2 border-[#252839] p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#6C63FF]/20 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative group cursor-pointer shrink-0">
            <div className="absolute inset-0 bg-[#6C63FF] rounded-full blur-[20px] opacity-40 group-hover:opacity-70 transition-opacity duration-500"></div>
            <img src={profile.avatar_url || '/default-avatar.png'} className="w-40 h-40 rounded-full border-4 border-[#6C63FF] object-cover bg-[#0b0e14] relative z-10" alt="Avatar"/>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#0b0e14] border-2 border-[#6C63FF] px-6 py-1 rounded-full font-black text-[#6C63FF] whitespace-nowrap shadow-[0_0_20px_rgba(108,99,255,0.5)] z-20 transition-transform group-hover:scale-110">
              LVL {displayLevel}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left z-10 w-full">
             <div className="flex flex-col md:flex-row items-center gap-4 mb-3">
                 <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#a39dfa]">{profile.username || 'Usuario'}</h1>
                 {/* Renderizado de Tags */}
                 {userTags.length > 0 && (
                     <div className="flex flex-wrap justify-center md:justify-start gap-2">
                         {userTags.map((tag, idx) => (
                             <span key={idx} className={`px-3 py-1 border text-[10px] font-black uppercase tracking-widest rounded-full backdrop-blur-sm animate-pulse-slow ${getTagColor(tag)}`}>
                                 {tag}
                             </span>
                         ))}
                     </div>
                 )}
             </div>
             <p className="text-[#8f9ac6] font-mono text-sm mb-8 bg-[#0b0e14]/50 inline-block px-4 py-1 rounded-lg border border-[#252839]">ID: {profile.id}</p>
             
             {/* Barra de XP */}
             <div className="w-full bg-[#0b0e14] border-2 border-[#252839] rounded-full h-5 mb-2 overflow-hidden shadow-inner relative">
               <div className="absolute inset-0 bg-gradient-to-r from-[#6C63FF]/20 to-transparent pointer-events-none"></div>
               <div className="bg-gradient-to-r from-cyan-500 to-[#6C63FF] h-full rounded-full transition-all duration-1000 relative" style={{ width: `${progressPercent}%` }}>
                  <div className="absolute top-0 right-0 bottom-0 w-10 bg-white/20 blur-[5px] skew-x-12 animate-[slide_2s_infinite]"></div>
               </div>
             </div>
             <div className="flex justify-between text-xs font-bold text-[#8f9ac6] uppercase tracking-widest px-2">
                <span>XP Actual: {currentXP.toLocaleString()}</span>
                <span>Faltan {(xpRequired - xpProgress).toLocaleString()} XP</span>
             </div>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex gap-4 mb-6 border-b border-[#252839] pb-4">
            <button onClick={() => setActiveTab('stats')} className={`px-6 py-2 font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'stats' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:bg-[#14151f] hover:text-white'}`}>Estadísticas</button>
            <button onClick={() => setActiveTab('inventory')} className={`px-6 py-2 font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:bg-[#14151f] hover:text-white'}`}>Inventario</button>
        </div>

        {/* Contenido de Pestañas */}
        {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-2 hover:border-green-500/50 hover:shadow-[0_10px_30px_rgba(34,197,94,0.15)] transition-all group">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3 group-hover:text-green-400 transition-colors">Billetera Verde</span>
                  <div className="flex items-center gap-2"><GreenCoin cls="w-6 h-6"/><span className="text-3xl font-black text-white group-hover:text-green-50">{profile.saldo_verde?.toLocaleString() || 0}</span></div>
               </div>
               
               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-2 hover:border-red-500/50 hover:shadow-[0_10px_30px_rgba(239,68,68,0.15)] transition-all group">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3 group-hover:text-red-400 transition-colors">Billetera Roja</span>
                  <div className="flex items-center gap-2"><RedCoin cls="w-6 h-6"/><span className="text-3xl font-black text-white group-hover:text-red-50">{profile.saldo_rojo?.toLocaleString() || 0}</span></div>
               </div>

               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-2 hover:border-cyan-500/50 hover:shadow-[0_10px_30px_rgba(34,211,238,0.15)] transition-all group">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3 group-hover:text-cyan-400 transition-colors">Bóveda Verde</span>
                  <div className="flex items-center gap-2"><span className="text-2xl drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">🔒</span><span className="text-3xl font-black text-white group-hover:text-cyan-50">{profile.vault_verde?.toLocaleString() || 0}</span></div>
               </div>

               <div className="bg-[#14151f]/80 backdrop-blur-md p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-2 hover:border-yellow-500/50 hover:shadow-[0_10px_30px_rgba(250,204,21,0.15)] transition-all group">
                  <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3 group-hover:text-yellow-400 transition-colors">Ganancias Afiliado</span>
                  <div className="flex items-center gap-2"><span className="text-2xl">🤝</span><span className="text-3xl font-black text-[#facc15]">{profile.affiliate_earnings?.toLocaleString() || 0}</span></div>
               </div>
            </div>
        )}

        {activeTab === 'inventory' && (
            <div className="bg-[#14151f]/50 border border-[#252839] rounded-3xl p-10 text-center animate-fade-in flex flex-col items-center justify-center min-h-[300px]">
                <div className="text-6xl mb-4 opacity-50">🎒</div>
                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Tu Inventario</h3>
                <p className="text-[#8f9ac6] font-bold">Aquí aparecerán tus mascotas ganadas en las cajas.</p>
                {/* Aquí es donde luego cargaremos los items de Supabase (Punto 5 y 9) */}
            </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes slide {
            0% { transform: translateX(-150px) skewX(12deg); }
            100% { transform: translateX(800px) skewX(12deg); }
        }
        .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
