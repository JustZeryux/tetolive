"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-5 h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block`} alt="G"/>;
const RedCoin = ({cls="w-5 h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R"/>;

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="min-h-screen bg-[#0b0e14] text-white flex items-center justify-center">Cargando tu Perfil Épico...</div>;
  if (!profile) return <div className="min-h-screen bg-[#0b0e14] text-white flex items-center justify-center font-bold text-xl">Por favor, inicia sesión para ver tu perfil.</div>;

  // Calculo de XP para el sistema de Niveles (Placeholder visual si aún no existe xp en tu DB)
  const currentXP = profile.xp || 0;
  const currentLevel = profile.level || 1;
  const xpNeeded = currentLevel * 1000; 
  const progressPercent = Math.min((currentXP / xpNeeded) * 100, 100);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        
        {/* Tarjeta Superior */}
        <div className="bg-[#14151f] rounded-[2rem] border border-[#252839] p-8 md:p-12 mb-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#6C63FF]/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="relative group cursor-pointer">
            <img src={profile.avatar_url || '/default-avatar.png'} className="w-40 h-40 rounded-full border-4 border-[#6C63FF] shadow-[0_0_30px_rgba(108,99,255,0.3)] object-cover bg-[#0b0e14]" />
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#0b0e14] border-2 border-[#6C63FF] px-4 py-1 rounded-full font-black text-[#6C63FF] whitespace-nowrap shadow-md">
              LVL {currentLevel}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left z-10">
             <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest mb-2">{profile.username || 'Usuario'}</h1>
             <p className="text-[#8f9ac6] font-mono text-sm mb-6">ID: {profile.id}</p>
             
             {/* Barra de XP */}
             <div className="w-full bg-[#0b0e14] border border-[#252839] rounded-full h-4 mb-2 overflow-hidden shadow-inner">
               <div className="bg-gradient-to-r from-[#6C63FF] to-[#a39dfa] h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
             </div>
             <div className="flex justify-between text-xs font-bold text-[#8f9ac6] uppercase tracking-widest">
                <span>XP Actual: {currentXP.toLocaleString()}</span>
                <span>Faltan {((xpNeeded - currentXP)).toLocaleString()} XP</span>
             </div>
          </div>
        </div>

        {/* Cajas de Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-[#14151f] p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-1 transition-transform">
              <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Billetera Verde</span>
              <div className="flex items-center gap-2"><GreenCoin/><span className="text-2xl font-black text-white">{profile.saldo_verde?.toLocaleString() || 0}</span></div>
           </div>
           
           <div className="bg-[#14151f] p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-1 transition-transform">
              <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Billetera Roja</span>
              <div className="flex items-center gap-2"><RedCoin/><span className="text-2xl font-black text-white">{profile.saldo_rojo?.toLocaleString() || 0}</span></div>
           </div>

           <div className="bg-[#14151f] p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-1 transition-transform">
              <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Bóveda Verde</span>
              <div className="flex items-center gap-2"><span className="text-xl">🔒</span><span className="text-2xl font-black text-white">{profile.vault_verde?.toLocaleString() || 0}</span></div>
           </div>

           <div className="bg-[#14151f] p-6 rounded-3xl border border-[#252839] flex flex-col items-center justify-center text-center shadow-lg hover:-translate-y-1 transition-transform">
              <span className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Ganancias Afiliado</span>
              <div className="flex items-center gap-2"><span className="text-xl">🤝</span><span className="text-2xl font-black text-[#facc15]">{profile.affiliate_earnings?.toLocaleString() || 0}</span></div>
           </div>
        </div>

      </div>
    </div>
  );
}
