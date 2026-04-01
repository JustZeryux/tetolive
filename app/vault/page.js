"use client";
import { useState } from 'react';

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function VaultPage() {
  // Estados simulados (esto lo conectarás a tu base de datos)
  const [balances, setBalances] = useState({
    wallet: { green: 15500000, red: 25000000 },
    vault: { green: 5000000, red: 0 }
  });

  const [currency, setCurrency] = useState('green'); // 'green' | 'red'
  const [action, setAction] = useState('deposit'); // 'deposit' | 'withdraw'
  const [amountInput, setAmountInput] = useState('');

  // Helpers para obtener el balance máximo dependiendo de la acción y moneda
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

  const handleTransaction = () => {
    const val = parseInt(amountInput);
    if (isNaN(val) || val <= 0) return alert("Enter a valid amount!");
    if (val > getMaxBalance()) return alert("Insufficient balance!");

    // Simular transacción
    setBalances(prev => {
      const newBalances = { ...prev };
      if (action === 'deposit') {
        newBalances.wallet[currency] -= val;
        newBalances.vault[currency] += val;
      } else {
        newBalances.vault[currency] -= val;
        newBalances.wallet[currency] += val;
      }
      return newBalances;
    });
    
    setAmountInput('');
    // Aquí puedes agregar un toast/alerta visual bonita
  };

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

          {/* PANEL DERECHO: ACCIONES (DEPOSIT / WITHDRAW) */}
          <div className="w-full md:w-2/3 bg-[#141323] border border-[#252839] rounded-2xl p-6 md:p-8 shadow-xl">
            
            {/* TABS DE ACCIÓN */}
            <div className="flex bg-[#0b0e14] p-1 rounded-xl mb-6 border border-[#252839]">
              <button 
                onClick={() => setAction('deposit')}
                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${action === 'deposit' ? 'bg-[#2a2e44] text-white shadow-sm' : 'text-[#555b82] hover:text-white'}`}
              >
                Deposit
              </button>
              <button 
                onClick={() => setAction('withdraw')}
                className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${action === 'withdraw' ? 'bg-[#2a2e44] text-white shadow-sm' : 'text-[#555b82] hover:text-white'}`}
              >
                Withdraw
              </button>
            </div>

            {/* SELECCIÓN DE MONEDA */}
            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3">Select Currency</h3>
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setCurrency('green')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${currency === 'green' ? 'bg-[#22c55e]/10 border-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-[#1c1f2e] border-[#252839] hover:border-[#3f4354]'}`}
              >
                <GreenCoin cls="w-8 h-8"/>
                <span className={`font-black uppercase tracking-widest text-xs ${currency === 'green' ? 'text-[#22c55e]' : 'text-[#8f9ac6]'}`}>Green</span>
              </button>
              <button 
                onClick={() => setCurrency('red')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${currency === 'red' ? 'bg-[#ef4444]/10 border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'bg-[#1c1f2e] border-[#252839] hover:border-[#3f4354]'}`}
              >
                <RedCoin cls="w-8 h-8"/>
                <span className={`font-black uppercase tracking-widest text-xs ${currency === 'red' ? 'text-[#ef4444]' : 'text-[#8f9ac6]'}`}>Red</span>
              </button>
            </div>

            {/* INPUT DE MONTO */}
            <div className="flex justify-between items-end mb-2">
              <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Amount</h3>
              <p className="text-[10px] font-bold text-[#555b82] uppercase tracking-widest flex items-center gap-1">
                Available: {currency === 'green' ? <GreenCoin cls="w-3 h-3"/> : <RedCoin cls="w-3 h-3"/>} {formatValue(getMaxBalance())}
              </p>
            </div>
            
            <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-2 flex items-center mb-8 focus-within:border-[#6C63FF] transition-colors">
              <div className="pl-3 pr-2">
                {currency === 'green' ? <GreenCoin cls="w-5 h-5"/> : <RedCoin cls="w-5 h-5"/>}
              </div>
              <input 
                type="number" 
                placeholder="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full bg-transparent text-white font-black text-lg outline-none placeholder-[#252839]"
              />
              <div className="flex gap-1 pr-1">
                <button onClick={() => handleQuickAmount('CLEAR')} className="px-3 py-1.5 bg-[#1c1f2e] hover:bg-[#252839] text-[#8f9ac6] rounded text-[10px] font-black transition-colors">CLR</button>
                <button onClick={() => handleQuickAmount('HALF')} className="px-3 py-1.5 bg-[#1c1f2e] hover:bg-[#252839] text-[#8f9ac6] rounded text-[10px] font-black transition-colors">1/2</button>
                <button onClick={() => handleQuickAmount('MAX')} className="px-3 py-1.5 bg-[#1c1f2e] hover:bg-[#252839] text-white rounded text-[10px] font-black transition-colors">MAX</button>
              </div>
            </div>

            {/* BOTÓN DE ACCIÓN */}
            <button 
              onClick={handleTransaction}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:-translate-y-1 shadow-lg border ${
                action === 'deposit' 
                  ? 'bg-[linear-gradient(135deg,#6C63FF_0%,#5147D9_100%)] border-[#5E55D9]/40 text-white hover:shadow-[0_6px_20px_rgba(108,99,255,0.4)]' 
                  : 'bg-transparent border-[#6C63FF] text-[#6C63FF] hover:bg-[#6C63FF]/10'
              }`}
            >
              {action === 'deposit' ? 'Deposit to Vault' : 'Withdraw to Wallet'}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}