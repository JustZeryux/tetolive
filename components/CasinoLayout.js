"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/utils/Supabase'; // Conexión a DB
import LoginButton from './LoginButton'; 

// Importa las bellezas que creamos
import EpicToasts from '@/components/EpicToasts';
import SettingsModal from '@/components/SettingsModal';
import MobileBottomNav from '@/components/MobileBottomNav';

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

const menuSections = [
  {
    title: "Games",
    links: [
      { name: 'Battles', path: '/battles', iconImg: '/Battles.png' },
      { name: 'Cases', path: '/cases', iconImg: '/Cases.png' },
      { name: 'Coinflip', path: '/coinflip', iconImg: '/Coinflip.png' },
      { name: 'Mines', path: '/mines', iconImg: '/Mines.png' },
      { name: 'Jackpot', path: '/jackpot', iconImg: '/Jackpot.png' },
      { name: 'Blackjack', path: '/blackjack', iconImg: '/Coinflip.png' }, // <-- AQUÍ ESTÁ EL NUEVO MINIJUEGO WEY (Cámbiale el icono si tienes uno de cartas)
    ]
  },
  {
    title: "Economy",
    links: [
      { name: 'Wallet', path: '/wallet', iconImg: '/Wallet.png' },
      { name: 'Vault', path: '/vault', iconImg: '/Vault.png' },
      { name: 'Rewards', path: '/rewards', iconImg: '/Rewards.png' },
    ]
  },
  {
    title: "Community",
    links: [
      { name: 'My Profile', path: '/profile', iconImg: '/Affiliates.png' }, 
      { name: 'Leaderboard', path: '/leaderboard', iconImg: '/Leaderboard.png' },
      { name: 'Affiliates', path: '/affiliates', iconImg: '/Affiliates.png' },
      { name: 'Provably Fair', path: '/provably-fair', iconImg: '/ProvablyFair.png' },
    ]
  }
];

export default function CasinoLayout({ children }) {
  const pathname = usePathname();
  
  // ESTADOS UI
  const [chatAbierto, setChatAbierto] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [cajeroAbierto, setCajeroAbierto] = useState(false);
  const [settingsAbierto, setSettingsAbierto] = useState(false); 

  // ESTADOS DATOS REALES (Supabase)
  const [currentUser, setCurrentUser] = useState(null);
  const [saldoVerde, setSaldoVerde] = useState(0);
  const [saldoRojo, setSaldoRojo] = useState(0);
  
  // ESTADOS DEL CHAT
  const [chatMessages, setChatMessages] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Ref para Auto-scroll
  const chatEndRef = useRef(null);

  useEffect(() => {
    let channel; 
    let chatChannel;

    const initData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      let tempUser = null;

      if (authData?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (profile) {
          tempUser = { 
            id: authData.user.id, 
            username: profile.username || 'Player', 
            avatar: profile.avatar_url || '/default-avatar.png',
            level: profile.level || 1,
            theme: profile.theme || 'green'
          };
          setSaldoVerde(profile.saldo_verde || 0);
          setSaldoRojo(profile.saldo_rojo || 0);
        }

        channel = supabase.channel('perfil_updates_layout')
          .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles', 
            filter: `id=eq.${authData.user.id}` 
          }, (payload) => {
            setSaldoVerde(payload.new.saldo_verde);
            setSaldoRojo(payload.new.saldo_rojo);
            setCurrentUser(prevUser => ({
              ...prevUser,
              level: payload.new.level || prevUser?.level || 1,
              theme: payload.new.theme || prevUser?.theme || 'green'
            }));
          }).subscribe();

      } else {
        // Fallback simulado
        let tempId = localStorage.getItem('temp_user_id');
        if (!tempId) { tempId = crypto.randomUUID(); localStorage.setItem('temp_user_id', tempId); }
        tempUser = { id: tempId, username: 'Guest_' + tempId.substring(0,4), avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + tempId, level: 1, theme: 'purple' };
        setSaldoVerde(5000000); 
        setSaldoRojo(200000);
      }
      
      setCurrentUser(tempUser);

      // Cargar historial de chat inicial
      const { data: chatData } = await supabase.from('chat_mensajes').select('*').order('creado_en', { ascending: false }).limit(50);
      if (chatData) {
          setChatMessages(chatData.reverse());
      }
    };

    initData();

    // Suscripción al Chat Público
    chatChannel = supabase.channel('public_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, (payload) => {
        setChatMessages(prev => [...prev, payload.new]);
      }).subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (chatChannel) supabase.removeChannel(chatChannel);
    };
  }, []);

  // Auto-scroll del chat
  useEffect(() => {
      if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, chatAbierto]);

  const enviarMensaje = async (e) => {
    e.preventDefault();
    if (!nuevoMensaje.trim() || enviando || !currentUser) return;
    
    setEnviando(true);
    
    const { error } = await supabase.from('chat_mensajes').insert([{
      user_id: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      level: currentUser.level || 1,
      theme: currentUser.theme || 'green',
      texto: nuevoMensaje.trim()
    }]);

    if (!error) {
      setNuevoMensaje("");
    } else {
      console.error("Error enviando mensaje:", error);
    }
    setEnviando(false);
  };

  const getLevelStyle = (theme) => {
    switch(theme) {
      case 'green': return 'text-[#34d399] border-[#34d399] bg-gradient-to-tr from-[#34d399]/20 to-[#34d399]/10';
      case 'purple': return 'text-[#c084fc] border-[#c084fc] bg-gradient-to-tr from-[#c084fc]/20 to-[#c084fc]/10';
      case 'pink': return 'text-[#f472b6] border-[#f472b6] bg-gradient-to-tr from-[#f472b6]/20 to-[#f472b6]/10';
      case 'orange': return 'text-[#fb923c] border-[#fb923c] bg-gradient-to-tr from-[#fb923c]/20 to-[#fb923c]/10';
      default: return 'text-gray-400 border-gray-400 bg-gray-800';
    }
  };

  const formatearHora = (timestamp) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-screen bg-[#0b0e14] text-white overflow-hidden font-sans">
      
      {/* SIDEBAR IZQUIERDA */}
      <aside 
        className={`fixed top-0 left-0 h-full bg-[#14171f] border-r border-[#222630] flex flex-col z-50 transition-all duration-300 overflow-hidden group 
        ${menuMovilAbierto ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0 md:w-[70px] md:hover:w-[240px]'}`}
      >
        <div className="h-[80px] flex items-center px-4 border-b border-[#222630] shrink-0">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img src="/favicon.ico" alt="Teto Logo" className="w-8 h-8 md:w-9 md:h-9 object-contain drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]" />
            </div>
            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#f472b6] to-[#fb7185] tracking-widest opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">
              TETO!LIVE
            </span>
          </Link>
          <button onClick={() => setMenuMovilAbierto(false)} className="md:hidden ml-auto text-[#7c8291] text-2xl">&times;</button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-6 custom-scrollbar overflow-x-hidden">
          {menuSections.map((section, idx) => (
            <div key={idx}>
              <p className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 px-4 opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.links.map((link) => {
                  const isActive = pathname === link.path;
                  return (
                    <Link 
                      key={link.name} 
                      href={link.path} 
                      onClick={() => setMenuMovilAbierto(false)}
                      className={`flex items-center px-4 py-2 mx-2 rounded-xl transition-all duration-300 font-bold text-sm overflow-hidden ${
                        isActive ? 'bg-[#222630] text-white shadow-inner border border-[#f472b6]/50' : 'text-[#8f9ac6] hover:bg-[#1a1e29] hover:text-white group-hover:text-white'
                      }`}
                    >
                      <span className="w-8 h-8 shrink-0 flex items-center justify-center">
                        <img src={link.iconImg} className={`w-full h-full object-contain transition-all duration-300 ${isActive ? 'drop-shadow-[0_0_8px_rgba(244,114,182,0.8)] scale-110' : 'opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100'}`} alt="icon" />
                      </span> 
                      <span className="ml-3 opacity-0 md:group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {link.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className={`flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 md:ml-[70px] ${chatAbierto ? 'xl:mr-[320px]' : 'xl:mr-[70px]'}`}>
        
        <header className="h-[70px] md:h-[80px] bg-[#14171f]/95 backdrop-blur-md border-b border-[#222630] flex items-center justify-between px-3 md:px-8 z-40 shrink-0 shadow-sm">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setMenuMovilAbierto(true)} className="md:hidden text-[#7c8291] hover:text-white text-2xl px-1">☰</button>
          </div>

          <div className="flex items-center gap-2 md:gap-5">
            <div className="hidden sm:flex bg-[#0b0e14] border border-[#222630] rounded-xl p-1.5 shadow-inner">
              <div className="px-4 py-1.5 flex items-center gap-2 border-r border-[#222630] hover:bg-[#14171f] transition-colors cursor-pointer rounded-l-lg" title="Green Balance">
                <GreenCoin cls="w-4 h-4 floating"/> <span className="text-[#22c55e] font-black text-sm">{formatValue(saldoVerde)}</span>
              </div>
              <div className="px-4 py-1.5 flex items-center gap-2 hover:bg-[#14171f] transition-colors cursor-pointer rounded-r-lg" title="Red Balance">
                <RedCoin cls="w-4 h-4 floating"/> <span className="text-[#ef4444] font-black text-sm">{formatValue(saldoRojo)}</span>
              </div>
            </div>

            {/* Ocultamos el botón de depósito en celulares porque ya está en el menú de abajo */}
            <button onClick={() => setCajeroAbierto(true)} className="hidden md:block animate-shine bg-gradient-to-r from-[#22c55e] to-[#16a34a] hover:from-[#4ade80] hover:to-[#22c55e] text-[#0b0e14] font-black px-6 py-2.5 rounded-lg text-xs tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:-translate-y-0.5">
              DEPOSIT
            </button>

            <div className="flex items-center gap-2 md:gap-3 pl-1 md:pl-4 border-l border-[#222630]">
              <LoginButton />
            </div>

            <button onClick={() => setSettingsAbierto(true)} className="p-2 text-[#7c8291] hover:text-white hover:bg-[#1a1e29] transition-colors rounded-lg hidden sm:block" title="Settings">
              ⚙️
            </button>

            {/* En celular el chat se abre con el menú de abajo, así que lo ocultamos del header superior para ahorrar espacio */}
            <button onClick={() => setChatAbierto(!chatAbierto)} className={`hidden sm:block p-2 transition-colors rounded-lg ${chatAbierto ? 'text-white bg-[#222630]' : 'text-[#7c8291] hover:text-white hover:bg-[#1a1e29]'}`}>
              💬
            </button>
          </div>
        </header>

        {/* Agregamos pb-[80px] en celulares para que el MobileBottomNav no tape el contenido de hasta abajo */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative pb-[80px] md:pb-0">
          {children}
        </main>
      </div>

      {/* SIDEBAR DERECHA (CHAT) */}
      <aside 
        className={`fixed top-0 right-0 h-full bg-[#171925] border-l border-[#222630] flex flex-col z-[60] xl:z-40 transition-all duration-300 overflow-hidden 
        ${chatAbierto ? 'translate-x-0 w-full sm:w-[320px] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] xl:shadow-none' : 'translate-x-full xl:translate-x-0 xl:w-[70px]'}`}
      >
        {!chatAbierto && (
          <div className="hidden xl:flex flex-col items-center py-6 gap-4 overflow-y-auto custom-scrollbar h-full w-[70px]">
            <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest mb-2 border-b border-[#252839] pb-2 w-full text-center">Live</span>
            {chatMessages.slice(-15).reverse().map((msg, i) => (
              <div key={i} className="relative group cursor-pointer" title={msg.username}>
                <div className="w-10 h-10 rounded-full border-2 border-[#22283F] group-hover:border-[#6C63FF] bg-[#1C1F2E] overflow-hidden transition-colors">
                  <img src={msg.avatar} alt="user" className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#3AFF4E] border-2 border-[#171925] rounded-full"></div>
              </div>
            ))}
          </div>
        )}

        {chatAbierto && (
          <div className="flex flex-col h-full w-full sm:w-[320px]">
            <div className="p-4 shrink-0 bg-[#171925] pt-safe-top">
              <div className="bg-[#1c1f2e] border border-[#252839] rounded-xl overflow-hidden relative shadow-lg">
                <div className="p-3 flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#2a2e44] p-2 rounded-lg"><GreenCoin cls="w-6 h-6 animate-pulse"/></div>
                    <div className="flex flex-col">
                      <span className="text-[#3AFF4E] font-black text-lg leading-tight">15,500</span>
                      <span className="text-[#8f9ac6] text-[10px] font-bold uppercase tracking-widest">Rain Pool</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="bg-gradient-to-r from-[#6C63FF] to-[#5147D9] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-[0_2px_8px_rgba(108,99,255,0.25)]">
                      08:39
                    </button>
                    {/* Botón para cerrar el chat en celular */}
                    <button onClick={() => setChatAbierto(false)} className="xl:hidden ml-1 p-1 text-[#7c8291] hover:text-white bg-[#14171f] rounded-lg">
                      &times;
                    </button>
                  </div>
                </div>
                <div className="h-1 w-full bg-[#141323] absolute bottom-0 left-0">
                  <div className="h-full bg-[#6C63FF] w-[75%] shadow-[0_0_10px_#6C63FF]"></div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3 custom-scrollbar flex flex-col">
              {chatMessages.length === 0 && <p className="text-center text-[#555b82] text-xs">No messages yet. Say hi!</p>}
              
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="group flex gap-3 px-3 py-2 bg-[#1c1f2e] border border-transparent hover:border-[#252839] rounded-xl transition-colors animate-fade-in">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full border-[3px] border-[#22283F] bg-[#1C1F2E] overflow-hidden cursor-pointer">
                      <img src={msg.avatar} className="w-full h-full object-cover" alt="avatar"/>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`inline-flex items-center justify-center text-[9px] font-black border-l-2 rounded-[4px] px-1.5 py-[1px] ${getLevelStyle(msg.theme)}`}>
                        {msg.level}
                      </span>
                      <span className="text-xs font-bold text-white truncate">{msg.username}</span>
                      <span className="ml-auto text-[10px] font-medium text-[#555b82] shrink-0">{formatearHora(msg.creado_en)}</span>
                    </div>
                    <p className="text-[13px] font-medium leading-snug text-[#9793ba] break-words">
                      {msg.texto}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 pt-2 shrink-0 bg-[#171925] pb-safe-bottom">
              <form onSubmit={enviarMensaje} className="relative bg-[#141323] border border-[#252839] rounded-xl flex items-center p-1 focus-within:border-[#6C63FF] transition-colors shadow-inner">
                <input 
                  type="text" 
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  placeholder="Say something..." 
                  disabled={enviando || !currentUser}
                  className="w-full bg-transparent pl-3 pr-2 py-2.5 text-sm text-white outline-none placeholder-[#555b82] disabled:opacity-50" 
                />
                <button 
                  type="submit" 
                  disabled={enviando || !nuevoMensaje.trim() || !currentUser}
                  className="p-2 text-[#555b82] hover:text-[#6C63FF] transition-colors cursor-pointer rounded-lg hover:bg-[#2a2e44] mr-1 disabled:opacity-50 disabled:cursor-default"
                >
                  🚀
                </button>
              </form>
              <div className="flex justify-between items-center mt-3 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#3AFF4E] shadow-[0_0_8px_#3AFF4E] animate-pulse"></span>
                  <span className="text-xs font-bold text-[#8f9ac6]">Live Chat</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* MODALES Y TOASTS */}
      {cajeroAbierto && (
        <div className="fixed inset-0 bg-[#0b0e14]/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#14171f] border border-[#222630] rounded-2xl w-full max-w-lg p-6 flex flex-col items-center">
             <h2 className="text-xl font-black mb-4">Deposit / Withdraw</h2>
             <p className="text-gray-400 mb-6 text-center">Cajero en desarrollo.</p>
             <button onClick={() => setCajeroAbierto(false)} className="bg-[#ef4444] px-6 py-2 rounded-lg font-black text-white">Cerrar</button>
          </div>
        </div>
      )}

      {settingsAbierto && <SettingsModal onClose={() => setSettingsAbierto(false)} />}
      <EpicToasts />
      <MobileBottomNav onOpenChat={() => setChatAbierto(!chatAbierto)} />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f4354; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .floating { animation: float 2.5s ease-in-out infinite; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
      `}} />
    </div>
  );
}
