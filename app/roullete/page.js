"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';

// --- COMPONENTES VISUALES ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=b91c1c,000000`;

// SVG del Revólver Animado
const GunSVG = ({ targetAngle, isShaking, isFiring, isSpinningCylinder }) => (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${isShaking ? 'animate-shake-hard' : ''} ${isFiring ? 'scale-125 drop-shadow-[0_0_50px_rgba(220,38,38,1)]' : 'drop-shadow-[0_25px_30px_rgba(0,0,0,0.9)]'}`} style={{ transform: `rotate(${targetAngle}deg)` }}>
        <svg width="220" height="220" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M120 280 L120 400 Q120 420 140 420 L180 420 Q200 420 200 400 L200 280 Z" fill="#111" stroke="#000" strokeWidth="10"/>
            <path d="M130 290 L130 390 L190 390 L190 290 Z" fill="#333" />
            <path d="M120 280 L200 280 L250 230 L460 230 Q480 230 480 210 L480 170 Q480 150 460 150 L120 150 Z" fill="#444" stroke="#000" strokeWidth="8"/>
            <path d="M300 230 L300 260" stroke="#000" strokeWidth="8" />
            <g className={isSpinningCylinder ? "animate-spin-fast" : ""} style={{ transformOrigin: "280px 190px" }}>
                <circle cx="280" cy="190" r="45" fill="#222" stroke="#000" strokeWidth="6"/>
                <circle cx="280" cy="190" r="12" fill="#555" />
                <circle cx="250" cy="190" r="10" fill="#000" className="shadow-inner"/>
                <circle cx="310" cy="190" r="10" fill="#000" />
                <circle cx="280" cy="160" r="10" fill="#000" />
                <circle cx="280" cy="220" r="10" fill="#000" />
            </g>
            <path d="M460 170 L480 170" stroke="#ff3333" strokeWidth="14" strokeLinecap="round" className={isFiring ? "animate-pulse" : "hidden"}/>
            {isFiring && <circle cx="510" cy="190" r="60" fill="url(#fire)" />}
            <defs>
                <radialGradient id="fire" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="30%" stopColor="#fbd38d" />
                    <stop offset="80%" stopColor="#e53e3e" />
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
  const [coinBet, setCoinBet] = useState(10);
  
  // LOBBIES & MULTIPLAYER
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]); 
  const channelRef = useRef(null);

  // GAMEPLAY STATE
  const [turnId, setTurnId] = useState(null); 
  const [actionLog, setActionLog] = useState("WAITING...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [potTotal, setPotTotal] = useState(0);
  const [potPulse, setPotPulse] = useState(false); // Para brillar cuando entra alguien
  
  // EFECTOS
  const [gunAngle, setGunAngle] = useState(-90); 
  const [gunShaking, setGunShaking] = useState(false);
  const [gunFiring, setGunFiring] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [cylinderSpinning, setCylinderSpinning] = useState(false);

  // MEMORIA DE BALAS
  const chambersRef = useRef([]);
  const currentChamberRef = useRef(0);
  const [uiChamber, setUiChamber] = useState(0); 

  // PRECARGA DE AUDIO SIN LATENCIA
  const sfxRefs = useRef({ spin: null, click: null, bang: null, win: null });

  useEffect(() => {
    // Inicializar Audio
    if (typeof window !== 'undefined') {
        sfxRefs.current.spin = new Audio('/sounds/spin.mp3');
        sfxRefs.current.click = new Audio('/sounds/click.mp3');
        sfxRefs.current.bang = new Audio('/sounds/bang.mp3');
        sfxRefs.current.win = new Audio('/sounds/win.mp3');
        
        sfxRefs.current.bang.volume = 1.0;
        sfxRefs.current.spin.volume = 0.8;
        sfxRefs.current.click.volume = 0.8;
        sfxRefs.current.win.volume = 0.9;
    }

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

  const playSFX = (type) => {
      if (sfxRefs.current[type]) {
          sfxRefs.current[type].currentTime = 0; // Reinicia para disparos rápidos
          sfxRefs.current[type].play().catch(() => {});
      }
  };

  // --- MODO BOT (LOCAL) ---
  const startBotMatch = async () => {
      if (userProfile.saldo_verde < coinBet) return alert("Insufficient coins!");
      
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);
      setPotTotal(coinBet * 2);
      
      const botPlayer = { id: 'bot', name: 'TetoBot', avatar: '/TetoGun.png', isDead: false };
      const mePlayer = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      
      setPlayers([mePlayer, botPlayer]);
      setTurnId(currentUser.id);
      
      setView('playing');
      setActionLog("LOADING CYLINDER...");
      setCylinderSpinning(true);
      playSFX('spin');
      
      setTimeout(() => {
          const newChambers = [false, false, false, false, false, false];
          newChambers[Math.floor(Math.random() * 6)] = true;
          chambersRef.current = newChambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setCylinderSpinning(false);
          setActionLog("YOUR TURN.");
      }, 2000);
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
          setTimeout(() => endGame(currentUser.id, potTotal), 2500);
      } else {
          playSFX('click');
          setActionLog("...CLICK.");
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
      if (mode === 'bot' && view === 'playing' && turnId === 'bot' && !isProcessing && !cylinderSpinning) {
          executeBotTurn();
      }
  }, [turnId, view, mode, cylinderSpinning]);

  // --- ONLINE ROYALE ---
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
      if (userProfile.saldo_verde < coinBet) return alert("Insufficient coins.");
      
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };

      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id, host_name: userProfile.username, bet_type: 'coins', bet_amount: coinBet, players: [me]
      }).select().single();

      if (data) {
          setCurrentRoom(data);
          setPlayers([me]);
          setPotTotal(coinBet);
          connectToRoom(data.id, true);
          // Nos vamos directo a la mesa épica, pero en estado "waiting"
          setView('playing_room'); 
          setActionLog("WAITING FOR PLAYERS...");
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
      setPotTotal(lobby.bet_amount * updatedPlayers.length);
      connectToRoom(lobby.id, false);
      setView('playing_room');
      setActionLog("WAITING FOR HOST TO START...");
  };

  const connectToRoom = (roomId, isHost) => {
      const channel = supabase.channel(`room_${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'player_joined' }, payload => {
          setPlayers(payload.players);
          setPotTotal(currentRoom.bet_amount * payload.players.length);
          setPotPulse(true);
          setTimeout(() => setPotPulse(false), 500);
      });
      
      channel.on('broadcast', { event: 'game_start' }, payload => {
          setView('playing');
          setActionLog("SPINNING CYLINDER...");
          setCylinderSpinning(true);
          playSFX('spin');
          
          setTimeout(() => {
              chambersRef.current = payload.chambers;
              currentChamberRef.current = 0;
              setUiChamber(0);
              setCylinderSpinning(false);
              setTurnId(payload.turnId);
              setActionLog(payload.turnId === currentUser.id ? "YOUR TURN." : "MATCH STARTED.");
          }, 2000);
      });

      channel.on('broadcast', { event: 'shoot_action' }, payload => {
          executeOnlineVisuals(payload.shooterId, payload.targetId, payload.isBullet);
      });

      channel.on('broadcast', { event: 'reload_cylinder' }, payload => {
          chambersRef.current = payload.chambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setActionLog("RELOADING CYLINDER...");
          setCylinderSpinning(true);
          playSFX('spin');
          setTimeout(() => {
              setCylinderSpinning(false);
              setTurnId(payload.turnId);
              setActionLog(payload.turnId === currentUser.id ? "YOUR TURN." : "MATCH CONTINUES.");
              setIsProcessing(false);
          }, 2000);
      });

      channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isHost) {
              supabase.channel('lobby_updates').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, (payload) => {
                  setPlayers(payload.new.players);
                  setPotTotal(currentRoom.bet_amount * payload.new.players.length);
                  setPotPulse(true);
                  setTimeout(() => setPotPulse(false), 500);
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
      const firstTurn = players[0].id;
      
      setView('playing');
      setActionLog("SPINNING CYLINDER...");
      setCylinderSpinning(true);
      playSFX('spin');

      setTimeout(() => {
          chambersRef.current = newChambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setCylinderSpinning(false);
          setTurnId(firstTurn);
          setActionLog("YOUR TURN.");
      }, 2000);

      channelRef.current.send({ type: 'broadcast', event: 'game_start', payload: { chambers: newChambers, turnId: firstTurn } });
  };

  // --- CORE GAMEPLAY ---
  const handleShoot = async (targetId) => {
      if (isProcessing || turnId !== currentUser.id || cylinderSpinning) return;
      setIsProcessing(true);

      const isBullet = chambersRef.current[currentChamberRef.current];

      if (mode === 'online') {
          channelRef.current.send({ type: 'broadcast', event: 'shoot_action', payload: { shooterId: currentUser.id, targetId, isBullet } });
          executeOnlineVisuals(currentUser.id, targetId, isBullet);
      } else {
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
                  setTimeout(() => endGame(currentUser.id, potTotal), 2000);
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

  // El FIX GIGANTE DE POSICIONES EN CIRCULO
  const getPlayerPositionClass = (index, total) => {
      // Index 0 es siempre el LocalPlayer (Abajo Centro)
      if (index === 0) return "bottom-[-5%] left-1/2 -translate-x-1/2";
      if (total === 2) return "top-[5%] left-1/2 -translate-x-1/2"; 
      if (total === 3) return index === 1 ? "top-[15%] left-[-5%]" : "top-[15%] right-[-5%]";
      if (total === 4) {
          if(index===1) return "top-[40%] left-[-10%]";
          if(index===2) return "top-[-5%] left-1/2 -translate-x-1/2";
          if(index===3) return "top-[40%] right-[-10%]";
      }
      if (total >= 5) {
          if(index===1) return "bottom-[15%] left-[-10%]";
          if(index===2) return "top-[10%] left-[5%]";
          if(index===3) return "top-[-5%] left-1/2 -translate-x-1/2";
          if(index===4) return "top-[10%] right-[5%]";
          if(index===5) return "bottom-[15%] right-[-10%]";
      }
      return "top-0";
  };

  const getSeatRotation = (index, total) => {
       if (index === 0) return 90; // Local player, gun aims down
       if (total === 2) return -90; // Top player, gun aims up
       // Si disparamos a un Foe al azar, apuntamos al centro de la mesa (-90)
       return -90; 
  };

  const executeOnlineVisuals = async (shooterId, targetId, isBullet) => {
      const shooterName = players.find(p => p.id === shooterId)?.name;
      const shootingSelf = shooterId === targetId;
      const myIndexInArray = players.findIndex(p => p.id === currentUser.id);
      
      // Mapear el array para que el jugador local siempre sea el index 0 visualmente
      let visualPlayers = [...players];
      if (myIndexInArray > 0) {
          const me = visualPlayers.splice(myIndexInArray, 1)[0];
          visualPlayers.unshift(me);
      }
      
      const visualShooterIndex = visualPlayers.findIndex(p => p.id === shooterId);
      
      if (shootingSelf) setGunAngle(getSeatRotation(visualShooterIndex, visualPlayers.length));
      else setGunAngle(-90); // Apunta al centro

      setActionLog(shootingSelf ? `${shooterName} AIMS AT THEMSELVES...` : `${shooterName} AIMS AT THE TABLE...`);
      
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog(`💥 BANG! ${shooterName} IS DEAD! 💥`);
          
          setPlayers(prev => {
              const newPlayers = prev.map(p => p.id === targetId ? {...p, isDead: true} : p);
              checkOnlineWinCondition(newPlayers, targetId); // Manda el ID del muerto
              return newPlayers;
          });
      } else {
          playSFX('click');
          setActionLog("...CLICK.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              
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

  const checkOnlineWinCondition = async (currentPlayers, deadPlayerId) => {
      const alivePlayers = currentPlayers.filter(p => !p.isDead);
      
      if (alivePlayers.length === 1) {
          const winner = alivePlayers[0];
          setTimeout(() => endGame(winner.id, currentRoom.bet_amount * currentPlayers.length), 3000);
      } else {
          // LA MÁGIA DE LA RECARGA
          // Si murio alguien, hay que vaciar el arma y cargar una nueva bala para los sobrevivientes
          setTimeout(() => {
               setGunFiring(false);
               setScreenFlash(false);
               
               let nextIdx = currentPlayers.findIndex(p => p.id === deadPlayerId) + 1;
               let nextTurnId = null;
               while (nextIdx < currentPlayers.length * 2) {
                  const checkPlayer = currentPlayers[nextIdx % currentPlayers.length];
                  if (!checkPlayer.isDead) {
                      nextTurnId = checkPlayer.id;
                      break;
                  }
                  nextIdx++;
               }

               if (currentRoom.host_id === currentUser.id) {
                   const newChambers = [false, false, false, false, false, false];
                   newChambers[Math.floor(Math.random() * 6)] = true;
                   channelRef.current.send({ type: 'broadcast', event: 'reload_cylinder', payload: { chambers: newChambers, turnId: nextTurnId } });
                   
                   // Host local exec
                   chambersRef.current = newChambers;
                   currentChamberRef.current = 0;
                   setUiChamber(0);
                   setActionLog("RELOADING CYLINDER...");
                   setCylinderSpinning(true);
                   playSFX('spin');
                   setTimeout(() => {
                       setCylinderSpinning(false);
                       setTurnId(nextTurnId);
                       setActionLog(nextTurnId === currentUser.id ? "YOUR TURN." : "MATCH CONTINUES.");
                       setIsProcessing(false);
                   }, 2000);
               }
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
          setActionLog(`💀 GAME OVER. ${winnerName} TAKES IT ALL. 💀`);
      }
      
      if (currentRoom && currentRoom.host_id === currentUser.id) {
          await supabase.from('roulette_lobbies').update({ status: 'finished' }).eq('id', currentRoom.id);
      }
      if(channelRef.current) supabase.removeChannel(channelRef.current);
      
      setTimeout(() => setView('result'), 2000);
      setGunFiring(false);
      setScreenFlash(false);
      setIsProcessing(false);
  };

  // --- MAPEO CIRCULAR VISUAL ---
  const visualCirclePlayers = useMemo(() => {
      if (players.length === 0) return [];
      let mapped = [...players];
      const myIdx = mapped.findIndex(p => p.id === currentUser?.id);
      if (myIdx > 0) {
          const me = mapped.splice(myIdx, 1)[0];
          mapped.unshift(me);
      }
      return mapped;
  }, [players, currentUser]);

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#050505] text-white font-sans overflow-hidden transition-colors duration-100 ${screenFlash ? 'bg-red-900' : ''}`}>
      
      {screenFlash && <div className="fixed inset-0 bg-red-600/80 z-50 animate-flash pointer-events-none"></div>}

      <div className="max-w-[1400px] mx-auto relative z-10 p-4 md:p-8 flex flex-col justify-center min-h-[calc(100vh-100px)]">
        
        {/* === MENU PRINCIPAL === */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center animate-fade-in relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/10 blur-[100px] rounded-full pointer-events-none"></div>
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-800 drop-shadow-[0_0_50px_rgba(220,38,38,0.4)] z-10">ROULETTE</h1>
                <p className="text-gray-400 mb-16 tracking-[0.5em] uppercase font-bold border-b border-red-900/50 pb-4 z-10">High Stakes Survival</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
                    <button onClick={() => { setMode('bot'); setView('betting'); }} className="group relative bg-[#0a0a0a] border-2 border-[#222] p-12 rounded-[2rem] overflow-hidden transition-all hover:scale-105 hover:border-red-600 hover:shadow-[0_0_50px_rgba(220,38,38,0.3)] flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform">🤖</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Local Duel</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Play against TetoBot</p>
                    </button>
                    <button onClick={openLobbies} className="group relative bg-[#0a0a0a] border-2 border-[#222] p-12 rounded-[2rem] overflow-hidden transition-all hover:scale-105 hover:border-blue-600 hover:shadow-[0_0_50px_rgba(37,99,235,0.3)] flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform">🌐</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Online Arena</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Battle Royale (Up to 6)</p>
                    </button>
                </div>
            </div>
        )}

        {/* LOBBIES (LISTA) */}
        {view === 'lobbies' && (
            <div className="animate-fade-in max-w-5xl mx-auto w-full">
                <div className="flex justify-between items-center mb-10 bg-[#0a0a0a] p-6 rounded-3xl border border-[#222]">
                    <button onClick={() => setView('menu')} className="text-gray-500 hover:text-white font-bold tracking-widest uppercase text-sm">← Back</button>
                    <h2 className="text-2xl font-black uppercase tracking-widest text-blue-500 drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]">Online Arenas</h2>
                    <button onClick={() => setView('betting')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all">Host Match</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {lobbies.length === 0 ? (
                        <div className="col-span-full text-center text-gray-600 py-20 font-black uppercase tracking-widest text-xl border-2 border-dashed border-[#222] rounded-3xl">
                            No active tables. Host one!
                        </div>
                    ) : lobbies.map(l => (
                        <div key={l.id} className="bg-[#111]/80 backdrop-blur-md border border-[#333] p-6 rounded-3xl flex flex-col hover:border-blue-500/50 transition-colors group relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-600/20 text-blue-400 font-black text-[10px] px-4 py-1 rounded-bl-xl uppercase tracking-widest">Open Lobby</div>
                            <div className="flex items-center gap-4 mb-6">
                                <img src={getAvatar(null, l.host_name)} className="w-16 h-16 rounded-full border-2 border-[#444]" />
                                <div>
                                    <p className="font-black text-xl tracking-wider text-white">{l.host_name}'s Table</p>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{l.players?.length || 1} / 6 Players</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-[#222] pt-4 mt-auto">
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

        {/* SETUP APUESTA (FIXED UI) */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-2xl mx-auto w-full">
                <div className="bg-[#0a0a0a] rounded-[2rem] p-10 border border-[#222] shadow-2xl relative">
                    <div className="flex items-center gap-4 mb-10">
                        <button onClick={() => setView(mode === 'online' ? 'lobbies' : 'menu')} className="bg-[#111] border border-[#333] px-6 py-2 rounded-xl text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-all text-sm">← Back</button>
                    </div>

                    <h2 className="text-4xl font-black uppercase tracking-widest text-center mb-2">Set Wager</h2>
                    <p className="text-center text-gray-500 uppercase tracking-widest text-xs font-bold mb-10 border-b border-[#222] pb-6">{mode === 'online' ? 'Multiplayer Arena' : 'Local vs Bot'}</p>

                    <div className="bg-[#111] p-8 rounded-3xl border border-[#333] mb-10 focus-within:border-white transition-colors">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4">Amount</p>
                        <div className="flex items-center justify-between">
                            <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-6xl font-black outline-none w-full text-white" />
                            <GreenCoin cls="w-12 h-12"/>
                        </div>
                    </div>

                    <button onClick={mode === 'online' ? hostOnlineMatch : startBotMatch} className={`w-full py-6 text-white font-black text-2xl uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${mode === 'online' ? 'bg-gradient-to-r from-blue-700 to-blue-500 shadow-[0_5px_30px_rgba(37,99,235,0.4)]' : 'bg-gradient-to-r from-red-700 to-red-500 shadow-[0_5px_30px_rgba(220,38,38,0.4)]'}`}>
                        {mode === 'online' ? 'Create Lobby' : 'Start Match'}
                    </button>
                </div>
            </div>
        )}

        {/* === LA MESA UNIFICADA (LOBBY + GAMEPLAY EN LA MISMA MESA) === */}
        {(view === 'playing' || view === 'playing_room') && (
            <div className="relative w-full h-[70vh] flex items-center justify-center animate-fade-in mt-10">
                
                {/* LA MESA (Fondo ovalado) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[900px] h-[55vh] max-h-[550px] bg-[#1a0f0f] border-[16px] border-[#1a1111] rounded-[600px] shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_150px_rgba(0,0,0,1)] z-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-[500px]"></div>
                    <div className="absolute inset-6 rounded-[500px] border-2 border-red-900/30"></div>
                    
                    {/* EL POT EN EL CENTRO */}
                    <div className={`absolute z-0 flex flex-col items-center justify-center bg-black/60 p-10 rounded-full border border-red-900/50 backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-all duration-300 ${potPulse ? 'scale-125 border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.6)]' : ''}`}>
                        <span className="text-[10px] uppercase tracking-[0.4em] text-red-500/80 mb-2 font-black">Total Pot</span>
                        <div className="text-6xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center gap-3">
                            <GreenCoin cls="w-12 h-12"/> {formatValue(potTotal)}
                        </div>
                    </div>
                </div>

                {/* TEXTO DE ACCIÓN CINEMÁTICO */}
                <div className="absolute top-0 w-full text-center z-40 pointer-events-none">
                    <p className={`text-3xl md:text-5xl font-black italic transition-all duration-300 uppercase tracking-[0.2em] bg-black/70 backdrop-blur-md inline-block px-10 py-4 rounded-full border border-white/10 shadow-2xl ${actionLog.includes('BANG') ? 'text-red-600 scale-110 drop-shadow-[0_0_40px_rgba(220,38,38,1)] border-red-500/50' : 'text-white'}`}>
                        {actionLog}
                    </p>
                </div>

                {/* --- JUGADORES EN EL CÍRCULO (DINÁMICO) --- */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {visualCirclePlayers.map((p, idx) => {
                        const positionClass = getPlayerPositionClass(idx, visualCirclePlayers.length);
                        const isMe = p.id === currentUser?.id;
                        const isMyTurn = turnId === p.id;
                        
                        return (
                            <div key={p.id} className={`absolute flex flex-col items-center transition-all duration-700 pointer-events-auto ${positionClass} ${isMyTurn ? 'scale-125 z-40' : 'opacity-80 scale-100 z-10'} ${p.isDead ? 'grayscale opacity-30 scale-75' : ''}`}>
                                
                                {/* Spotlight visual */}
                                {isMyTurn && !p.isDead && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/10 blur-2xl rounded-full pointer-events-none"></div>}

                                <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-[6px] p-1 bg-[#111] relative shadow-2xl ${isMyTurn && !p.isDead ? 'border-white drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]' : 'border-[#222]'}`}>
                                    <img src={p.avatar} className="w-full h-full object-cover rounded-full" />
                                    {p.isDead && <div className="absolute inset-0 flex items-center justify-center text-5xl bg-red-900/80 rounded-full backdrop-blur-sm">💀</div>}
                                </div>
                                <div className={`mt-3 font-black text-[10px] px-6 py-2 rounded-full uppercase tracking-widest border border-[#333] shadow-lg ${isMe ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-gray-400'}`}>
                                    {isMe ? 'YOU' : p.name}
                                </div>
                                
                                {/* Botones del Jugador Local */}
                                {isMe && view === 'playing' && !p.isDead && turnId === currentUser.id && (
                                    <div className="absolute top-[-80px] w-max flex gap-4">
                                        <button 
                                            disabled={isProcessing || cylinderSpinning} 
                                            onClick={() => handleShoot(currentUser.id)}
                                            className="bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 text-xs md:text-sm"
                                        >
                                            Shoot Self
                                        </button>
                                        {mode === 'bot' && (
                                            <button 
                                                disabled={isProcessing || cylinderSpinning} 
                                                onClick={() => handleShoot('bot')}
                                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-95 text-xs md:text-sm"
                                            >
                                                Shoot Bot
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* --- EL ARMA EN EL CENTRO --- */}
                {view === 'playing' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 flex items-center justify-center z-30 pointer-events-none mt-4">
                        <GunSVG targetAngle={gunAngle} isShaking={gunShaking} isFiring={gunFiring} isSpinningCylinder={cylinderSpinning} />
                        
                        {/* UI del Cilindro */}
                        <div className="absolute -bottom-16 flex gap-2 bg-black/60 px-6 py-2 rounded-full border border-white/10 backdrop-blur-md">
                            {[0, 1, 2, 3, 4, 5].map(idx => (
                                <div key={idx} className={`w-3 h-3 rounded-full border transition-all duration-300 ${idx === uiChamber ? 'border-red-500 bg-red-500 shadow-[0_0_10px_rgba(220,38,38,1)] scale-150' : idx < uiChamber ? 'border-[#333] bg-[#111] opacity-40' : 'border-gray-500 bg-transparent'}`}></div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- BOTON START (SOLO LOBBY HOST) --- */}
                {view === 'playing_room' && currentRoom?.host_id === currentUser?.id && (
                    <div className="absolute bottom-10 z-40">
                        <button onClick={startOnlineGameHost} disabled={players.length < 2} className="bg-white text-black px-16 py-6 rounded-full font-black text-xl uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 transition-all disabled:opacity-20">
                            Start Match ({players.length}/6)
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* --- PANTALLA DE RESULTADOS --- */}
        {view === 'result' && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] animate-fade-in relative z-50">
                <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl z-0 pointer-events-none rounded-3xl"></div>
                <div className="text-[180px] leading-none mb-6 z-10 drop-shadow-[0_0_60px_rgba(255,0,0,0.8)] animate-bounce-slight">{actionLog.includes('WON') ? '🏆' : '💀'}</div>
                <h2 className={`text-4xl md:text-7xl font-black mb-16 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl px-4 ${actionLog.includes('WON') ? 'text-yellow-400' : 'text-red-600'}`}>{actionLog}</h2>
                <button onClick={() => { setView('menu'); setCurrentRoom(null); setPlayers([]); }} className="px-16 py-6 bg-white text-black text-xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 z-10 active:scale-95">
                    EXIT ARENA
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-shake-hard { animation: shakeHard 0.15s ease-in-out infinite; }
        .animate-flash { animation: flash 0.6s ease-out forwards; }
        .animate-spin-fast { animation: spinFast 0.5s linear infinite; }
        .animate-bounce-slight { animation: bounceSlight 2s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shakeHard {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-6px, 6px) rotate(-4deg); }
            50% { transform: translate(6px, -6px) rotate(4deg); }
            75% { transform: translate(-6px, -6px) rotate(-2deg); }
        }
        @keyframes flash {
            0% { opacity: 1; background-color: rgba(220,38,38,1); }
            100% { opacity: 0; background-color: transparent; }
        }
        @keyframes spinFast {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes bounceSlight {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
