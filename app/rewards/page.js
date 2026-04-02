"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-5 h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G"/>;

export default function RewardsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  // Estados de UI
  const [timeToNextDaily, setTimeToNextDaily] = useState(null);
  const [canClaimDaily, setCanClaimDaily] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // Niveles Hardcodeados (Premios Visuales)
  const LEVEL_MILESTONES = [
    { level: 5, reward: 1000, desc: "Bronze Tier Bonus" },
    { level: 10, reward: 5000, desc: "Silver Tier Bonus" },
    { level: 25, reward: 25000, desc: "Gold Tier Bonus" },
    { level: 50, reward: 100000, desc: "Diamond Tier Bonus" },
    { level: 100, reward: 500000, desc: "Teto Legend Bonus" },
  ];

  const fetchUserAndProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) {
          setProfile(data);
          calcularTiempoDiario(data.last_daily_claim);
      }
    }
  };

  useEffect(() => {
    fetchUserAndProfile();
  }, []);

  // Calcular el contador regresivo del Daily
  const calcularTiempoDiario = (lastClaim) => {
    if (!lastClaim) {
        setCanClaimDaily(true);
        return;
    }
    const checkTime = () => {
        const nextClaim = new Date(lastClaim).getTime() + (24 * 60 * 60 * 1000);
        const now = Date.now();
        const diff = nextClaim - now;

        if (diff <= 0) {
            setCanClaimDaily(true);
            setTimeToNextDaily("READY");
        } else {
            setCanClaimDaily(false);
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            setTimeToNextDaily(`${h}h ${m}m ${s}s`);
        }
    };
    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  };

  // --- FUNCIONES DE RECLAMO AL BACKEND ---

  const handleClaimDaily = async () => {
    if (!currentUser || !canClaimDaily || isClaiming) return;
    setIsClaiming(true);

    const { data, error } = await supabase.rpc('reclamar_diario', { p_user_id: currentUser.id });
    
    if (error || data?.error) {
        alert(error?.message || data?.error || "Error al reclamar.");
    } else {
        alert(`¡Boom! Reclamaste ${data.reward} Green Coins.`);
        fetchUserAndProfile(); // Recargamos para actualizar el UI
    }
    setIsClaiming(false);
  };

  const handleClaimRakeback = async () => {
    if (!currentUser || profile?.vault_verde <= 0 || isClaiming) return;
    setIsClaiming(true);

    const { data, error } = await supabase.rpc('reclamar_rakeback', { p_user_id: currentUser.id });

    if (error || data?.error) {
        alert(error?.message || data?.error || "Error al reclamar rakeback.");
    } else {
        alert(`¡Rakeback cobrado! Se añadieron ${data.claimed} a tu saldo.`);
        fetchUserAndProfile();
    }
    setIsClaiming(false);
  };

  // --- CÁLCULOS DE NIVEL ---
  const currentLevel = profile?.level || 1;
  const currentXP = profile?.xp || 0;
  const xpForNextLevel = currentLevel * 500; // Fórmula que usamos en el SQL
  const xpProgress = Math.min(100, (currentXP / xpForNextLevel) * 100);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 font-sans animate-fade-in relative overflow-hidden">
      
      {/* Background FX */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#6C63FF] opacity-10 blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#22c55e] opacity-10 blur-[150px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* HEADER */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-[#8f9ac6] drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            Rewards Hub
          </h1>
          <p className="text-[#8f9ac6] font-bold mt-4 text-lg">Claim your daily cases, rakeback, and level up bonuses.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT COLUMN: DAILY & RAKEBACK */}
            <div className="space-y-8">
                
                {/* DAILY REWARD CARD */}
                <div className="bg-[#14151f] border-2 border-[#252839] rounded-3xl p-8 relative overflow-hidden group hover:border-[#22c55e]/50 transition-colors">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#22c55e] opacity-5 blur-[100px] group-hover:opacity-20 transition-opacity"></div>
                    
                    <h2 className="text-2xl font-black uppercase tracking-widest mb-6 flex items-center gap-3">
                        <span className="text-3xl">🗓️</span> Daily Reward
                    </h2>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-8 bg-[#0b0e14] border border-[#252839] p-6 rounded-2xl relative z-10">
                        <div className="w-32 h-32 relative shrink-0 animate-float">
                            <div className="absolute inset-0 bg-[#22c55e] opacity-20 blur-2xl rounded-full"></div>
                            <img src="/Cases.png" className="w-full h-full object-contain relative z-10" alt="Daily Case" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-xl font-black uppercase text-white mb-2">Free Green Coins</h3>
                            <p className="text-[#8f9ac6] text-sm mb-6 font-bold">Log in every 24 hours to claim your guaranteed reward.</p>
                            
                            <button 
                                onClick={handleClaimDaily}
                                disabled={!canClaimDaily || isClaiming}
                                className={`w-full sm:w-auto px-10 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                                    canClaimDaily 
                                    ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-black hover:scale-105 shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                                    : 'bg-[#1c1f2e] text-[#555b82] border border-[#252839] cursor-not-allowed'
                                }`}
                            >
                                {isClaiming ? 'Claiming...' : canClaimDaily ? 'Claim Now' : timeToNextDaily}
                            </button>
                        </div>
                    </div>
                </div>

                {/* RAKEBACK CARD */}
                <div className="bg-[#14151f] border-2 border-[#252839] rounded-3xl p-8 relative overflow-hidden group hover:border-[#facc15]/50 transition-colors">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#facc15] opacity-5 blur-[100px] group-hover:opacity-20 transition-opacity"></div>
                    
                    <h2 className="text-2xl font-black uppercase tracking-widest mb-2 flex items-center gap-3">
                        <span className="text-3xl">💰</span> Rakeback Vault
                    </h2>
                    <p className="text-[#8f9ac6] text-sm font-bold mb-8">Earn a percentage back on every wager you make across the site.</p>
                    
                    <div className="bg-[#0b0e14] border border-[#252839] p-8 rounded-2xl flex flex-col items-center justify-center relative z-10">
                        <span className="text-[#555b82] font-black uppercase tracking-widest text-xs mb-2">Available to Claim</span>
                        <div className="text-5xl font-black text-white flex items-center gap-3 mb-8 drop-shadow-[0_0_15px_rgba(250,204,21,0.2)]">
                            <GreenCoin cls="w-10 h-10 grayscale hover:grayscale-0 transition-all"/> 
                            {profile?.vault_verde?.toLocaleString() || 0}
                        </div>
                        
                        <button 
                            onClick={handleClaimRakeback}
                            disabled={!profile || profile.vault_verde <= 0 || isClaiming}
                            className="w-full bg-[#facc15] hover:bg-[#eab308] text-black py-4 rounded-xl font-black uppercase tracking-widest shadow-[0_0_15px_rgba(250,204,21,0.3)] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-all"
                        >
                            {isClaiming ? 'Transferring...' : 'Claim to Balance'}
                        </button>
                    </div>
                </div>

            </div>

            {/* RIGHT COLUMN: LEVEL REWARDS */}
            <div className="bg-[#14151f] border-2 border-[#252839] rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-64 bg-[#6C63FF] opacity-5 blur-[100px]"></div>

                <div className="flex justify-between items-end mb-8 relative z-10">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3 mb-2">
                            <span className="text-3xl">⭐</span> Level Progress
                        </h2>
                        <p className="text-[#8f9ac6] text-sm font-bold">Wager to gain XP and unlock elite milestones.</p>
                    </div>
                    <div className="text-right">
                        <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#6C63FF] to-[#8b5cf6] drop-shadow-md">
                            LVL {currentLevel}
                        </span>
                    </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="mb-10 relative z-10">
                    <div className="flex justify-between text-xs font-black text-[#555b82] mb-2 tracking-widest">
                        <span>XP: {currentXP.toLocaleString()}</span>
                        <span>NEXT: {xpForNextLevel.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-4 bg-[#0b0e14] rounded-full border border-[#252839] overflow-hidden relative">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#6C63FF] to-[#a78bfa] shadow-[0_0_10px_#6C63FF] transition-all duration-1000"
                            style={{ width: `${xpProgress}%` }}
                        ></div>
                    </div>
                </div>

                {/* MILESTONES LIST */}
                <div className="space-y-3 relative z-10">
                    <h3 className="text-[#555b82] font-black uppercase tracking-widest text-xs mb-4">Milestone Rewards</h3>
                    
                    {LEVEL_MILESTONES.map((tier, idx) => {
                        const isUnlocked = currentLevel >= tier.level;
                        return (
                            <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUnlocked ? 'bg-[#1c1f2e] border-[#6C63FF]/50 shadow-[0_0_15px_rgba(108,99,255,0.1)]' : 'bg-[#0b0e14] border-[#252839] opacity-70'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center font-black text-lg ${isUnlocked ? 'bg-[#6C63FF]/20 border-[#6C63FF] text-[#a78bfa]' : 'bg-[#14151f] border-[#252839] text-[#555b82]'}`}>
                                        {tier.level}
                                    </div>
                                    <div>
                                        <h4 className={`font-black uppercase tracking-wider text-sm ${isUnlocked ? 'text-white' : 'text-[#8f9ac6]'}`}>{tier.desc}</h4>
                                        <p className="text-[#555b82] text-xs font-bold mt-0.5">Reach Level {tier.level}</p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className={`font-black flex items-center gap-1 ${isUnlocked ? 'text-white drop-shadow-md' : 'text-[#555b82]'}`}>
                                        <GreenCoin cls={`w-4 h-4 ${!isUnlocked && 'grayscale'}`}/> {tier.reward.toLocaleString()}
                                    </span>
                                    {isUnlocked ? (
                                        <span className="text-[10px] font-black text-[#22c55e] uppercase tracking-widest mt-1">Unlocked</span>
                                    ) : (
                                        <span className="text-[10px] font-black text-[#ef4444] uppercase tracking-widest mt-1 flex items-center gap-1">🔒 Locked</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

            </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-float { animation: floatItem 4s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatItem { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
      `}} />
    </div>
  );
}
