"use client";
import { useState } from 'react';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function AffiliatesPage() {
  // Estados simulados
  const [promoCode, setPromoCode] = useState('Teto');
  const [isEditing, setIsEditing] = useState(false);
  const [tempCode, setTempCode] = useState('');
  
  const stats = {
    availableEarnings: 250000,
    totalEarnings: 1550000,
    totalReferred: 142,
    totalWageredByRefs: 50000000,
    currentTier: 'Silver',
    commission: 5, // 5% de la ventaja de la casa
    nextTier: 'Gold',
    nextTierReq: 100000000, // Wager requerido para el siguiente nivel
    nextCommission: 7
  };

  const progressPct = Math.min((stats.totalWageredByRefs / stats.nextTierReq) * 100, 100);

  const handleSaveCode = () => {
    if (tempCode.length < 4) return alert("Code must be at least 4 characters.");
    setPromoCode(tempCode.toUpperCase());
    setIsEditing(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://tu-sitio.com/r/${promoCode}`);
    alert("Referral link copied to clipboard!");
  };

  const claimEarnings = () => {
    if (stats.availableEarnings <= 0) return alert("No earnings to claim!");
    alert(`Successfully claimed ${formatValue(stats.availableEarnings)} to your Green Balance!`);
    // Aquí harías el fetch a tu backend
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1000px] mx-auto">
        
        {/* HEADER */}
        <div className="mb-8 text-center md:text-left">
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] to-[#8f9ac6]">
            Affiliate Program 🤝
          </h1>
          <p className="text-[#8f9ac6] font-bold mt-2">Invite your friends and earn passive income from every bet they place.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          
          {/* SECCIÓN DE CÓDIGO Y LINK (Ocupa 2 columnas) */}
          <div className="md:col-span-2 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#6C63FF] to-transparent"></div>
            <h2 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Your Affiliate Code</h2>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1 bg-[#0b0e14] border border-[#252839] rounded-xl flex items-center p-2 focus-within:border-[#6C63FF] transition-colors">
                <span className="text-[#555b82] font-black px-3 select-none">CODE:</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    maxLength={12}
                    placeholder="NEWCODE"
                    onChange={(e) => setTempCode(e.target.value)}
                    className="w-full bg-transparent text-white font-black outline-none uppercase tracking-widest"
                  />
                ) : (
                  <span className="w-full text-white font-black tracking-widest px-2">{promoCode}</span>
                )}
              </div>
              
              {isEditing ? (
                <button onClick={handleSaveCode} className="px-6 py-3 bg-[#22c55e] hover:bg-[#16a34a] text-black font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                  Save
                </button>
              ) : (
                <button onClick={() => {setTempCode(promoCode); setIsEditing(true);}} className="px-6 py-3 bg-[#2a2e44] hover:bg-[#3f4354] text-white font-black rounded-xl text-sm uppercase tracking-widest border border-[#3f4354] transition-all">
                  Edit
                </button>
              )}
            </div>

            <h2 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Share Link</h2>
            <div className="flex items-center gap-2 bg-[#141323] p-3 rounded-xl border border-[#252839] cursor-pointer hover:border-[#6C63FF] transition-colors group" onClick={copyLink}>
              <span className="text-[#555b82] text-xl group-hover:text-[#6C63FF] transition-colors">🔗</span>
              <span className="text-white font-medium text-sm truncate select-all">https://tu-sitio.com/r/{promoCode}</span>
              <span className="ml-auto text-xs font-black text-[#6C63FF] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
            </div>
          </div>

          {/* CLAIM EARNINGS CARD */}
          <div className="bg-[#1c1f2e] border border-[#3AFF4E]/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(58,255,78,0.1)] flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(58,255,78,0.05)_0%,transparent_70%)] pointer-events-none"></div>
            
            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-2">Available Earnings</h3>
            <div className="text-4xl font-black text-[#3AFF4E] flex items-center justify-center gap-2 mb-6 drop-shadow-[0_0_10px_rgba(58,255,78,0.5)]">
              <GreenCoin cls="w-8 h-8" /> {formatValue(stats.availableEarnings)}
            </div>
            
            <button 
              onClick={claimEarnings}
              disabled={stats.availableEarnings <= 0}
              className="w-full py-4 rounded-xl font-black text-sm text-[#0b0e14] uppercase tracking-widest bg-gradient-to-r from-[#3AFF4E] to-[#22c55e] hover:from-[#4ade80] hover:to-[#3AFF4E] transition-all shadow-[0_4px_15px_rgba(58,255,78,0.4)] hover:shadow-[0_6px_25px_rgba(58,255,78,0.6)] hover:-translate-y-1 disabled:opacity-50 disabled:grayscale"
            >
              Claim to Balance
            </button>
          </div>

        </div>

        {/* STATS & TIER PROGRESS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* STATS GRID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-5 shadow-lg flex flex-col justify-center">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-1">Total Referred</span>
              <span className="text-2xl font-black text-white">{stats.totalReferred} <span className="text-xs text-[#555b82]">Users</span></span>
            </div>
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-5 shadow-lg flex flex-col justify-center">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-1">Total Earnings</span>
              <span className="text-2xl font-black text-white flex items-center gap-1.5"><GreenCoin cls="w-5 h-5"/> {formatValue(stats.totalEarnings)}</span>
            </div>
            <div className="col-span-2 bg-[#141323] border border-[#252839] rounded-2xl p-5 shadow-inner flex flex-col justify-center items-center text-center">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-1">Total Wagered by Referrals</span>
              <span className="text-3xl font-black text-white flex items-center gap-2"><GreenCoin cls="w-6 h-6"/> {formatValue(stats.totalWageredByRefs)}</span>
            </div>
          </div>

          {/* TIER PROGRESS CARD */}
          <div className="bg-[#1c1f2e] border border-[#facc15]/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(250,204,21,0.05)] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#facc15] opacity-10 blur-[50px] pointer-events-none"></div>
            
            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Affiliate Tier Progress</h3>
            
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] text-[#555b82] font-black uppercase tracking-widest">Current Tier</p>
                <p className="text-2xl font-black text-[#c084fc] drop-shadow-md">{stats.currentTier}</p>
                <p className="text-xs font-bold text-white bg-[#c084fc]/20 px-2 py-1 rounded mt-1 inline-block border border-[#c084fc]/50">{stats.commission}% Commission</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#555b82] font-black uppercase tracking-widest">Next Tier</p>
                <p className="text-2xl font-black text-[#facc15] drop-shadow-md">{stats.nextTier}</p>
                <p className="text-xs font-bold text-white bg-[#facc15]/20 px-2 py-1 rounded mt-1 inline-block border border-[#facc15]/50">{stats.nextCommission}% Commission</p>
              </div>
            </div>

            <div className="mt-auto">
              <div className="flex justify-between text-[10px] font-black text-[#8f9ac6] mb-2 uppercase tracking-widest">
                <span>Wagered</span>
                <span>{formatValue(stats.nextTierReq - stats.totalWageredByRefs)} left</span>
              </div>
              {/* PROGRESS BAR */}
              <div className="h-4 w-full bg-[#141323] rounded-full overflow-hidden border border-[#252839] relative">
                <div 
                  className="h-full bg-gradient-to-r from-[#c084fc] to-[#facc15] shadow-[0_0_10px_#facc15] transition-all duration-1000 relative"
                  style={{ width: `${progressPct}%` }}
                >
                  {/* Animación de brillo en la barra */}
                  <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-full animate-[shine_2s_infinite]"></div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shine { 100% { transform: translateX(100%); } }
      `}} />
    </div>
  );
}