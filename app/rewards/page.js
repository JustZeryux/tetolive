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

      // CAMBIO A TABLA REAL: profiles
      const { data: profile } = await supabase.from('profiles').select('ultimo_reclamo_diario').eq('id', user.id).single();
// Función para reclamar el bono diario
  const claimDaily = async () => {
    if (!currentUser) return alert("Debes iniciar sesión para reclamar recompensas.");
    
    // Aquí puedes llamar a tu RPC o hacer el update directo a la BD
    const { data, error } = await supabase.rpc('reclamar_diario', {
        p_user_id: currentUser.id
    });

    if (error) {
        alert(error.message || "Error al reclamar la recompensa.");
    } else {
        alert("¡Recompensa diaria reclamada con éxito!");
        // Aquí actualizas tu UI o el estado para deshabilitar el botón
    }
  };
      if (profile && profile.ultimo_reclamo_diario) {
          const lastClaim = new Date(profile.ultimo_reclamo_diario).getTime();
          const now = Date.now();
          const nextClaimTime = lastClaim + (24 * 60 * 60 * 1000);
        
          
          if (now < nextClaimTime) {
            setTimeLeft(Math.floor((nextClaimTime - now) / 1000));
          } else {
            setTimeLeft(0);
          }
      } else {
         setTimeLeft(0);
      }
      setCargando(false);
    };
    fetchUserData();
  }, []);

  
 useEffect(() => {
    if (timeLeft <= 0) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0; // Ya se puede reclamar
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // <-- DEJA EL ARREGLO VACÍO AQUÍ

  const formatTime = (ts) => {
    if (ts <= 0) return "00h 00m 00s";
    const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60), s = ts % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in flex flex-col items-center">
      <div className="max-w-2xl w-full text-center mb-10 mt-10">
        <h1 className="text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] mb-4 drop-shadow-md">
          🎁 Daily Rewards
        </h1>
        <p className="text-[#8f9ac6] font-bold text-lg mb-8">Reclama monedas gratis cada 24 horas.</p>

        <div className="bg-[#14151f] border border-[#252839] rounded-3xl p-10 flex flex-col items-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#22c55e]/10 to-transparent pointer-events-none"></div>
          
          <img src="/Jackpot.png" alt="Reward Box" className="w-40 h-40 object-contain mb-8 drop-shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-pulse-slow" />
          
          <h2 className="text-3xl font-black uppercase mb-4 text-white">Daily Bonus</h2>
          
          <div className="bg-[#0b0e14] px-8 py-4 rounded-2xl border border-[#252839] mb-8 font-mono text-3xl font-bold text-[#8f9ac6] flex items-center justify-center min-w-[250px] shadow-inner">
             {cargando ? "Cargando..." : timeLeft > 0 ? formatTime(timeLeft) : <span className="text-[#22c55e]">¡LISTO PARA RECLAMAR!</span>}
          </div>

          <button 
             onClick={claimDaily}
             disabled={procesando || timeLeft > 0 || cargando}
             className={`w-full py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all ${
                timeLeft > 0 || cargando
                ? 'bg-[#1c1f2e] text-[#4a506b] border border-[#252839] cursor-not-allowed'
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-[#0b0e14] shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:-translate-y-1'
             }`}
          >
             {procesando ? 'Procesando...' : timeLeft > 0 ? 'Espera a mañana' : 'Reclamar Premio'}
          </button>
        </div>
      </div>
    </div>
  );
}
