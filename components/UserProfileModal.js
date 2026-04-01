"use client";
import { useState } from 'react';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function UserProfileModal({ user, onClose }) {
  const [tipAmount, setTipAmount] = useState('');

  // Si no se pasa un usuario, usamos data falsa de ejemplo
  const profile = user || {
    name: 'steve1290p',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Steve',
    level: 83,
    rank: 'Diamond',
    joined: 'Jan 2026',
    stats: { wagered: 125000000, profit: 4500000, gamesPlayed: 3420 },
    favoriteGame: 'Battles'
  };

  const handleTip = () => {
    if (!tipAmount || isNaN(tipAmount) || tipAmount <= 0) return alert("Enter a valid amount");
    alert(`Successfully tipped ${formatValue(tipAmount)} Green Balance to ${profile.name}!`);
    setTipAmount('');
  };

  return (
    <div className="fixed inset-0 bg-[#0b0e14]/90 flex items-center justify-center z-[200] p-4 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl w-full max-w-md flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-scale-in relative">
        
        {/* Banner Superior */}
        <div className="h-24 bg-gradient-to-r from-[#6C63FF] to-[#a855f7] relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 text-2xl drop-shadow-md z-10">&times;</button>
        </div>

        <div className="px-6 pb-6 relative">
          {/* Avatar Flotante */}
          <div className="flex justify-between items-end -mt-10 mb-4 relative z-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-[#1c1f2e] bg-[#141323] overflow-hidden shadow-lg">
                <img src={profile.avatar} className="w-full h-full object-cover" alt="avatar"/>
              </div>
              <span className="absolute bottom-0 right-0 bg-[#facc15] text-black text-[10px] font-black px-1.5 py-0.5 rounded border-2 border-[#1c1f2e]">
                LVL {profile.level}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[#38bdf8] text-[10px] font-black uppercase tracking-widest border border-[#38bdf8] bg-[#38bdf8]/10 px-2 py-1 rounded">
                {profile.rank} VIP
              </span>
            </div>
          </div>

          {/* Info Básica */}
          <div className="mb-6">
            <h2 className="text-2xl font-black text-white">{profile.name}</h2>
            <p className="text-[#555b82] text-[10px] font-bold uppercase tracking-widest">Joined {profile.joined}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="bg-[#141323] border border-[#252839] p-3 rounded-xl flex flex-col justify-center items-center text-center">
              <span className="text-[#555b82] text-[9px] font-black uppercase tracking-widest mb-1">Total Wagered</span>
              <span className="text-white font-black text-xs flex items-center gap-1"><GreenCoin cls="w-3 h-3"/> {formatValue(profile.stats.wagered)}</span>
            </div>
            <div className="bg-[#141323] border border-[#252839] p-3 rounded-xl flex flex-col justify-center items-center text-center">
              <span className="text-[#555b82] text-[9px] font-black uppercase tracking-widest mb-1">Total Profit</span>
              <span className="text-[#3AFF4E] font-black text-xs flex items-center gap-1"><GreenCoin cls="w-3 h-3"/> +{formatValue(profile.stats.profit)}</span>
            </div>
            <div className="bg-[#141323] border border-[#252839] p-3 rounded-xl flex flex-col justify-center items-center text-center">
              <span className="text-[#555b82] text-[9px] font-black uppercase tracking-widest mb-1">Fav Game</span>
              <span className="text-white font-black text-xs">{profile.favoriteGame}</span>
            </div>
          </div>

          {/* Send Tip Section */}
          <div className="bg-[#0b0e14] border border-[#252839] rounded-xl p-4">
            <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              🎁 Send Tip to {profile.name}
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 bg-[#1c1f2e] border border-[#252839] rounded-lg flex items-center px-3 focus-within:border-[#3AFF4E] transition-colors">
                <GreenCoin cls="w-4 h-4 mr-2"/>
                <input 
                  type="number" 
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Amount..."
                  className="w-full bg-transparent text-white font-bold text-sm outline-none py-2"
                />
              </div>
              <button 
                onClick={handleTip}
                className="bg-[#3AFF4E] hover:bg-[#22c55e] text-black px-6 rounded-lg font-black text-xs uppercase tracking-widest shadow-[0_0_10px_rgba(58,255,78,0.3)] transition-colors"
              >
                Send
              </button>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}} />
    </div>
  );
}