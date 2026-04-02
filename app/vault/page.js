"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function VaultPage() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Estados reales desde la Base de Datos
  const [balances, setBalances] = useState({
    wallet: { green: 0, red: 0 },
    vault: { green: 0, red: 0 }
  });

  const [currency, setCurrency] = useState('green'); // 'green' | 'red'
  const [action, setAction] = useState('deposit'); // 'deposit' | 'withdraw'
  const [amountInput, setAmountInput] = useState('');

  // 1. Cargar datos del usuario y sus saldos
  const fetchBalances = async () => {
    setCargando(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUser(user);
      const { data, error } = await supabase
        .from('profiles')
        .select('saldo_verde, saldo_rojo, vault_verde, vault_rojo')
        .eq('id', user.id)
        .single();

      if (data) {
        setBalances({
          wallet: { green: data.saldo_verde || 0, red: data.saldo_rojo || 0 },
          vault: { green: data.vault_verde || 0, red: data.vault_rojo || 0 }
        });
      }
    }
    setCargando(false);
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const getMaxBalance = () => {
    if (action === 'deposit') return balances.wallet[currency];
    return balances.vault[currency];
  };

  const handleQuickAmount = (multiplier) => {
    const max = getMaxBalance();
    if (multiplier === 'MAX') setAmountInput(max.toString());
    else if (multiplier === 'HALF') setAmountInput(Math.floor(max / 2).toString());
    else if (multiplier === 'CLEAR') setAmountInput('');
  };

  // 2. Procesar Transacción en la Base de Datos
  const handleTransaction = async () => {
    if (procesando) return;
    const val = parseInt(amountInput);
    if (isNaN(val) || val <= 0) return alert("Enter a valid amount!");
    if (val > getMaxBalance()) return alert("Insufficient balance!");

    setProcesando(true);

    // Calcular nuevos saldos
    let newWallet = balances.wallet[currency];
    let newVault = balances.vault[currency];

    if (action === 'deposit') {
      newWallet -= val;
      newVault += val;
    } else {
      newVault -= val;
      newWallet += val;
    }

    // Preparar el objeto de actualización dependiendo de la moneda
    const updates = {};
    if (currency === 'green') {
      updates.saldo_verde = newWallet;
      updates.vault_verde = newVault;
    } else {
      updates.saldo_rojo = newWallet;
      updates.vault_rojo = newVault;
    }

    // Actualizar en Supabase
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      alert("Error procesando la transacción.");
      console.error(error);
    } else {
      alert(`¡${action === 'deposit' ? 'Depósito' : 'Retiro'} de ${formatValue(val)} exitoso!`);
      // Registrar en el log de transacciones
      await supabase.from('transactions_log').insert({
        user_id: user.id,
        tipo: action === 'deposit' ? 'vault_deposit' : 'vault_withdraw',
        monto: val,
        moneda: currency
      });
      // Recargar saldos actualizados
      fetchBalances();
      setAmountInput('');
    }
    setProcesando(false);
  };

  if (cargando) return <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center text-white">Loading vault...</div>;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in flex items-center justify-center">
      <div className="max-w-[800px] w-full">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-[#1c1f2e] border border-[#252839] rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(108,99,255,0.2)]">
            <span className="text-4xl">🏦</span>
          </div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6]">
            Security Vault
          </h1>
          <p className="text-[#8f9ac6] font-bold mt-2">Stash your profits safely. Funds in the vault cannot be wagered.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          
          {/* PANEL IZQUIERDO: RESUMEN DE BALANCES */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
            
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e] opacity-5 blur-[50px]"></div>
              <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Green Balance</h3>
              
              <div className="mb-4">
                <p className="text-[10px] text-[#555b82] font-black uppercase">Wallet</p>
                <p className="text-xl font-black text-white flex items-center gap-2"><GreenCoin/> {formatValue(balances.wallet.green)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#555b82] font-black uppercase">In Vault</p>
                <p className="text-xl font-black text-[#22c55e] flex items-center gap-2"><GreenCoin/> {formatValue(balances.vault.green)}</p>
              </div>
            </div>

            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#ef4444] opacity-5 blur-[50px]"></div>
              <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Red Value</h3>
              
              <div className="mb-4">
                <p className="text-[10px] text-[#555b82] font-black uppercase">Wallet</p>
                <p className="text-xl font-black text-white flex items-center gap-2"><RedCoin/> {formatValue(balances.wallet.red)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#555b82] font-black uppercase">In Vault</p>
                <p className="text-xl font-black text-[#ef4444] flex items-center gap-2"><RedCoin/> {formatValue(balances.vault.red)}</p>
              </div>
            </div>

          </div>

          {/* PANEL DERECHO: CONTROLES DE TRANSACCIÓN */}
          <div className="w-full md:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-lg">
            
            {/* TABS (Deposit / Withdraw) */}
            <div className="flex bg-[#0b0e14] p-1 rounded-xl mb-6">
              <button 
                onClick={() => setAction('deposit')}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg transition-all ${action === 'deposit' ? 'bg-[#252839] text-white shadow-md' : 'text-[#555b82] hover:text-[#8f9ac6]'}`}
              >
                Deposit
              </button>
              <button 
                onClick={() => setAction('withdraw')}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg transition-all ${action === 'withdraw' ? 'bg-[#252839] text-white shadow-md' : 'text-[#555b82] hover:text-[#8f9ac6]'}`}
              >
                Withdraw
              </button>
            </div>

            {/* CURRENCY SELECTOR */}
            <div className="mb-6">
              <p className="text-[10px] text-[#8f9ac6] font-black uppercase tracking-widest mb-2">Select Currency</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setCurrency('green')}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 rounded-xl border-2 transition-all ${currency === 'green' ? 'border-[#22c55e] bg-[#22c55e]/10' : 'border-[#252839] bg-[#0b0e14] hover:border-[#3f4354]'}`}
                >
                  <GreenCoin cls="w-6 h-6"/> <span className="font-bold">Green</span>
                </button>
                <button 
                  onClick={() => setCurrency('red')}
                  className={`flex-1 py-4 flex items-center justify-center gap-2 rounded-xl border-2 transition-all ${currency === 'red' ? 'border-[#ef4444] bg-[#ef4444]/10' : 'border-[#252839] bg-[#0b0e14] hover:border-[#3f4354]'}`}
                >
                  <RedCoin cls="w-6 h-6"/> <span className="font-bold">Red</span>
                </button>
              </div>
            </div>

            {/* AMOUNT INPUT */}
            <div className="mb-6">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] text-[#8f9ac6] font-black uppercase tracking-widest">Amount</p>
                <p className="text-[10px] text-[#555b82] font-black uppercase">Max: {formatValue(getMaxBalance())}</p>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  {currency === 'green' ? <GreenCoin/> : <RedCoin/>}
                </div>
                <input 
                  type="number" 
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0b0e14] border-2 border-[#252839] focus:border-[#6C63FF] rounded-xl py-4 pl-12 pr-4 text-xl font-bold text-white outline-none transition-all"
                />
              </div>
              
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleQuickAmount('CLEAR')} className="flex-1 bg-[#252839] hover:bg-[#3f4354] text-[#8f9ac6] text-xs font-black uppercase py-2 rounded-lg transition-colors">Clear</button>
                <button onClick={() => handleQuickAmount('HALF')} className="flex-1 bg-[#252839] hover:bg-[#3f4354] text-white text-xs font-black uppercase py-2 rounded-lg transition-colors">1/2</button>
                <button onClick={() => handleQuickAmount('MAX')} className="flex-1 bg-[#252839] hover:bg-[#3f4354] text-white text-xs font-black uppercase py-2 rounded-lg transition-colors">Max</button>
              </div>
            </div>

            {/* ACTION BUTTON */}
            <button 
              onClick={handleTransaction}
              disabled={procesando || !amountInput}
              className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-lg transition-all shadow-lg flex items-center justify-center gap-2
                ${action === 'deposit' 
                  ? 'bg-gradient-to-r from-[#6C63FF] to-[#8a84ff] hover:opacity-90 text-white shadow-[#6C63FF]/20' 
                  : 'bg-gradient-to-r from-[#1c1f2e] to-[#252839] hover:bg-[#2a2e44] border border-[#3f4354] text-white'
                }
                ${(procesando || !amountInput) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {procesando ? 'Processing...' : (action === 'deposit' ? 'Deposit to Vault' : 'Withdraw to Wallet')}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
