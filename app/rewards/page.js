"use client";
import { useState } from 'react';

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function RewardsPage() {
  // Datos simulados del usuario
  const userStats = {
    level: 42,
    rank: 'Gold',
    wagered: 15500000,
    nextRankWager: 25000000,
    rakebackAvailable: 125000,
    rakebackPercentage: 5, // 5% de lo apostado se devuelve
  };

  const progressPct = (userStats.wagered / userStats.nextRankWager) * 100;

  // Cajas Diarias - Escalan con el nivel
  const DAILY_CASES = [
    { id: 1, name: 'Bronze Case', levelReq: 0, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#cd7f32', status: 'available' },
    { id: 2, name: 'Silver Case', levelReq: 10, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#9ca3af', status: 'claimed' },
    { id: 3, name: 'Gold Case', levelReq: 30, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#facc15', status: 'available' },
    { id: 4, name: 'Castigo Divino Case', levelReq: 50, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#ef4444', status: 'locked' },
    { id: 5, name: 'Agujero Negro Case', levelReq: 80, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#a855f7', status: 'locked' },
    { id: 6, name: 'Diamond Case', levelReq: 100, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#38bdf8', status: 'locked' },
  ];

  const claimRakeback = () => {
    alert("Rakeback claimed! Added to your Green Balance.");
  };

  const openDaily = async (caja) => {
    if (caja.status === 'locked') return alert(`Necesitas nivel ${caja.levelReq} para abrir esta caja.`);
    if (caja.status === 'claimed') return alert("Ya reclamaste esto hoy. ¡Vuelve mañana!");

    // Llamada real a Supabase
    const { data, error } = await supabase.rpc('claim_daily_reward');

    if (error) {
      alert("❌ Error: " + error.message);
    } else if (data && data.success) {
      alert(`🎉 ¡Felicidades! Abriste la ${caja.name} y ganaste una mascota de $${data.value.toLocaleString()}`);
      // Aquí podrías recargar la página o actualizar el estado para que salga como 'claimed'
      window.location.reload(); 
    } else {
      alert(`⏳ ${data.message}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1000px] mx-auto space-y-8">
        
        {/* HEADER & RAKEBACK PANEL */}
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* USER LEVEL PROGRESS */}
          <div className="flex-[2] bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#facc15] opacity-5 blur-[100px] pointer-events-none"></div>
            
            <h2 className="text-2xl font-black uppercase tracking-widest mb-6">VIP Progress 🌟</h2>
            
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full border-4 border-[#facc15] bg-[#141323] flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                <span className="text-3xl font-black text-[#facc15]">{userStats.level}</span>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Current Rank</p>
                    <p className="text-xl font-black text-[#facc15]">{userStats.rank}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Wagered</p>
                    <p className="font-bold flex items-center gap-1"><GreenCoin cls="w-3 h-3"/> {formatValue(userStats.wagered)} / {formatValue(userStats.nextRankWager)}</p>
                  </div>
                </div>
                {/* PROGRESS BAR */}
                <div className="h-4 w-full bg-[#141323] rounded-full overflow-hidden border border-[#252839]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#facc15] to-[#eab308] shadow-[0_0_10px_#facc15] transition-all duration-1000"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#8f9ac6] font-medium italic">Level up to unlock better Daily Cases and higher Rakeback percentages.</p>
          </div>

          {/* RAKEBACK CLAIM */}
          <div className="flex-[1] bg-[#1c1f2e] border border-[#22c55e]/30 rounded-2xl p-6 flex flex-col justify-center items-center text-center shadow-[0_0_30px_rgba(34,197,94,0.1)] relative">
            <h3 className="text-[#8f9ac6] text-sm font-bold uppercase tracking-widest mb-2">Available Rakeback</h3>
            <div className="text-4xl font-black text-[#22c55e] flex items-center justify-center gap-2 mb-2 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
              <GreenCoin cls="w-8 h-8" /> {formatValue(userStats.rakebackAvailable)}
            </div>
            <p className="text-xs text-[#8f9ac6] mb-6 font-bold">You are earning <span className="text-white">{userStats.rakebackPercentage}%</span> back on every bet.</p>
            
            <button 
              onClick={claimRakeback}
              disabled={userStats.rakebackAvailable === 0}
              className="w-full py-3 rounded-xl font-black text-sm text-[#0b0e14] uppercase tracking-widest bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] hover:to-[#22c55e] transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:shadow-[0_0_25px_rgba(34,197,94,0.6)] hover:-translate-y-1 disabled:opacity-50 disabled:grayscale"
            >
              Claim Rakeback
            </button>
          </div>
        </div>

        {/* DAILY CASES GRID */}
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest mb-2">Daily Cases 🎁</h2>
          <p className="text-[#8f9ac6] font-bold mb-6">Come back every 24 hours to claim your free cases. Reach higher levels to unlock premium boxes.</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {DAILY_CASES.map((caja) => (
              <div 
                key={caja.id} 
                className={`relative bg-[#141323] border ${caja.status === 'available' ? 'border-[#3AFF4E] shadow-[0_0_15px_rgba(58,255,78,0.2)] hover:-translate-y-2' : 'border-[#2F3347]'} rounded-xl p-4 flex flex-col items-center transition-all duration-300 group ${caja.status === 'locked' ? 'opacity-60 grayscale' : 'cursor-pointer'}`}
                onClick={() => openDaily(caja)}
              >
                {/* Visual Glow */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 50%, ${caja.color} 0%, transparent 70%)` }}></div>
                
                {/* Level Badge */}
                <div className="absolute top-2 left-2 bg-[#0b0e14] border border-[#252839] px-2 py-0.5 rounded text-[10px] font-black text-white z-20 flex items-center gap-1">
                  LVL {caja.levelReq}
                </div>

                {/* Status Icon */}
                {caja.status === 'locked' && <div className="absolute top-2 right-2 text-xl z-20">🔒</div>}
                {caja.status === 'claimed' && <div className="absolute top-2 right-2 text-xl z-20">⏳</div>}

                <img 
                  src={caja.img} 
                  alt={caja.name} 
                  className={`w-20 h-20 object-contain drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)] mb-4 z-10 transition-transform duration-300 ${caja.status === 'available' ? 'group-hover:scale-110 animate-float' : ''}`} 
                  style={{filter: `drop-shadow(0 0 15px ${caja.color}50)`}} 
                />
                
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest z-10 text-center mb-3 h-8 flex items-center justify-center">{caja.name}</h3>
                
                {/* Botón de estado */}
                <div className={`w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-center z-10 border ${
                  caja.status === 'available' ? 'bg-[#3AFF4E]/10 text-[#3AFF4E] border-[#3AFF4E]/30' : 
                  caja.status === 'claimed' ? 'bg-[#252839] text-[#8f9ac6] border-transparent' : 
                  'bg-[#0b0e14] text-[#555b82] border-[#252839]'
                }`}>
                  {caja.status === 'available' ? 'Open Now' : caja.status === 'claimed' ? 'Claimed' : 'Locked'}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
