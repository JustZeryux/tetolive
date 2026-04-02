"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G"/>;

export default function RewardsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    fetchUser();
  }, []);

  // Función para reclamar recompensa (Ya definida y lista)
  const claimDaily = async () => {
    if (!currentUser) return alert("Debes iniciar sesión para reclamar recompensas.");
    
    // Aquí puedes llamar a tu RPC real si lo tienes, o dejar el alert temporal
    alert("Función de recompensa diaria en desarrollo...");
    // Ejemplo de llamada a backend:
    // await supabase.rpc('reclamar_diario', { p_user_id: currentUser.id });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* HEADER */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md">
            Rewards 🎁
          </h1>
          <p className="text-[#8f9ac6] font-bold mt-2">Claim your daily cases, rakeback, and level up rewards.</p>
        </div>

        {/* CASOS DIARIOS */}
        <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-8">
            <h2 className="text-2xl font-black uppercase tracking-widest mb-6">Daily Reward</h2>
            <div className="flex flex-col md:flex-row items-center gap-8 bg-[#0b0e14] border border-[#252839] p-6 rounded-xl">
                <div className="w-32 h-32 relative shrink-0">
                    <div className="absolute inset-0 bg-[#3AFF4E] opacity-20 blur-2xl rounded-full"></div>
                    <img src="/Cases.png" className="w-full h-full object-contain relative z-10" alt="Daily Case" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-black uppercase text-white mb-2">Free Daily Case</h3>
                    <p className="text-[#8f9ac6] text-sm mb-4">Log in every day to claim a free case containing random pets or coins.</p>
                    <button 
                        onClick={claimDaily}
                        className="bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-black font-black uppercase tracking-widest px-8 py-3 rounded-lg hover:scale-105 transition-transform shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                    >
                        Claim Now
                    </button>
                </div>
            </div>
        </div>

        {/* RAKEBACK & LEVEL REWARDS (Próximamente) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-8 opacity-50 grayscale">
                <h2 className="text-xl font-black uppercase tracking-widest mb-2 text-[#8f9ac6]">Rakeback</h2>
                <p className="text-sm font-bold text-[#555b82] mb-6">Earn a percentage of your wagers back over time.</p>
                <div className="text-center py-8">
                    <span className="text-2xl font-black text-white flex items-center justify-center gap-2 mb-4"><GreenCoin/> 0.00</span>
                    <button disabled className="bg-[#252839] text-[#555b82] px-6 py-2 rounded-lg font-bold uppercase cursor-not-allowed">Locked</button>
                </div>
            </div>

            <div className="bg-[#14151f] border border-[#252839] rounded-2xl p-8 opacity-50 grayscale">
                <h2 className="text-xl font-black uppercase tracking-widest mb-2 text-[#8f9ac6]">Level Rewards</h2>
                <p className="text-sm font-bold text-[#555b82] mb-6">Unlock exclusive rewards as you level up your account.</p>
                <div className="text-center py-8">
                    <span className="text-lg font-black text-white mb-4 block">Current Level: {profile?.level || 1}</span>
                    <button disabled className="bg-[#252839] text-[#555b82] px-6 py-2 rounded-lg font-bold uppercase cursor-not-allowed">Check Rewards</button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
