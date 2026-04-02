"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const RedCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function RewardsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); // Segundos restantes
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          setCargando(false);
          return;
      }
      setCurrentUser(user);

      // Traer la fecha del último reclamo
      const { data: profile } = await supabase
        .from('perfiles')
        .select('ultimo_reclamo_diario')
        .eq('id', user.id)
        .single();

      if (profile && profile.ultimo_reclamo_diario) {
          const lastClaim = new Date(profile.ultimo_reclamo_diario).getTime();
          const now = Date.now();
          const hours24 = 24 * 60 * 60 * 1000;
          const nextClaimTime = lastClaim + hours24;
          
          if (now < nextClaimTime) {
              setTimeLeft(Math.floor((nextClaimTime - now) / 1000));
          } else {
              setTimeLeft(0);
          }
      }
      setCargando(false);
    };

    fetchUserData();
  }, []);

  // Lógica del Reloj
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const claimDaily = async () => {
    if (!currentUser) return alert("Debes iniciar sesión para reclamar.");
    if (timeLeft > 0) return alert("Aún no es hora de tu recompensa.");
    
    setProcesando(true);
    const { data, error } = await supabase.rpc('reclamar_recompensa_diaria', { p_user_id: currentUser.id });

    if (error || data?.error) {
        alert("Error al reclamar: " + (data?.error || error.message));
    } else {
        alert(`¡Recompensa Diaria Reclamada!\nHas recibido ${data.recompensa_roja} 🔴 y ${data.recompensa_verde} 🟢.`);
        setTimeLeft(24 * 60 * 60); // Reiniciar reloj visualmente a 24h
    }
    setProcesando(false);
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden">
      
      {/* Luces de fondo decorativas */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-gradient-to-b from-[#6C63FF]/20 to-transparent blur-[100px] pointer-events-none"></div>

      <div className="max-w-[1000px] mx-auto relative z-10">
        
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md mb-4">
            Rewards Hub
          </h1>
          <p className="text-[#8f9ac6] font-bold text-lg">Claim free coins, level up, and unlock exclusive cases.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* =========================================
              RECOMPENSA DIARIA (DAILY FAUCET)
          ========================================= */}
          <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-8 shadow-2xl flex flex-col items-center relative overflow-hidden group">
            
            <div className="absolute inset-0 bg-gradient-to-b from-[#facc15]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="w-32 h-32 mb-6 relative">
               <div className="absolute inset-0 bg-[#facc15] blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity animate-pulse"></div>
               <img src="https://cdn-icons-png.flaticon.com/512/5132/5132168.png" alt="Chest" className="w-full h-full object-contain relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-500" />
            </div>

            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2 z-10">Daily Reward</h2>
            <p className="text-[#8f9ac6] text-center text-sm font-bold mb-6 z-10">Come back every 24 hours to claim your free coins and start playing.</p>

            <div className="flex gap-4 mb-8 z-10">
               <div className="bg-[#141323] border border-[#2F3347] px-4 py-2 rounded-xl flex flex-col items-center shadow-inner min-w-[100px]">
                   <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest">Guaranteed</span>
                   <span className="text-xl font-black text-white flex items-center gap-1.5"><RedCoin cls="w-5 h-5"/> 5K</span>
               </div>
               <div className="bg-[#141323] border border-[#2F3347] px-4 py-2 rounded-xl flex flex-col items-center shadow-inner min-w-[100px]">
                   <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest">Bonus</span>
                   <span className="text-xl font-black text-[#22c55e] flex items-center gap-1.5"><GreenCoin cls="w-5 h-5"/> 100</span>
               </div>
            </div>

            {cargando ? (
                <div className="w-full h-14 bg-[#141323] border border-[#2F3347] rounded-xl flex items-center justify-center">
                   <div className="w-6 h-6 border-2 border-[#555b82] border-t-white rounded-full animate-spin"></div>
                </div>
            ) : timeLeft > 0 ? (
                <button disabled className="w-full h-14 bg-[#141323] border border-[#2F3347] rounded-xl font-black text-[#555b82] uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed">
                    <span>Available in</span>
                    <span className="text-[#8f9ac6]">{formatTime(timeLeft)}</span>
                </button>
            ) : (
                <button 
                  onClick={claimDaily}
                  disabled={procesando}
                  className="w-full h-14 bg-gradient-to-r from-[#facc15] to-[#eab308] hover:from-[#fef08a] hover:to-[#facc15] text-[#0b0e14] rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.6)] hover:-translate-y-1 z-10 disabled:opacity-50"
                >
                  CLAIM NOW
                </button>
            )}
          </div>

          {/* =========================================
              SISTEMA DE NIVELES (LEVEL REWARDS)
          ========================================= */}
          <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-8 shadow-2xl flex flex-col relative overflow-hidden group">
            <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2 z-10 border-b border-[#252839] pb-4">Level Up Rewards</h2>
            <p className="text-[#8f9ac6] text-sm font-bold mb-6 z-10 mt-4">Play games to earn XP. Reach new levels to unlock permanent perks and instant bonuses.</p>

            {/* Progreso visual */}
            <div className="bg-[#141323] border border-[#2F3347] rounded-xl p-4 mb-6 z-10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-white font-black">Level 1</span>
                    <span className="text-[#8f9ac6] font-bold text-xs">450 / 1000 XP</span>
                </div>
                <div className="w-full h-2 bg-[#0b0e14] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#6C63FF] to-[#a855f7] w-[45%] shadow-[0_0_10px_#a855f7]"></div>
                </div>
                <p className="text-[#555b82] text-[10px] font-black uppercase tracking-widest text-center mt-3">Level 2 unlocks at 1,000 XP</p>
            </div>

            <div className="space-y-3 z-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
                {/* Recompensa Nivel 2 */}
                <div className="bg-[#141323] border border-[#2F3347] rounded-xl p-3 flex items-center justify-between opacity-50 grayscale">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2a2e44] flex items-center justify-center font-black text-white">2</div>
                        <div>
                            <p className="text-white font-bold text-sm">Level 2 Bonus</p>
                            <p className="text-[#555b82] text-xs font-black"><GreenCoin cls="w-3 h-3"/> +500 <span className="mx-1">•</span> <RedCoin cls="w-3 h-3"/> +10K</p>
                        </div>
                    </div>
                    <span className="text-[#555b82] text-xl">🔒</span>
                </div>

                {/* Recompensa Nivel 10 */}
                <div className="bg-[#141323] border border-[#2F3347] rounded-xl p-3 flex items-center justify-between opacity-50 grayscale">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#2a2e44] flex items-center justify-center font-black text-white">10</div>
                        <div>
                            <p className="text-white font-bold text-sm">VIP Status</p>
                            <p className="text-[#555b82] text-xs font-black">Daily rewards doubled</p>
                        </div>
                    </div>
                    <span className="text-[#555b82] text-xl">🔒</span>
                </div>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2F3347; border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
