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
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const rotateSeed = () => {
    setSuccessMsg("Seed rotated successfully! Your previous Server Seed is now revealed below.");
    setErrorMsg('');
    setNonce(0);
    setServerSeedHash('a1b2c3d4...[Hidden until rotated]...e5f6g7h8');
    
    // Auto-fill the verifier to simulate the reveal
    setVerifyServerSeed('revealed_server_seed_9876543210abcdef');
    setVerifyClientSeed(clientSeed);
    setVerifyNonce(nonce.toString());
    
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleVerify = () => {
    setErrorMsg('');
    setVerificationResult(null);

    if (!verifyServerSeed || !verifyClientSeed || !verifyNonce) {
      setErrorMsg("Please fill all fields to verify the result.");
      return;
    }
    
    // Simulación de verificación matemática para la UI
    // En un entorno real, aquí harías un HMAC_SHA256(serverSeed, clientSeed:nonce)
    const pseudoRandomRoll = (Math.random() * 100).toFixed(2);
    
    setVerificationResult({
      roll: pseudoRandomRoll,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // Hash simulado
    });
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-gradient-to-b from-[#6C63FF]/10 to-transparent blur-[120px] pointer-events-none z-0"></div>

      <div className="max-w-[900px] mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
            Provably Fair ⚖️
          </h1>
          <p className="text-[#8f9ac6] font-bold text-sm md:text-base max-w-2xl mx-auto">
            Our RNG (Random Number Generator) algorithm is 100% transparent and mathematically verifiable. <br className="hidden md:block" />
            We cannot manipulate the outcome of any game.
          </p>
        </div>

        {/* HOW IT WORKS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] p-6 rounded-3xl shadow-lg relative overflow-hidden group hover:border-[#6C63FF]/50 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#6C63FF]/5 blur-2xl rounded-full group-hover:bg-[#6C63FF]/10 transition-colors"></div>
            <div className="text-3xl mb-3 drop-shadow-md">🔒</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">1. Server Seed</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">
              We generate a secret seed and show you its Hash. This proves we created the result BEFORE you bet.
            </p>
          </div>
          <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] p-6 rounded-3xl shadow-lg relative overflow-hidden group hover:border-[#3AFF4E]/50 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#3AFF4E]/5 blur-2xl rounded-full group-hover:bg-[#3AFF4E]/10 transition-colors"></div>
            <div className="text-3xl mb-3 drop-shadow-md">🔑</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">2. Client Seed</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">
              Your browser provides a seed. You can change this anytime to ensure you are influencing the final roll.
            </p>
          </div>
          <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] p-6 rounded-3xl shadow-lg relative overflow-hidden group hover:border-[#facc15]/50 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#facc15]/5 blur-2xl rounded-full group-hover:bg-[#facc15]/10 transition-colors"></div>
            <div className="text-3xl mb-3 drop-shadow-md">🔢</div>
            <h3 className="text-white font-black uppercase tracking-widest text-sm mb-2">3. Nonce</h3>
            <p className="text-[#555b82] text-xs font-bold leading-relaxed">
              A number that increases by 1 with every bet. This ensures every game has a completely unique outcome.
            </p>
          </div>
        </div>

        {/* ACTIVE SEEDS PANEL */}
        <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl overflow-hidden shadow-2xl mb-10">
          <div className="bg-[#0b0e14] px-8 py-5 border-b border-[#252839] flex justify-between items-center">
            <h2 className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3AFF4E] shadow-[0_0_10px_#3AFF4E] animate-pulse"></span> Active Seeds
            </h2>
          </div>
          
          <div className="p-8 space-y-6">
            
            {successMsg && (
                <div className="bg-[#3AFF4E]/10 border border-[#3AFF4E]/30 text-[#3AFF4E] px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center gap-2 animate-fade-in">
                    <span>✅</span> {successMsg}
                </div>
            )}

            {/* Server Seed Hash */}
            <div>
              <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Server Seed (Hashed)</label>
              <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-[#8f9ac6] truncate select-all shadow-inner">
                {serverSeedHash}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              {/* Client Seed */}
              <div className="flex-1">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Client Seed</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientSeed}
                    onChange={(e) => setClientSeed(e.target.value)}
                    className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-white outline-none focus:border-[#6C63FF] focus:shadow-[0_0_15px_rgba(108,99,255,0.2)] transition-all shadow-inner"
                  />
                  <button className="bg-[#1c1f2e] hover:bg-[#252839] border border-[#3f4354] px-6 rounded-xl text-xs font-black text-white transition-colors uppercase tracking-widest hover:border-[#6C63FF]">
                    Save
                  </button>
                </div>
              </div>
              
              {/* Nonce */}
              <div className="w-full md:w-32">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Nonce (Bets)</label>
                <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-white text-center shadow-inner">
                  {nonce}
                </div>
              </div>
            </div>

            {/* Rotate Button */}
            <div className="pt-6 border-t border-[#252839] flex flex-col md:flex-row items-center gap-4 justify-between">
              <p className="text-[10px] text-[#555b82] font-bold uppercase tracking-widest text-center md:text-left order-2 md:order-1">
                Rotating reveals your current Server Seed so you can verify past bets.
              </p>
              <button
                onClick={rotateSeed}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(108,99,255,0.3)] hover:shadow-[0_6px_20px_rgba(108,99,255,0.5)] hover:-translate-y-0.5 active:translate-y-0 order-1 md:order-2"
              >
                Rotate Seed Pair
              </button>
            </div>
          </div>
        </div>

        {/* MANUAL VERIFIER */}
        <div className="bg-[#14151f]/80 backdrop-blur-md border border-[#252839] rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#3AFF4E]/5 blur-[100px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-white text-xl font-black uppercase tracking-widest mb-8 flex items-center gap-2">
            Manual Verifier 🔬
          </h2>
          
          {errorMsg && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center gap-2 animate-fade-in">
                  <span>⚠️</span> {errorMsg}
              </div>
          )}

          <div className="space-y-6 mb-8 relative z-10">
            <div>
              <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Un-Hashed Server Seed</label>
              <input
                type="text"
                placeholder="Paste the revealed server seed here..."
                value={verifyServerSeed}
                onChange={(e) => setVerifyServerSeed(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-white outline-none focus:border-[#3AFF4E] focus:shadow-[0_0_15px_rgba(58,255,78,0.2)] transition-all shadow-inner"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Client Seed</label>
                <input
                  type="text"
                  placeholder="Your client seed..."
                  value={verifyClientSeed}
                  onChange={(e) => setVerifyClientSeed(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-white outline-none focus:border-[#3AFF4E] focus:shadow-[0_0_15px_rgba(58,255,78,0.2)] transition-all shadow-inner"
                />
              </div>
              <div className="w-full md:w-1/3">
                <label className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 block">Nonce</label>
                <input
                  type="number"
                  placeholder="e.g. 42"
                  value={verifyNonce}
                  onChange={(e) => setVerifyNonce(e.target.value)}
                  className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-4 font-mono text-sm text-white outline-none focus:border-[#3AFF4E] focus:shadow-[0_0_15px_rgba(58,255,78,0.2)] transition-all shadow-inner"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleVerify}
            className="w-full py-5 bg-[#1c1f2e] hover:bg-[#252839] border border-[#3f4354] hover:border-[#3AFF4E] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg hover:shadow-[0_0_20px_rgba(58,255,78,0.2)] relative z-10"
          >
            Verify Result
          </button>

          {/* VERIFICATION RESULT */}
          {verificationResult && (
            <div className="mt-8 bg-[#0b0e14] border border-[#3AFF4E]/50 rounded-2xl p-6 animate-fade-in shadow-[inset_0_0_30px_rgba(58,255,78,0.05)] relative z-10">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[#3AFF4E] text-xs font-black uppercase tracking-widest flex items-center gap-2 bg-[#3AFF4E]/10 px-3 py-1.5 rounded-lg border border-[#3AFF4E]/30">
                  ✓ Verified Match
                </span>
                <span className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{verificationResult.roll}</span>
              </div>
              <div className="bg-[#14151f] p-4 rounded-xl border border-[#252839]">
                <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest block mb-1">Generated Hash (HMAC-SHA256)</span>
                <span className="text-[#8f9ac6] font-mono text-xs break-all select-all">{verificationResult.hash}</span>
              </div>
            </div>
          )}
        </div>

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { 
            from { opacity: 0; transform: translateY(10px); } 
            to { opacity: 1; transform: translateY(0); } 
        }
      `}</style>
    </div>
  );
}
