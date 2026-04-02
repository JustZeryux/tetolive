"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// Función para calcular el nivel del afiliado según lo apostado por sus referidos
const getTierInfo = (wagered) => {
  if (wagered < 50000) return { current: 'Bronze', comm: 1, next: 'Silver', req: 50000, nextComm: 3 };
  if (wagered < 250000) return { current: 'Silver', comm: 3, next: 'Gold', req: 250000, nextComm: 5 };
  if (wagered < 1000000) return { current: 'Gold', comm: 5, next: 'Diamond', req: 1000000, nextComm: 7 };
  return { current: 'Diamond', comm: 7, next: 'MAX', req: 1000000, nextComm: 7 };
};

export default function AffiliatesPage() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  
  const [promoCode, setPromoCode] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempCode, setTempCode] = useState('');
  
  const [stats, setStats] = useState({
    availableEarnings: 0,
    totalReferred: 0,
    totalWageredByRefs: 0
  });

  const tierInfo = getTierInfo(stats.totalWageredByRefs);
  const progressPct = tierInfo.next === 'MAX' ? 100 : Math.min((stats.totalWageredByRefs / tierInfo.req) * 100, 100);

  // 1. Cargar datos del perfil y estadísticas de afiliados
  const fetchData = async () => {
    setCargando(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (currentUser) {
      setUser(currentUser);
      
      // Obtener datos del perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('promo_code, affiliate_earnings, refs_wagered')
        .eq('id', currentUser.id)
        .single();

      // Contar cuántos usuarios tienen a este usuario como 'referred_by'
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('referred_by', currentUser.id);

      if (profile) {
        setPromoCode(profile.promo_code || '');
        setStats({
          availableEarnings: profile.affiliate_earnings || 0,
          totalReferred: count || 0,
          totalWageredByRefs: profile.refs_wagered || 0,
        });
      }
    }
    setCargando(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Guardar un nuevo código de promoción
  const handleSaveCode = async () => {
    if (tempCode.length < 4) return alert("Code must be at least 4 characters.");
    const upperCode = tempCode.toUpperCase();

    // Verificar si el código ya existe en otro perfil
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('promo_code', upperCode)
      .single();

    if (existing && existing.id !== user.id) {
      return alert("This promo code is already taken by another user!");
    }

    // Guardar el código en Supabase
    const { error } = await supabase
      .from('profiles')
      .update({ promo_code: upperCode })
      .eq('id', user.id);

    if (error) {
      alert("Error saving promo code.");
      console.error(error);
    } else {
      setPromoCode(upperCode);
      setIsEditing(false);
      alert("Promo code updated successfully!");
    }
  };

  const copyLink = () => {
    if (!promoCode) return alert("Create a promo code first!");
    navigator.clipboard.writeText(`${window.location.origin}/r/${promoCode}`);
    alert("Referral link copied to clipboard!");
  };

  // 3. Reclamar ganancias
  const claimEarnings = async () => {
    if (stats.availableEarnings <= 0) return alert("No earnings to claim!");
    
    // Obtener saldo actual para sumar de forma segura
    const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', user.id).single();
    const newBalance = (profile.saldo_verde || 0) + stats.availableEarnings;

    // Actualizar base de datos (Suma saldo, resetea ganancias de afiliado)
    const { error } = await supabase
      .from('profiles')
      .update({ 
        saldo_verde: newBalance,
        affiliate_earnings: 0 
      })
      .eq('id', user.id);

    if (!error) {
      alert(`Successfully claimed ${formatValue(stats.availableEarnings)} to your Green Balance!`);
      
      // Registrar transacción en el historial
      await supabase.from('transactions_log').insert({
        user_id: user.id,
        tipo: 'claim_affiliate',
        monto: stats.availableEarnings,
        moneda: 'verde'
      });
      
      fetchData(); // Recargar la página
    } else {
      alert("Error claiming earnings.");
    }
  };

  if (cargando) return <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center text-white">Loading affiliate data...</div>;

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
                    value={tempCode}
                    onChange={(e) => setTempCode(e.target.value)}
                    className="w-full bg-transparent text-white font-black outline-none uppercase tracking-widest"
                  />
                ) : (
                  <span className="w-full text-white font-black tracking-widest px-2">
                    {promoCode || "NO CODE YET"}
                  </span>
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
              <span className="text-white font-medium text-sm truncate select-all">
                {promoCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${promoCode}` : 'Create a code to get your link'}
              </span>
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
            <div className="col-span-2 md:col-span-1 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-5 shadow-lg flex flex-col justify-center">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-1">Total Referred</span>
              <span className="text-2xl font-black text-white">{stats.totalReferred} <span className="text-xs text-[#555b82]">Users</span></span>
            </div>
            <div className="col-span-2 md:col-span-1 bg-[#141323] border border-[#252839] rounded-2xl p-5 shadow-inner flex flex-col justify-center">
              <span className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest mb-1">Wagered by Referrals</span>
              <span className="text-2xl font-black text-white flex items-center gap-2"><GreenCoin cls="w-5 h-5"/> {formatValue(stats.totalWageredByRefs)}</span>
            </div>
          </div>

          {/* TIER PROGRESS CARD */}
          <div className="bg-[#1c1f2e] border border-[#facc15]/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(250,204,21,0.05)] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#facc15] opacity-10 blur-[50px] pointer-events-none"></div>
            
            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Affiliate Tier Progress</h3>
            
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-[10px] text-[#555b82] font-black uppercase tracking-widest">Current Tier</p>
                <p className="text-2xl font-black text-[#c084fc] drop-shadow-md">{tierInfo.current}</p>
                <p className="text-xs font-bold text-white bg-[#c084fc]/20 px-2 py-1 rounded mt-1 inline-block border border-[#c084fc]/50">{tierInfo.comm}% Commission</p>
              </div>
              {tierInfo.next !== 'MAX' && (
                <div className="text-right">
                  <p className="text-[10px] text-[#555b82] font-black uppercase tracking-widest">Next Tier</p>
                  <p className="text-2xl font-black text-[#facc15] drop-shadow-md">{tierInfo.next}</p>
                  <p className="text-xs font-bold text-white bg-[#facc15]/20 px-2 py-1 rounded mt-1 inline-block border border-[#facc15]/50">{tierInfo.nextComm}% Commission</p>
                </div>
              )}
            </div>

            <div className="mt-auto">
              {tierInfo.next !== 'MAX' ? (
                <>
                  <div className="flex justify-between text-[10px] font-black text-[#8f9ac6] mb-2 uppercase tracking-widest">
                    <span>Wagered</span>
                    <span>{formatValue(tierInfo.req - stats.totalWageredByRefs)} left</span>
                  </div>
                  {/* PROGRESS BAR */}
                  <div className="h-4 w-full bg-[#141323] rounded-full overflow-hidden border border-[#252839] relative">
                    <div 
                      className="h-full bg-gradient-to-r from-[#c084fc] to-[#facc15] shadow-[0_0_10px_#facc15] transition-all duration-1000 relative"
                      style={{ width: `${progressPct}%` }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-full animate-[shine_2s_infinite]"></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-[#facc15] font-black uppercase tracking-widest text-sm bg-[#facc15]/10 py-2 rounded-lg border border-[#facc15]/30">
                  Maximum Tier Reached! 🏆
                </div>
              )}
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
