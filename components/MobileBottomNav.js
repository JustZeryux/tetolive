"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav({ onOpenChat }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', path: '/', icon: '🏠' },
    { name: 'Games', path: '/cases', icon: '🎲' },
    { name: 'Deposit', path: '#deposit', icon: '💳', isCentral: true },
    { name: 'Wallet', path: '/wallet', icon: '💼' },
    { name: 'Chat', path: '#chat', icon: '💬', action: onOpenChat },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 w-full h-[70px] bg-[#14171f]/90 backdrop-blur-xl border-t border-[#222630] z-[100] flex justify-around items-center px-2 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {navItems.map((item, idx) => {
        const isActive = pathname === item.path;

        if (item.isCentral) {
          return (
            <button key={idx} className="relative -top-5 group" onClick={() => window.dispatchEvent(new CustomEvent('open-cashier'))}>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#22c55e] to-[#16a34a] flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(34,197,94,0.4)] border-4 border-[#0b0e14] group-hover:scale-105 transition-transform">
                💳
              </div>
            </button>
          );
        }

        return item.action ? (
          <button key={idx} onClick={item.action} className="flex flex-col items-center justify-center w-16 h-full text-[#555b82] hover:text-white transition-colors">
            <span className="text-xl mb-1 drop-shadow-md">{item.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
          </button>
        ) : (
          <Link key={idx} href={item.path} className={`flex flex-col items-center justify-center w-16 h-full transition-colors ${isActive ? 'text-[#6C63FF]' : 'text-[#555b82] hover:text-white'}`}>
            <span className={`text-xl mb-1 transition-transform ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(108,99,255,0.8)]' : ''}`}>{item.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
          </Link>
        );
      })}
    </div>
  );
}