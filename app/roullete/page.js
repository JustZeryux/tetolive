"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString();
};

const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=b91c1c,000000`;

// Sistema de Audio
const playSFX = (type) => {
    try {
        const audio = new Audio(`/sounds/${type}.mp3`);
        audio.volume = 0.7;
        audio.play().catch(() => console.log(`Audio missing: /public/sounds/${type}.mp3`));
    } catch (e) {}
};

// SVG del Revólver Animado
const GunSVG = ({ targetAngle, isShaking, isFiring }) => (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${isShaking ? 'animate-shake-hard' : ''} ${isFiring ? 'scale-125 drop-shadow-[0_0_50px_rgba(220,38,38,1)]' : 'drop-shadow-[0_20px_25px_rgba(0,0,0,0.9)]'}`} style={{ transform: `rotate(${targetAngle}deg)` }}>
        <svg width="180" height="180" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Mango */}
            <path d="M120 280 L120 400 Q120 420 140 420 L180 420 Q200 420 200 400 L200 280 Z" fill="#1a202c" stroke="#0f172a" strokeWidth="8"/>
            <path d="M130 290 L130 390 L190 390 L190 290 Z" fill="#2d3748" />
            {/* Cañón */}
            <path d="M120 280 L200 280 L250 230 L460 230 Q480 230 480 210 L480 170 Q480 150 460 150 L120 150 Z" fill="#4a5568" stroke="#0f172a" strokeWidth="8"/>
            {/* Cilindro */}
            <circle cx="280" cy="190" r="40" fill="#1a202c" stroke="#0f172a" strokeWidth="6"/>
            <circle cx="280" cy="190" r="15" fill="#4a5568" />
            <circle cx="255" cy="190" r="8" fill="#0f172a" />
            <circle cx="305" cy="190" r="8" fill="#0f172a" />
            <circle cx="280" cy="165" r="8" fill="#0f172a" />
            <circle cx="280" cy="215" r="8" fill="#0f172a" />
            {/* Fuego */}
            <path d="M460 170 L480 170" stroke="#f56565" strokeWidth="12" strokeLinecap="round" className={isFiring ? "animate-pulse" : "hidden"}/>
            {isFiring && <circle cx="500" cy="190" r="50" fill="url(#fire)" />}
            <defs>
                <radialGradient id="fire" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="40%" stopColor="#fbd38d" />
                    <stop offset="100%" stopColor="#e53e3e" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    </div>
);

export default function RussianRoulettePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  const [view, setView] = useState('menu'); 
  const [mode, setMode] = useState('bot'); 
  const [betType, setBetType] = useState('coins');
  const [coinBet, setCoinBet] = useState(10);
  
  // LOBBIES & MULTIPLAYER
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]); // Array de jugadores en la mesa
  const channelRef = useRef(null);

  // GAMEPLAY STATE
  const [turnId, setTurnId] = useState(null); 
  const [actionLog, setActionLog] = useState("WAITING...");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // EFECTOS
  const [gunAngle, setGunAngle] = useState(-90); // -90 = Arriba (Mesa), 90 = Abajo (Jugador)
  const [gunShaking, setGunShaking] = useState(false);
  const [gunFiring, setGunFiring] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  // MEMORIA DE BALAS
  const chambersRef = useRef([]);
  const currentChamberRef = useRef(0);
  const [uiChamber, setUiChamber] = useState(0); 

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
      }
    };
    init();
  }, []);

  // --- MODO BOT (1v1) ---
  const startBotMatch = async () => {
      if (userProfile.saldo_verde < coinBet) return alert("Insufficient coins!");
      
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);
      
      const botPlayer = { id: 'bot', name: 'TetoBot', avatar: '/TetoGun.png', isDead: false };
      const mePlayer = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      
      setPlayers([mePlayer, botPlayer]);
      setTurnId(currentUser.id);
      
      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      chambersRef.current = newChambers;
      currentChamberRef.current = 0;
      setUiChamber(0);

      setView('playing');
      setActionLog("YOUR TURN.");
      playSFX('spin');
  };

  const executeBotTurn = async () => {
      setIsProcessing(true);
      setActionLog("TETOBOT IS THINKING...");
      setGunAngle(-90); // Apunta al bot
      await new Promise(r => setTimeout(r, 1500));
      
      const isBullet = chambersRef.current[currentChamberRef.current];
      setActionLog("TETOBOT POINTS AT ITS HEAD...");
      
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog("💥 BANG! TETOBOT DIED! 💥");
          
          setPlayers(prev => prev.map(p => p.id === 'bot' ? {...p, isDead: true} : p));
          setTimeout(() => endGame(currentUser.id, coinBet * 2), 2500);
      } else {
          playSFX('click');
          setActionLog("...CLICK. TETOBOT SURVIVED.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              setTurnId(currentUser.id);
              setIsProcessing(false);
              setActionLog("YOUR TURN.");
          }, 2000);
      }
  };

  useEffect(() => {
      if (mode === 'bot' && view === 'playing' && turnId === 'bot' && !isProcessing) {
          executeBotTurn();
      }
  }, [turnId, view, mode]);

  // --- MODO ONLINE BATTLE ROYALE ---
  const fetchLobbies = async () => {
      const { data } = await supabase.from('roulette_lobbies').select('*').eq('status', 'waiting');
      if (data) setLobbies(data);
  };

  const openLobbies = () => {
      setMode('online');
      fetchLobbies();
      setView('lobbies');
      supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_lobbies' }, fetchLobbies).subscribe();
  };

  const hostOnlineMatch = async () => {
      if (userProfile.saldo_verde < coinBet) return alert("No saldo.");
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };

      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id, host_name: userProfile.username, bet_type: 'coins', bet_amount: coinBet, players: [me]
      }).select().single();

      if (data) {
          setCurrentRoom(data);
          setPlayers([me]);
          connectToRoom(data.id, true);
          setView('lobby_room');
      }
  };

  const joinOnlineMatch = async (lobby) => {
      if (userProfile.saldo_verde < lobby.bet_amount) return alert("No saldo.");
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - lobby.bet_amount }).eq('id', currentUser.id);

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      const updatedPlayers = [...lobby.players, me];

      await supabase.from('roulette_lobbies').update({ players: updatedPlayers }).eq('id', lobby.id);

      setCurrentRoom(lobby);
      setPlayers(updatedPlayers);
      connectToRoom(lobby.id, false);
      setView('lobby_room');
  };

  const connectToRoom = (roomId, isHost) => {
      const channel = supabase.channel(`room_${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'player_joined' }, payload => setPlayers(payload.players));
      
      channel.on('broadcast', { event: 'game_start' }, payload => {
          chambersRef.current = payload.chambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setTurnId(payload.turnId);
          setView('playing');
          playSFX('spin');
          setActionLog(payload.turnId === currentUser.id ? "YOUR TURN." : "MATCH STARTED.");
      });

      channel.on('broadcast', { event: 'shoot_action' }, payload => {
          executeOnlineVisuals(payload.shooterId, payload.targetId, payload.isBullet);
      });

      channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isHost) {
              supabase.channel('lobby_updates').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, (payload) => {
                  setPlayers(payload.new.players);
                  channel.send({ type: 'broadcast', event: 'player_joined', payload: { players: payload.new.players } });
              }).subscribe();
          }
      });
  };

  const startOnlineGameHost = async () => {
      if (players.length < 2) return alert("Need at least 2 players!");
      await supabase.from('roulette_lobbies').update({ status: 'playing' }).eq('id', currentRoom.id);
      
      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      chambersRef.current = newChambers;
      
      const firstTurn = players[0].id;
      setTurnId(firstTurn);
      setView('playing');
      playSFX('spin');
      setActionLog("YOUR TURN.");

      channelRef.current.send({ type: 'broadcast', event: 'game_start', payload: { chambers: newChambers, turnId: firstTurn } });
  };

  // --- CORE GAMEPLAY (DISPARO) ---
  const handleShoot = async (targetId) => {
      if (isProcessing || turnId !== currentUser.id) return;
      setIsProcessing(true);

      const isBullet = chambersRef.current[currentChamberRef.current];

      if (mode === 'online') {
          channelRef.current.send({ type: 'broadcast', event: 'shoot_action', payload: { shooterId: currentUser.id, targetId, isBullet } });
          executeOnlineVisuals(currentUser.id, targetId, isBullet);
      } else {
          // Bot Mode: Solo puedes dispararte a ti mismo o al bot
          setGunAngle(targetId === currentUser.id ? 90 : -90);
          setActionLog(targetId === currentUser.id ? "YOU AIM AT YOURSELF..." : "YOU AIM AT TETOBOT...");
          
          await new Promise(r => setTimeout(r, 1000));
          setGunShaking(true);
          await new Promise(r => setTimeout(r, 1500));
          setGunShaking(false);

          if (isBullet) {
              playSFX('bang');
              setGunFiring(true);
              setScreenFlash(true);
              setActionLog("💥 BANG! 💥");
              
              if (targetId === currentUser.id) {
                  setPlayers(prev => prev.map(p => p.id === currentUser.id ? {...p, isDead: true} : p));
                  setTimeout(() => endGame('bot', 0), 2000);
              } else {
                  setPlayers(prev => prev.map(p => p.id === 'bot' ? {...p, isDead: true} : p));
                  setTimeout(() => endGame(currentUser.id, coinBet * 2), 2000);
              }
          } else {
              playSFX('click');
              setActionLog("...CLICK. NOTHING HAPPENED.");
              setTimeout(() => {
                  currentChamberRef.current += 1;
                  setUiChamber(currentChamberRef.current);
                  setTurnId('bot');
                  setIsProcessing(false);
              }, 1500);
          }
      }
  };

  const executeOnlineVisuals = async (shooterId, targetId, isBullet) => {
      const shooterName = players.find(p => p.id === shooterId)?.name;
      const targetName = players.find(p => p.id === targetId)?.name;
      const shootingSelf = shooterId === targetId;

      // Cálculo de ángulo básico: Si soy yo, apunto a mi (90), sino a la mesa (-90 o rotación).
      if (targetId === currentUser.id) setGunAngle(90);
      else if (shooterId === currentUser.id && targetId !== currentUser.id) setGunAngle(-90);
      else setGunAngle(-90);

      setActionLog(shootingSelf ? `${shooterName} AIMS AT THEMSELVES...` : `${shooterName} AIMS AT ${targetName}...`);
      
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog(`💥 BANG! ${targetName} IS DEAD! 💥`);
          
          // Actualizar estado de muerte
          setPlayers(prev => {
              const newPlayers = prev.map(p => p.id === targetId ? {...p, isDead: true} : p);
              checkOnlineWinCondition(newPlayers);
              return newPlayers;
          });
      } else {
          playSFX('click');
          setActionLog("...CLICK.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              
              // Pasar turno al siguiente VIVO
              let nextIdx = players.findIndex(p => p.id === shooterId) + 1;
              while (nextIdx < players.length * 2) {
                  const checkPlayer = players[nextIdx % players.length];
                  if (!checkPlayer.isDead) {
                      setTurnId(checkPlayer.id);
                      setActionLog(checkPlayer.id === currentUser.id ? "YOUR TURN." : `${checkPlayer.name}'S TURN.`);
                      break;
                  }
                  nextIdx++;
              }
              setIsProcessing(false);
          }, 2000);
      }
  };

  const checkOnlineWinCondition = async (currentPlayers) => {
      const alivePlayers = currentPlayers.filter(p => !p.isDead);
      if (alivePlayers.length === 1) {
          const winner = alivePlayers[0];
          setTimeout(() => endGame(winner.id, currentRoom.bet_amount * currentPlayers.length), 3000);
      } else {
          // Si muere el actual, hay que recargar recámara y pasar turno.
          // Para simplificar: solo pasamos turno, el cilindro avanza.
          setTimeout(() => {
               setGunFiring(false);
               setScreenFlash(false);
               let nextIdx = currentPlayers.findIndex(p => p.isDead) + 1;
               while (nextIdx < currentPlayers.length * 2) {
                  const checkPlayer = currentPlayers[nextIdx % currentPlayers.length];
                  if (!checkPlayer.isDead) {
                      setTurnId(checkPlayer.id);
                      setActionLog(checkPlayer.id === currentUser.id ? "YOUR TURN." : `${checkPlayer.name}'S TURN.`);
                      break;
                  }
                  nextIdx++;
              }
              setIsProcessing(false);
          }, 3000);
      }
  };

  const endGame = async (winnerId, prize) => {
      if (winnerId === currentUser.id) {
          playSFX('win');
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + prize }).eq('id', currentUser.id);
          setActionLog(`🏆 YOU WON ${formatValue(prize)} COINS! 🏆`);
      } else {
          const winnerName = players.find(p => p.id === winnerId)?.name || 'SOMEONE';
          setActionLog(`💀 YOU DIED. ${winnerName} WINS. 💀`);
      }
      
      if (currentRoom && currentRoom.host_id === currentUser.id) {
          await supabase.from('roulette_lobbies').update({ status: 'finished' }).eq('id', currentRoom.id);
      }
      if(channelRef.current) supabase.removeChannel(channelRef.current);
      
      setTimeout(() => setView('result'), 1500);
      setGunFiring(false);
      setScreenFlash(false);
      setIsProcessing(false);
  };

  // --- RENDERIZADOS CONDICIONALES (VISTAS) ---
  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8 font-sans overflow-hidden transition-colors duration-100 ${screenFlash ? 'bg-red-900' : ''}`}>
      
      {view === 'playing' && <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-[#050505] to-[#050505] pointer-events-none z-0"></div>}
      {screenFlash && <div className="fixed inset-0 bg-red-600/60 z-50 animate-flash pointer-events-none"></div>}

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* MENU */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-900 drop-shadow-[0_0_30px_rgba(220,38,38,0.4)]">ROULETTE</h1>
                <p className="text-gray-400 mb-16 tracking-[0.5em] uppercase font-bold border-b border-red-900/50 pb-4">High Stakes Battle Royale</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
                    <button onClick={() => { setMode('bot'); setView('betting'); }} className="group relative bg-[#0a0a0a] border border-[#222] p-10 rounded-3xl overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                        <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-6xl block mb-6 drop-shadow-lg">🤖</span>
                        <h3 className="text-2xl font-black uppercase tracking-widest text-white">Local Duel</h3>
                        <p className="text-gray-500 text-sm mt-2">1v1 against TetoBot</p>
                    </button>
                    <button onClick={openLobbies} className="group relative bg-[#0a0a0a] border border-[#222] p-10 rounded-3xl overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(37,99,235,0.2)]">
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-6xl block mb-6 drop-shadow-lg">🌐</span>
                        <h3 className="text-2xl font-black uppercase tracking-widest text-white">Multiplayer</h3>
                        <p className="text-gray-500 text-sm mt-2">Battle Royale up to 6 players</p>
                    </button>
                </div>
            </div>
        )}

        {/* LOBBIES (LISTA) */}
        {view === 'lobbies' && (
            <div className="animate-fade-in max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-10 bg-[#0a0a0a] p-6 rounded-3xl border border-[#222]">
                    <button onClick={() => setView('menu')} className="text-gray-500 hover:text-white font-bold tracking-widest uppercase text-sm">← Back</button>
                    <h2 className="text-2xl font-black uppercase tracking-widest text-blue-500 drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]">Online Arenas</h2>
                    <button onClick={() => setView('betting')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all">Host Arena</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {lobbies.length === 0 ? (
                        <div className="col-span-full text-center text-gray-600 py-32 font-black uppercase tracking-widest text-2xl border-2 border-dashed border-[#222] rounded-3xl">
                            No active arenas.
                        </div>
                    ) : lobbies.map(l => (
                        <div key={l.id} className="relative bg-[#111]/80 backdrop-blur-md border border-[#333] p-6 rounded-3xl flex flex-col justify-between hover:border-blue-500/50 transition-colors group overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-600/20 text-blue-400 font-black text-[10px] px-4 py-1 rounded-bl-xl uppercase tracking-widest">In Lobby</div>
                            <div className="flex items-center gap-4 mb-6 mt-2">
                                <img src={getAvatar(null, l.host_name)} className="w-16 h-16 rounded-full border-2 border-[#444] group-hover:border-blue-500 transition-colors" />
                                <div>
                                    <p className="font-black text-xl tracking-wider text-white">{l.host_name}'s Table</p>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">{l.players?.length || 1} / 6 Players</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-[#222] pt-4">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Entry Fee</p>
                                    <p className="font-black text-2xl text-green-400 flex items-center gap-2"><GreenCoin cls="w-6 h-6"/> {formatValue(l.bet_amount)}</p>
                                </div>
                                <button onClick={() => joinOnlineMatch(l)} disabled={l.players?.length >= 6} className="bg-white text-black hover:bg-blue-500 hover:text-white px-8 py-3 rounded-xl font-black uppercase transition-all disabled:opacity-20">Join</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* SETUP APUESTA */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-lg mx-auto py-20">
                <div className="bg-[#0a0a0a] rounded-[2rem] p-10 border border-[#222] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-blue-600"></div>
                    <button onClick={() => setView(mode === 'online' ? 'lobbies' : 'menu')} className="text-gray-500 hover:text-white font-bold text-sm mb-8 uppercase tracking-widest">← Go Back</button>
                    
                    <h2 className="text-3xl font-black uppercase tracking-widest mb-10 text-center">Set your Bet</h2>

                    <div className="bg-[#111] p-6 rounded-2xl border border-[#333] flex items-center justify-between mb-10 focus-within:border-white transition-colors">
                        <span className="text-gray-500 font-black mr-4 uppercase text-sm">Amount</span>
                        <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-4xl font-black outline-none w-full text-right text-white" />
                        <span className="ml-4"><GreenCoin cls="w-8 h-8"/></span>
                    </div>

                    <button onClick={mode === 'online' ? hostOnlineMatch : startBotMatch} className={`w-full py-5 text-white font-black text-xl uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${mode === 'online' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_5px_20px_rgba(37,99,235,0.4)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_5px_20px_rgba(220,38,38,0.4)]'}`}>
                        {mode === 'online' ? 'Create Arena' : 'Start Duel'}
                    </button>
                </div>
            </div>
        )}

        {/* LOBBY ROOM (Sala de espera Host) */}
        {view === 'lobby_room' && (
            <div className="animate-fade-in max-w-4xl mx-auto py-10">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-black uppercase tracking-widest text-blue-500 mb-2">Waiting Area</h2>
                    <p className="text-gray-400 font-bold tracking-widest uppercase">Entry: <GreenCoin/> {formatValue(currentRoom?.bet_amount)} | Pot: <GreenCoin/> {formatValue(currentRoom?.bet_amount * players.length)}</p>
                </div>

                <div className="bg-[#0a0a0a] rounded-[3rem] p-10 border border-[#222] min-h-[400px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    {/* Grid de jugadores */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 relative z-10">
                        {players.map((p, i) => (
                            <div key={i} className="flex flex-col items-center p-4 bg-[#111] rounded-3xl border border-[#333]">
                                <img src={p.avatar} className="w-20 h-20 rounded-full border-2 border-white/20 mb-4" />
                                <span className="font-black uppercase tracking-widest text-sm text-white">{p.name}</span>
                                {p.id === currentRoom?.host_id && <span className="text-[9px] text-blue-400 font-black uppercase mt-1">Host</span>}
                            </div>
                        ))}
                        {/* Slots vacíos */}
                        {Array.from({ length: 6 - players.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-dashed border-[#222] opacity-50">
                                <div className="w-20 h-20 rounded-full bg-[#111] mb-4 flex items-center justify-center text-3xl">👤</div>
                                <span className="font-black uppercase tracking-widest text-[10px] text-gray-500">Waiting...</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-10 relative z-10 flex justify-center">
                        {currentRoom?.host_id === currentUser.id ? (
                            <button onClick={startOnlineGameHost} disabled={players.length < 2} className="bg-white text-black px-16 py-5 rounded-full font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                                Start Match ({players.length}/6)
                            </button>
                        ) : (
                            <p className="text-blue-500 font-black uppercase tracking-widest animate-pulse">Waiting for Host to start...</p>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- LA MESA DE JUEGO (GAMEPLAY EPIC) --- */}
        {view === 'playing' && (
            <div className="flex flex-col items-center justify-center min-h-[75vh] relative py-10">
                
                {/* LA MESA (Fondo ovalado) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[800px] h-[60vh] max-h-[500px] bg-[#1a0f0f] border-8 border-[#2a1717] rounded-[50%] shadow-[inset_0_0_100px_rgba(0,0,0,1),0_0_50px_rgba(0,0,0,0.8)] z-0 pointer-events-none">
                    <div className="absolute inset-4 rounded-[50%] border border-red-900/30"></div>
                </div>

                {/* Texto de Acción central */}
                <div className="absolute top-10 w-full text-center z-20 pointer-events-none">
                    <p className={`text-3xl md:text-5xl font-black italic transition-all duration-300 uppercase tracking-widest ${actionLog.includes('BANG') ? 'text-red-600 scale-125 drop-shadow-[0_0_30px_rgba(220,38,38,1)]' : 'text-white drop-shadow-[0_5px_10px_rgba(0,0,0,1)]'}`}>
                        {actionLog}
                    </p>
                </div>

                {/* Jugadores Oponentes (Arriba y a los lados) */}
                <div className="flex justify-center gap-4 md:gap-16 relative z-10 w-full mb-auto mt-16 px-4">
                    {players.filter(p => p.id !== currentUser.id).map((p, idx) => (
                        <div key={p.id} className={`flex flex-col items-center transition-all duration-500 ${turnId === p.id ? 'scale-110 -translate-y-4' : 'opacity-60 scale-90'} ${p.isDead ? 'grayscale opacity-20' : ''}`}>
                            <div className={`w-20 h-20 md:w-28 md:h-28 rounded-full border-4 p-1 bg-[#0a0a0a] relative shadow-2xl ${turnId === p.id && !p.isDead ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.8)]' : 'border-[#333]'}`}>
                                <img src={p.avatar} className="w-full h-full object-cover rounded-full" />
                                {p.isDead && <div className="absolute inset-0 flex items-center justify-center text-4xl bg-black/60 rounded-full">💀</div>}
                                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#111] text-white font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest border border-[#333] whitespace-nowrap">{p.name}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* El Arma en el Centro */}
                <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center my-8 z-20">
                    <GunSVG targetAngle={gunAngle} isShaking={gunShaking} isFiring={gunFiring} />
                    
                    {/* UI del Cilindro flotando abajo del arma */}
                    <div className="absolute -bottom-10 flex gap-2">
                        {[0, 1, 2, 3, 4, 5].map(idx => (
                            <div key={idx} className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${idx === uiChamber ? 'border-red-500 bg-red-500 shadow-[0_0_10px_rgba(220,38,38,1)] scale-150' : idx < uiChamber ? 'border-[#333] bg-[#111] opacity-50' : 'border-gray-500 bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>

                {/* El Jugador Local (Abajo) */}
                <div className={`relative z-10 w-full max-w-xl mt-auto pt-10 flex flex-col items-center transition-all duration-500 ${turnId === currentUser.id ? 'scale-105' : 'opacity-80'}`}>
                    
                    {/* Botones de Disparo */}
                    <div className="flex w-full justify-between items-end px-4 gap-4 md:gap-10">
                        <button 
                            disabled={isProcessing || turnId !== currentUser.id || players.find(p=>p.id===currentUser.id)?.isDead} 
                            onClick={() => handleShoot(currentUser.id)}
                            className="flex-1 bg-white hover:bg-gray-200 text-black py-4 md:py-5 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-10 disabled:cursor-not-allowed shadow-xl text-xs md:text-base active:scale-95"
                        >
                            Shoot Self
                        </button>
                        
                        {/* Avatar del Jugador */}
                        <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full border-4 p-1 bg-[#0a0a0a] relative shadow-2xl shrink-0 ${turnId === currentUser.id ? 'border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.8)]' : 'border-[#333]'}`}>
                            <img src={getAvatar(userProfile?.avatar_url, userProfile?.username)} className="w-full h-full object-cover rounded-full" />
                            {players.find(p=>p.id===currentUser.id)?.isDead && <div className="absolute inset-0 flex items-center justify-center text-6xl bg-black/80 rounded-full">💀</div>}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-xs px-6 py-1 rounded-full uppercase tracking-widest border border-black">YOU</div>
                        </div>

                        <button 
                            disabled={isProcessing || turnId !== currentUser.id || players.find(p=>p.id===currentUser.id)?.isDead || (mode==='bot' ? false : true)} // Temporal: Shoot Foe deshabilitado en Battle Royale para evitar elegir objetivos, solo dispara al self
                            onClick={() => handleShoot('bot')}
                            className="flex-1 bg-[#222] text-gray-500 py-4 md:py-5 rounded-2xl font-black uppercase tracking-widest disabled:opacity-10 shadow-xl text-xs md:text-base relative group"
                        >
                            <span className="opacity-30">Shoot Foe</span>
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] bg-black px-2 py-1 rounded border border-[#333] hidden group-hover:block w-max text-red-500">Only Self-Shoot in Royale Mode</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- PANTALLA DE RESULTADOS --- */}
        {view === 'result' && (
            <div className="flex flex-col items-center justify-center py-32 animate-fade-in relative z-20">
                <div className="absolute inset-0 bg-black/80 blur-3xl rounded-full z-0 pointer-events-none"></div>
                <div className="text-[150px] leading-none mb-4 z-10 drop-shadow-[0_0_40px_rgba(255,0,0,0.5)]">{actionLog.includes('WON') ? '🏆' : '💀'}</div>
                <h2 className={`text-4xl md:text-6xl font-black mb-12 text-center z-10 uppercase tracking-widest drop-shadow-2xl px-4 ${actionLog.includes('WON') ? 'text-yellow-400' : 'text-red-600'}`}>{actionLog}</h2>
                <button onClick={() => { setView('menu'); setCurrentRoom(null); setPlayers([]); }} className="px-16 py-6 bg-white text-black text-xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_50px_rgba(255,255,255,0.4)] hover:scale-105 z-10">
                    RETURN TO LOBBY
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-shake-hard { animation: shakeHard 0.2s ease-in-out infinite; }
        .animate-flash { animation: flash 0.4s ease-out forwards; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shakeHard {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-4px, 4px) rotate(-3deg); }
            50% { transform: translate(4px, -4px) rotate(3deg); }
            75% { transform: translate(-4px, -4px) rotate(-2deg); }
        }
        @keyframes flash {
            0% { opacity: 1; background-color: rgba(220,38,38,0.9); }
            100% { opacity: 0; background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
