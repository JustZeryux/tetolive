"use client";
import { useState } from 'react';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    sfx: true,
    anonymous: false,
    hideChat: false,
  });
  const [tradeUrl, setTradeUrl] = useState('https://roblox.com/users/...');

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="fixed inset-0 bg-[#0b0e14]/90 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl w-full max-w-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#252839] flex justify-between items-center bg-[#141323]">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button onClick={onClose} className="text-[#555b82] hover:text-white text-2xl transition-colors">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Roblox Trade URL */}
          <div>
            <label className="text-[#8f9ac6] text-xs font-black uppercase tracking-widest mb-2 block">Roblox Trade URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={tradeUrl}
                onChange={(e) => setTradeUrl(e.target.value)}
                className="w-full bg-[#0b0e14] border border-[#252839] rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-[#6C63FF] transition-colors"
              />
              <button className="bg-[#2a2e44] hover:bg-[#6C63FF] text-white px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-lg">Save</button>
            </div>
            <p className="text-[#555b82] text-[10px] font-bold mt-1">Needed to deposit and withdraw items via our bots.</p>
          </div>

          <div className="w-full h-px bg-[#252839]"></div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Toggle 1 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e14] border border-[#252839] hover:border-[#3f4354] transition-colors">
              <div>
                <h4 className="text-white font-black text-sm uppercase tracking-widest">Sound Effects</h4>
                <p className="text-[#555b82] text-xs font-bold">Play sounds on wins, drops, and chat.</p>
              </div>
              <button onClick={() => toggle('sfx')} className={`w-12 h-6 rounded-full p-1 transition-colors relative shadow-inner ${settings.sfx ? 'bg-[#3AFF4E]' : 'bg-[#2a2e44]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${settings.sfx ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* Toggle 2 */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0b0e14] border border-[#252839] hover:border-[#3f4354] transition-colors">
              <div>
                <h4 className="text-white font-black text-sm uppercase tracking-widest text-[#ef4444]">Anonymous Mode</h4>
                <p className="text-[#555b82] text-xs font-bold">Hide your username and avatar from the Live Feed.</p>
              </div>
              <button onClick={() => toggle('anonymous')} className={`w-12 h-6 rounded-full p-1 transition-colors relative shadow-inner ${settings.anonymous ? 'bg-[#ef4444]' : 'bg-[#2a2e44]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${settings.anonymous ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}