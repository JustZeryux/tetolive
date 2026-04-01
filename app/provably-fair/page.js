"use client";
import { useState } from 'react';

export default function ProvablyFairPage() {
  // Estados para la semilla actual del usuario
  const [clientSeed, setClientSeed] = useState('MyCustomSeed_123');
  const [nonce, setNonce] = useState(42);
  const [serverSeedHash, setServerSeedHash] = useState('b89e7c5b...[Hidden until rotated]...3f1a2b4c');

  // Estados para el Verificador Manual
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('');
  const [verifyNonce, setVerifyNonce] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  const rotateSeed = () => {
    alert("Seed rotated successfully! Your previous Server Seed is now revealed in your history.");
    setNonce(0);
    setServerSeedHash('a1b2c3d4...[Hidden until rotated]...e5f6g7h8');
  };

  const handleVerify = () => {
    if (!verifyServerSeed || !verifyClientSeed || !verifyNonce) {
      return alert("Please fill all fields to verify.");
    }
    // Simulación de verificación matemática para el UI
    setVerificationResult({
      roll: (Math.random() * 100).toFixed(2),
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in">
      <div className="max-w-[900px] mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] mb-2">
            Provably Fair ⚖️
          </h1>
          <p className="text-[#8f9ac6] font-bold">
            Our RNG algorithm is 100% transparent and mathematically verifiable. <br className="hidden md:block" />
            We cannot manipulate the outcome of any game.
          </p>
        </div>

        {/* CÓMO FUNCIONA (Explicación visual) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#1c1f2e] border border-[#252839] p-5 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-1">1. Server Seed</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">We generate a secret seed and show you its Hash. This proves we created the result BEFORE you bet.</p>
          </div>
          <div className="bg-[#1c1f2e] border border-[#252839] p-5 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="text-2xl mb-2">🔑</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-1">2. Client Seed</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">Your browser provides a seed. You can change this anytime to ensure you are influencing the final roll.</p>
          </div>
          <div className="bg-[#1c1f2e] border border-[#252839] p-5 rounded-2xl shadow-lg relative overflow-hidden">
            <div className="text-2xl mb-2">🔢</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-1">3. Nonce</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">A number that increases by 1 with every bet. This ensures every game has a completely unique outcome.</p>
          </div>
        </div>

        {/* ACTIVE SEEDS PANEL */}
        <div className="bg-[#141323] border border-[#252839] rounded-2xl overflow-hidden shadow-xl mb-10">
          <div className="bg-[#1c1f2e] px-6 py-4 border-b border-[#252839] flex justify-between items-center">
            <h2 className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3AFF4E] shadow-[0_0_8px_#3AFF4E] animate-pulse"></span> Active Seeds
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            
            {/* Server Seed Hash */}
            <div>
              <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Server Seed (Hashed)</label>
              <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-sm text-[#8f9ac6] truncate select-all">
                {serverSeedHash}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Client Seed */}
              <div className="flex-1">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Client Seed</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={clientSeed}
                    onChange={(e) => setClientSeed(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-sm text-white outline-none focus:border-[#6C63FF] transition-colors"
                  />
                  <button className="bg-[#2a2e44] hover:bg-[#3f4354] border border-[#3f4354] px-4 rounded-xl text-xs font-black text-white transition-colors uppercase tracking-widest">
                    Save
                  </button>
                </div>
              </div>

              {/* Nonce */}
              <div className="w-full md:w-32">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Nonce (Bets)</label>
                <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-sm text-white text-center">
                  {nonce}
                </div>
              </div>
            </div>

            {/* Rotate Button */}
            <div className="pt-4 border-t border-[#252839]">
              <button 
                onClick={rotateSeed}
                className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(108,99,255,0.3)] hover:shadow-[0_6px_20px_rgba(108,99,255,0.5)] hover:-translate-y-0.5"
              >
                Rotate Seed Pair
              </button>
              <p className="text-[10px] text-[#555b82] font-bold mt-2">Rotating will reveal your current Server Seed so you can verify past bets.</p>
            </div>

          </div>
        </div>

        {/* VERIFICADOR MANUAL */}
        <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
          <h2 className="text-white text-lg font-black uppercase tracking-widest mb-6">Manual Verifier 🔬</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Un-Hashed Server Seed</label>
              <input 
                type="text" 
                placeholder="Paste the revealed server seed here..."
                value={verifyServerSeed}
                onChange={(e) => setVerifyServerSeed(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-xs text-white outline-none focus:border-[#3AFF4E] transition-colors"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Client Seed</label>
                <input 
                  type="text" 
                  placeholder="Your client seed..."
                  value={verifyClientSeed}
                  onChange={(e) => setVerifyClientSeed(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-xs text-white outline-none focus:border-[#3AFF4E] transition-colors"
                />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-1 block">Nonce</label>
                <input 
                  type="number" 
                  placeholder="e.g. 42"
                  value={verifyNonce}
                  onChange={(e) => setVerifyNonce(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-3 font-mono text-xs text-white outline-none focus:border-[#3AFF4E] transition-colors"
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleVerify}
            className="w-full py-4 bg-[#2a2e44] hover:bg-[#3f4354] border border-[#3f4354] hover:border-[#3AFF4E] text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            Verify Result
          </button>

          {/* RESULTADO DE LA VERIFICACIÓN */}
          {verificationResult && (
            <div className="mt-6 bg-[#0b0e14] border border-[#3AFF4E]/50 rounded-xl p-5 animate-fade-in shadow-[inset_0_0_20px_rgba(58,255,78,0.05)]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[#3AFF4E] text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  ✓ Verified Match
                </span>
                <span className="text-3xl font-black text-white">{verificationResult.roll}</span>
              </div>
              <div>
                <span className="text-[#555b82] text-[9px] font-black uppercase tracking-widest block mb-1">Generated Hash</span>
                <span className="text-[#8f9ac6] font-mono text-[10px] break-all select-all">{verificationResult.hash}</span>
              </div>
            </div>
          )}

        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}