"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

export default function RewardsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0); 
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCargando(false); return; }
      setCurrentUser(user);

      const { data: profile } = await supabase.from('perfiles').select('ultimo_reclamo_diario').eq('id', user.id).single();

      if (profile && profile.ultimo_reclamo_diario) {
          const lastClaim = new Date(profile.ultimo_reclamo_diario).getTime();
          const now = Date.now();
          const nextClaimTime = lastClaim + (24 * 60 * 60 * 1000);
          
          if (now < nextClaimTime) setTimeLeft(Math.floor((nextClaimTime - now) / 1000));
          else setTimeLeft(0);
      }
      setCargando(false);
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => setTimeLeft(prev => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const claimDaily = async () => {
    if (!currentUser) return alert("Debes iniciar sesión.");
    if (timeLeft > 0) return alert("Aún no es hora.");
    
    setProcesando(true);
    const { data, error } = await supabase.rpc('reclamar_recompensa_diaria', { p_user_id: currentUser.id });

    if (error || data?.error) {
        alert("Error: " + (data?.error || error.message));
    } else {
        alert(`¡Reclamado! Recibiste ${data.recompensa_verde.toLocaleString()} 🟢`);
        setTimeLeft(24 * 60 * 60); 
    }
    setProcesando(false);
  };

  const formatTime = (ts) => {
    const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in flex flex-col items-center">
      <div className="max-w-2xl w-full text-center mb-10 mt-10">
        <h1 className="text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] mb-4">
          Daily Free Coins
        </h1>
        <p className="text-[#8f9ac6] font-bold text-lg">Come back every 24 hours to claim your green coins.</p>
      </div>

      <div className="w-full max-w-md bg-[#1c1f2e] border border-[#252839] rounded-3xl p-8 shadow-2xl flex flex-col items-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-[#22c55e] opacity-5 group-hover:opacity-10 transition-opacity"></div>
        
        <div className="text-8xl mb-6 drop-shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-bounce">🎁</div>
        
        <div className="bg-[#141323] border border-[#2F3347] px-8 py-3 rounded-2xl flex flex-col items-center shadow-inner mb-8 z-10">
            <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1">You will receive</span>
            <span className="text-3xl font-black text-[#22c55e] flex items-center gap-2"><GreenCoin cls="w-6 h-6"/> 5,000</span>
        </div>

        {cargando ? (
            <div className="w-full h-14 bg-[#141323] border border-[#2F3347] rounded-xl flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#555b82] border-t-white rounded-full animate-spin"></div></div>
        ) : timeLeft > 0 ? (
            <button disabled className="w-full h-14 bg-[#141323] border border-[#2F3347] rounded-xl font-black text-[#555b82] uppercase tracking-widest flex items-center justify-center gap-2">
                <span>Available in</span> <span className="text-[#8f9ac6]">{formatTime(timeLeft)}</span>
            </button>
        ) : (
            <button onClick={claimDaily} disabled={procesando} className="w-full h-14 bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] hover:to-[#22c55e] text-[#0b0e14] rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:-translate-y-1 z-10 disabled:opacity-50">
              CLAIM NOW
            </button>
        )}
      </div>
    </div>
  );
}
