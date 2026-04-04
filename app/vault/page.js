"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';
import { showToast } from '@/components/EpicToasts';
import PetCard from '@/components/PetCard';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) || '0';
};

export default function VaultPage() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // States
  const [view, setView] = useState('vault'); // 'vault' | 'daycare'
  const [action, setAction] = useState('deposit'); // 'deposit' | 'withdraw'
  const [amountInput, setAmountInput] = useState('');
  
  const [balances, setBalances] = useState({ walletGreen: 0, vaultGreen: 0 });
  const [inventory, setInventory] = useState([]);
  const [daycarePets, setDaycarePets] = useState([]);
  
  const [liveTime, setLiveTime] = useState(Date.now()); // For real-time yield updates
  const [epicClaimData, setEpicClaimData] = useState(null); // Epic Loot Window

  // --- 1. INITIAL FETCH ---
  const fetchAllData = async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUser(user);
      
      // Fetch Balances
      const { data: profile } = await supabase.from('profiles').select('saldo_verde, vault_verde').eq('id', user.id).single();
      if (profile) {
        setBalances({ walletGreen: profile.saldo_verde || 0, vaultGreen: profile.vault_verde || 0 });
      }

      // Fetch Inventory (Completamente blindado con '*, items(*)')
      const { data: inv, error: invError } = await supabase
        .from('inventory')
        .select(`*, items(*)`)
        .eq('user_id', user.id);
        
      if (invError) console.error("Error fetch inventory:", invError);
      
      if (inv) {
          setInventory(inv.map(i => {
              const itemData = Array.isArray(i.items) ? i.items[0] : (i.items || {});
              return {
                  ...itemData,
                  inv_id: i.id, 
                  item_id: i.item_id, 
                  is_shiny: i.is_shiny || itemData.is_shiny || false, 
                  is_mythic: i.is_mythic || itemData.is_mythic || false,
                  image_url: itemData.image_url || itemData.image || itemData.img || '/file.svg'
              };
          }));
      }

      // Fetch Daycare (Completamente blindado)
      const { data: daycare, error: dayError } = await supabase
        .from('daycare')
        .select(`*, items(*)`)
        .eq('user_id', user.id);
        
      if (dayError) console.error("Error fetch daycare:", dayError);
      
      if (daycare) {
          setDaycarePets(daycare.map(d => {
              const itemData = Array.isArray(d.items) ? d.items[0] : (d.items || {});
              return {
                  ...itemData,
                  daycare_id: d.id, 
                  item_id: d.item_id, 
                  deposited_at: d.deposited_at, 
                  is_shiny: d.is_shiny || itemData.is_shiny || false, 
                  is_mythic: d.is_mythic || itemData.is_mythic || false,
                  image_url: itemData.image_url || itemData.image || itemData.img || '/file.svg'
              };
          }));
      }
    }
    setCargando(false);
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => setLiveTime(Date.now()), 1000); 
    return () => clearInterval(interval);
  }, []);

  // --- 2. VAULT LOGIC (GREEN COINS ONLY) ---
  const getMaxBalance = () => action === 'deposit' ? balances.walletGreen : balances.vaultGreen;

  const handleQuickAmount = (multiplier) => {
    const max = getMaxBalance();
    if (multiplier === 'MAX') setAmountInput(max.toString());
    else if (multiplier === 'HALF') setAmountInput(Math.floor(max / 2).toString());
    else if (multiplier === 'CLEAR') setAmountInput('');
  };

  const handleVaultTransaction = async () => {
    if (procesando) return;
    const val = parseInt(amountInput);
    if (isNaN(val) || val <= 0) return showToast("Enter a valid amount!", "error");
    if (val > getMaxBalance()) return showToast("Insufficient balance!", "error");

    setProcesando(true);
    let newWallet = balances.walletGreen;
    let newVault = balances.vaultGreen;

    if (action === 'deposit') { newWallet -= val; newVault += val; } 
    else { newVault -= val; newWallet += val; }

    const { error } = await supabase.from('profiles').update({ saldo_verde: newWallet, vault_verde: newVault }).eq('id', user.id);

    if (error) {
      showToast("Transaction failed.", "error");
    } else {
      showToast(`Successfully ${action === 'deposit' ? 'deposited' : 'withdrew'} ${formatValue(val)} Green Coins!`, "success");
      await supabase.from('transactions_log').insert({ user_id: user.id, tipo: `vault_${action}`, monto: val, moneda: 'green' });
      setBalances({ walletGreen: newWallet, vaultGreen: newVault });
      setAmountInput('');
    }
    setProcesando(false);
  };

// --- 3. DAYCARE LOGIC (PETS) ---
  const calculateYield = (petValue, depositedAt) => {
    const elapsedMs = liveTime - new Date(depositedAt).getTime();
    const days = elapsedMs / (1000 * 60 * 60 * 24);
    
    const baseYield = (petValue || 0) * 0.25;
    const extraYield = (petValue || 0) * (0.005 * days);
    return baseYield + extraYield;
  };

  const depositToDaycare = async (pet) => {
    if (procesando) return;
    if (daycarePets.length >= 4) return showToast("Daycare is full! Max 4 pets allowed.", "error");
    
    setProcesando(true);
    
    // 1. Remove from inventory
    await supabase.from('inventory').delete().eq('id', pet.inv_id);
    
    // 2. Add to daycare (GUARDANDO SHINY/MYTHIC)
    const { data, error } = await supabase.from('daycare').insert({ 
        user_id: user.id, 
        item_id: pet.item_id,
        is_shiny: pet.is_shiny || false,
        is_mythic: pet.is_mythic || false
    }).select().single();
    
    if (error) {
      console.error(error);
      showToast("Error moving pet to daycare.", "error");
    } else {
      showToast(`${pet.name || 'Pet'} is now resting in the Daycare!`, "success");
      setInventory(prev => prev.filter(p => p.inv_id !== pet.inv_id));
      setDaycarePets(prev => [...prev, { ...pet, daycare_id: data.id, deposited_at: data.deposited_at }]);
    }
    setProcesando(false);
  };

  const claimFromDaycare = async (daycarePet) => {
    if (procesando) return;
    setProcesando(true);

    const generatedYield = Math.floor(calculateYield(daycarePet.value, daycarePet.deposited_at));
    
    // 1. Remove from daycare
    await supabase.from('daycare').delete().eq('id', daycarePet.daycare_id);
    
    // 2. Return to inventory (DEVOLVIENDO EL SHINY/MYTHIC)
    const { data: newInv, error: insertError } = await supabase.from('inventory').insert({ 
        user_id: user.id, 
        item_id: daycarePet.item_id,
        is_shiny: daycarePet.is_shiny || false,
        is_mythic: daycarePet.is_mythic || false
    }).select().single();
    
    if (insertError) console.error("Error devolviendo al inv:", insertError);
    
    // 3. Add generated Green Coins to Wallet
    const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', user.id).single();
    await supabase.from('profiles').update({ saldo_verde: profile.saldo_verde + generatedYield }).eq('id', user.id);

    setEpicClaimData({
      pet: { ...daycarePet, inv_id: newInv?.id },
      yieldAmount: generatedYield
    });

    setDaycarePets(prev => prev.filter(p => p.daycare_id !== daycarePet.daycare_id));
    setBalances(prev => ({ ...prev, walletGreen: prev.walletGreen + generatedYield }));
    setInventory(prev => [...prev, { ...daycarePet, inv_id: newInv?.id }]);
    
    setProcesando(false);
  };

  const closeEpicLoot = () => setEpicClaimData(null);

  if (cargando) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white font-black tracking-widest animate-pulse">ACCESSING VAULT...</div>;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8 animate-fade-in flex flex-col items-center">
      
      {/* EPIC CLAIM MODAL */}
      {epicClaimData && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in overflow-hidden">
              <div className="absolute top-10 right-10 z-50">
                  <img src="/Affiliates.png" className="w-24 h-24 animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] filter grayscale brightness-200" alt="Backpack" />
              </div>

              <div className="text-[120px] leading-none mb-4 z-10 drop-shadow-[0_0_80px_rgba(34,197,94,0.8)] animate-bounce-slight">✨</div>
              <h2 className="text-5xl md:text-7xl font-black mb-12 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl text-green-400">YIELD CLAIMED!</h2>
              
              <div className="flex flex-col md:flex-row gap-12 items-center justify-center max-w-4xl z-10 mb-16">
                  <div className="animate-fly-to-backpack drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                      <div className="scale-150 pointer-events-none"><PetCard pet={epicClaimData.pet} /></div>
                  </div>
                  <div className="text-7xl font-black text-green-400 flex items-center gap-4 animate-fly-to-backpack drop-shadow-[0_0_40px_rgba(34,197,94,0.8)]" style={{animationDelay: '0.2s'}}>
                      <GreenCoin cls="w-20 h-20"/> +{formatValue(epicClaimData.yieldAmount)}
                  </div>
              </div>

              <button onClick={closeEpicLoot} className="px-16 py-6 bg-white text-black text-2xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:scale-105 z-10 active:scale-95">
                  COLLECT LOOT
              </button>
          </div>
      )}

      <div className="max-w-[1200px] w-full mt-10">
        
        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 mx-auto bg-[#0a0a0a] border-2 border-[#222] rounded-[2rem] flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
            <span className="text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">🏦</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 drop-shadow-lg">
            SECURITY VAULT
          </h1>
          <p className="text-gray-500 font-bold mt-4 tracking-widest uppercase text-sm">Store your wealth. Generate passive income.</p>
        </div>

        {/* MAIN NAVIGATION TABS */}
        <div className="flex justify-center mb-12">
            <div className="flex bg-[#0a0a0a] p-2 rounded-2xl border border-[#222] shadow-2xl">
                <button onClick={() => setView('vault')} className={`px-8 py-4 font-black uppercase tracking-widest rounded-xl transition-all ${view === 'vault' ? 'bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'text-gray-500 hover:text-white'}`}>
                    💰 Coin Vault
                </button>
                <button onClick={() => setView('daycare')} className={`px-8 py-4 font-black uppercase tracking-widest rounded-xl transition-all ${view === 'daycare' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'text-gray-500 hover:text-white'}`}>
                    🐾 Pet Daycare
                </button>
            </div>
        </div>

        {/* ========================================= */}
        {/* VIEW 1: COIN VAULT (GREEN BALANCE ONLY) */}
        {/* ========================================= */}
        {view === 'vault' && (
            <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
              {/* BALANCE SUMMARY */}
              <div className="w-full lg:w-1/3 flex flex-col gap-6">
                <div className="bg-[#0a0a0a] border border-[#222] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-green-500 opacity-10 blur-[60px] group-hover:opacity-20 transition-opacity"></div>
                  <h3 className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] mb-6 border-b border-[#222] pb-4">Green Balance</h3>
                  
                  <div className="mb-6">
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Active Wallet</p>
                    <p className="text-3xl font-black text-white flex items-center gap-3 mt-1"><GreenCoin cls="w-8 h-8"/> {formatValue(balances.walletGreen)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Secured In Vault</p>
                    <p className="text-3xl font-black text-green-400 flex items-center gap-3 mt-1"><GreenCoin cls="w-8 h-8"/> {formatValue(balances.vaultGreen)}</p>
                  </div>
                </div>
              </div>

              {/* TRANSACTION CONTROLS */}
              <div className="w-full lg:w-2/3 bg-[#0a0a0a] border border-[#222] rounded-[2rem] p-8 shadow-2xl flex flex-col justify-between">
                
                <div className="flex bg-[#111] p-1 rounded-2xl mb-8 border border-[#333]">
                  <button onClick={() => setAction('deposit')} className={`flex-1 py-4 text-sm font-black uppercase tracking-[0.2em] rounded-xl transition-all ${action === 'deposit' ? 'bg-[#222] text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>Deposit</button>
                  <button onClick={() => setAction('withdraw')} className={`flex-1 py-4 text-sm font-black uppercase tracking-[0.2em] rounded-xl transition-all ${action === 'withdraw' ? 'bg-[#222] text-white shadow-lg' : 'text-gray-600 hover:text-white'}`}>Withdraw</button>
                </div>

                <div className="mb-8">
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Amount to {action}</p>
                    <p className="text-[10px] text-green-400 font-black uppercase tracking-widest bg-green-900/20 px-3 py-1 rounded-md">Max: {formatValue(getMaxBalance())}</p>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 transition-transform group-focus-within:scale-110">
                      <GreenCoin cls="w-8 h-8"/>
                    </div>
                    <input type="number" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0.00" className="w-full bg-[#111] border-2 border-[#333] focus:border-green-500 rounded-[1.5rem] py-6 pl-16 pr-6 text-3xl font-black text-white outline-none transition-all shadow-inner" />
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => handleQuickAmount('CLEAR')} className="flex-1 bg-[#111] hover:bg-[#222] border border-[#333] text-gray-500 text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all">Clear</button>
                    <button onClick={() => handleQuickAmount('HALF')} className="flex-1 bg-[#111] hover:bg-[#222] border border-[#333] text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all">Half</button>
                    <button onClick={() => handleQuickAmount('MAX')} className="flex-1 bg-[#111] hover:border-green-500 border border-[#333] text-green-400 text-xs font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)]">Max</button>
                  </div>
                </div>

                <button onClick={handleVaultTransaction} disabled={procesando || !amountInput} className={`w-full py-6 rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xl transition-all shadow-xl active:scale-95 ${action === 'deposit' ? 'bg-gradient-to-r from-green-700 to-green-500 hover:opacity-90 text-white shadow-[0_5px_30px_rgba(34,197,94,0.3)]' : 'bg-[#111] hover:bg-[#222] border-2 border-[#333] hover:border-white text-white'} ${(procesando || !amountInput) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                  {procesando ? 'Processing...' : (action === 'deposit' ? 'SECURE FUNDS' : 'WITHDRAW FUNDS')}
                </button>
              </div>
            </div>
        )}

        {/* ========================================= */}
        {/* VIEW 2: PET DAYCARE (YIELD GENERATOR) */}
        {/* ========================================= */}
        {view === 'daycare' && (
            <div className="flex flex-col gap-8 animate-fade-in">
                
                {/* ACTIVE SLOTS SECTION */}
                <div className="bg-[#0a0a0a] border border-[#222] rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-red-600/10 blur-[100px] pointer-events-none"></div>
                    
                    <div className="flex justify-between items-end mb-8 border-b border-[#222] pb-4">
                        <div>
                            <h3 className="text-white text-2xl font-black uppercase tracking-[0.2em]">Active Daycare Slots</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Pets generate +0.5% value per day (25% Base)</p>
                        </div>
                        <div className="text-3xl font-black text-red-500 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                            {daycarePets.length} <span className="text-gray-600">/ 4</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Render active pets */}
                        {daycarePets.map(pet => {
                            const currentYield = calculateYield(pet.value, pet.deposited_at);
                            return (
                                <div key={pet.daycare_id} className="bg-[#111] border border-red-900/50 rounded-2xl p-4 flex flex-col items-center relative overflow-hidden group shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                                    <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-widest z-10 animate-pulse">Generating</div>
                                    
                                    <div className="scale-90 mb-2 pointer-events-none relative z-10"><PetCard pet={pet} /></div>
                                    
                                    <div className="w-full text-center bg-[#050505] rounded-xl py-3 px-2 border border-[#222] mb-4 relative z-10">
                                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Generated Yield</p>
                                        <p className="text-lg font-black text-green-400 flex items-center justify-center gap-1 drop-shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                                            <GreenCoin cls="w-4 h-4"/> +{formatValue(currentYield)}
                                        </p>
                                    </div>

                                    <button onClick={() => claimFromDaycare(pet)} disabled={procesando} className="w-full py-3 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] active:scale-95 disabled:opacity-50 relative z-10">
                                        Claim & Withdraw
                                    </button>
                                </div>
                            );
                        })}

                        {/* Render empty slots */}
                        {Array.from({ length: 4 - daycarePets.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="bg-[#050505] border-2 border-dashed border-[#222] rounded-2xl flex flex-col items-center justify-center min-h-[300px] text-gray-600">
                                <span className="text-5xl mb-4 opacity-20">🐾</span>
                                <p className="text-xs font-black uppercase tracking-widest">Empty Slot</p>
                                <p className="text-[9px] font-bold mt-2 uppercase">Select a pet below</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* INVENTORY TO DEPOSIT */}
                <div className="bg-[#0a0a0a] border border-[#222] rounded-[2rem] p-8 shadow-2xl">
                    <h3 className="text-gray-500 text-xs font-black uppercase tracking-[0.2em] mb-6 border-b border-[#222] pb-4">Your Inventory</h3>
                    
                    {inventory.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-[#222] rounded-3xl text-gray-600">
                            <p className="text-2xl font-black uppercase tracking-widest mb-2">No Pets Found</p>
                            <p className="text-sm font-bold">Open cases or trade to get pets for the Daycare.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-4">
                            {inventory.map(pet => (
                                <div key={pet.inv_id} onClick={() => depositToDaycare(pet)} className={`relative transition-all cursor-pointer hover:-translate-y-2 group ${daycarePets.length >= 4 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <div className="pointer-events-none"><PetCard pet={pet} /></div>
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl backdrop-blur-sm border-2 border-white">
                                        <p className="text-white font-black uppercase tracking-widest text-xs">Send to<br/>Daycare</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-bounce-slight { animation: bounceSlight 2s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceSlight { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

        /* EPIC BACKPACK FLYING ANIMATION */
        @keyframes flyToBackpack {
            0% { transform: scale(0) translateY(100px); opacity: 0; }
            15% { transform: scale(1.2) translateY(0); opacity: 1; }
            60% { transform: scale(1) translateY(0); opacity: 1; }
            100% { transform: scale(0.1) translate(calc(45vw - 100px), calc(-40vh + 100px)); opacity: 0; }
        }
        .animate-fly-to-backpack { animation: flyToBackpack 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}
