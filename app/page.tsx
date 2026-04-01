"use client";
import Link from 'next/link';
import LiveDrops from '../components/LiveDrops'; 

export default function Home() {
  // Reemplazamos los iconos por tu imagen de Teto, pero le damos un color de aura a cada juego
  const games = [
    { 
      name: 'BATTLES', 
      desc: 'Fight For All', 
      path: '/battles', 
      img: '/Battles.png', // <-- Tu imagen
      auraColor: '#a855f7' // Morado
    },
    { 
      name: 'CASES', 
      desc: 'Unbox Pets', 
      path: '/cases', 
      img: '/Cases.png', // <-- Tu imagen
      auraColor: '#fb923c' // Naranja
    },
    { 
      name: 'COINFLIP', 
      desc: 'Flip a Coin', 
      path: '/coinflip', 
      img: '/Coinflip.png', // <-- Tu imagen
      auraColor: '#facc15' // Amarillo/Dorado
    },
    { 
      name: 'MINES', 
      desc: 'Avoid Mines', 
      path: '/mines', 
      img: '/Mines.png', // <-- Tu imagen
      auraColor: '#ec4899' // Rosa
    },
    { 
      name: 'JACKPOT', 
      desc: 'Take a Chance', 
      path: '/jackpot', 
      img: '/Jackpot.png', // <-- Tu imagen
      auraColor: '#ef4444' // Rojo
    },
  ];

  return (
    <div className="min-h-full flex flex-col animate-fade-in bg-[#0b0e14]">
      
      <LiveDrops />

      <div className="flex-1 p-4 md:p-8 max-w-[1400px] mx-auto w-full space-y-8">
        
        {/* ==========================================
            BANNER PRINCIPAL (Estilo Morado Épico)
        ========================================== */}
        <div className="w-full bg-gradient-to-r from-[#5b21b6] via-[#4c1d95] to-[#3b0764] rounded-2xl p-8 md:p-10 relative overflow-hidden shadow-[0_10px_40px_rgba(91,33,182,0.4)] border border-[#7c3aed]/30">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
          <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-[#a855f7] rounded-full blur-[80px] opacity-40 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-wider mb-2 drop-shadow-lg">
                FREE CODES, EVENTS, PRIZES & GIVEAWAYS
              </h1>
              <p className="text-[#c4b5fd] font-bold text-sm md:text-base mb-6">
                Join The Community And Don't Miss Them!
              </p>
              <button className="bg-[#6d28d9] hover:bg-[#7c3aed] border border-[#8b5cf6] text-white font-black px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all hover:scale-105">
                Join Discord!
              </button>
            </div>

<div className="hidden md:block opacity-80 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">
              <img 
                src="/favicon.ico" 
                alt="Teto!live Mascot" 
                className="w-32 h-32 md:w-40 md:h-40 object-contain hover:scale-110 transition-transform duration-300" 
              />
            </div>
          </div>
        </div>

        {/* ==========================================
            TARJETAS DE JUEGOS (NUEVO DISEÑO CON TETO)
        ========================================== */}
        <div>
          <h2 className="text-white text-sm font-bold mb-6 flex items-center gap-2">
            <span className="font-black text-lg">Games</span> <span className="text-[#555b82]">- Pick your favorite and dive in</span>
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {games.map((game, idx) => (
              <Link key={idx} href={game.path} className="block group">
                <div className="relative h-64 md:h-72 rounded-2xl bg-gradient-to-b from-[#2e1065] to-[#170535] p-5 flex flex-col items-center justify-end overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.8)] border border-[#4c1d95] hover:border-[#7c3aed]">
                  
                  {/* Aura brillante circular detrás de Teto */}
                  <div 
                    className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-[40px] opacity-30 group-hover:opacity-60 transition-opacity duration-500" 
                    style={{ backgroundColor: game.auraColor }}
                  ></div>

                  {/* Sombra oscura en la parte de abajo */}
                  <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-[#0b0e14]/90 to-transparent z-10 pointer-events-none"></div>

                  {/* IMAGEN DE TETO */}
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 z-20 group-hover:scale-110 group-hover:-translate-y-4 transition-transform duration-500 ease-out">
                    <img 
                      src={game.img} 
                      alt={game.name} 
                      className="w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)]"
                      style={{ filter: `drop-shadow(0 0 15px ${game.auraColor}60)` }}
                    />
                  </div>

                  {/* Textos */}
                  <div className="relative z-30 flex flex-col items-center w-full mt-auto translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                    
                    <div className="flex items-center gap-1.5 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs drop-shadow-[0_0_8px_#fff]">🔥</span>
                      <span className="text-[#e2e8f0] text-[10px] font-black tracking-widest uppercase">Teto!live</span>
                    </div>
                    
                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest mb-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {game.name}
                    </h3>
                    
                    <p className="text-[#a78bfa] text-[10px] md:text-xs font-bold uppercase tracking-widest">
                      {game.desc}
                    </p>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>

      {/* ==========================================
          FOOTER GLOBAL (Ajustado)
      ========================================== */}
      <footer className="bg-[#14171f] border-t border-[#222630] mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <img src="/teto.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-2xl font-black text-white tracking-widest">Teto!live</span>
              </Link>
              <p className="text-[#555b82] text-xs font-bold max-w-sm leading-relaxed">
                The most advanced gaming platform. Play responsibly. This site is not affiliated with, endorsed, or sponsored by Roblox Corporation.
              </p>
            </div>

            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-sm mb-4">Platform</h4>
              <ul className="space-y-2">
                <li><Link href="/provably-fair" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Provably Fair</Link></li>
                <li><Link href="/affiliates" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Affiliates</Link></li>
                <li><Link href="/leaderboard" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Leaderboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-black uppercase tracking-widest text-sm mb-4">Support</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-[#8f9ac6] hover:text-white text-xs font-bold transition-colors">Contact Us</a></li>
              </ul>
            </div>

          </div>
          
          <div className="border-t border-[#222630] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[#555b82] text-xs font-bold">© 2026 Teto!live. All rights reserved.</p>
            <div className="flex items-center gap-4 text-2xl grayscale opacity-50">
              <span title="18+" className="font-black border-2 border-current rounded-full px-2 text-sm flex items-center justify-center">18+</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}