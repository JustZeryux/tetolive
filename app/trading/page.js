"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';
import PetCard from '@/components/PetCard';
import { showToast } from '@/components/EpicToasts';

// --- VISUAL COMPONENTS ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=111,000`;

export default function TradingRoomPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userInventory, setUserInventory] = useState([]);
  const [botFullInventory, setBotFullInventory] = useState([]); // For Bot Mode
  
  const [view, setView] = useState('menu'); // 'menu' | 'lobbies' | 'trading' | 'result'
  const [mode, setMode] = useState('bot'); // 'bot' | 'online'
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const activeChannelRef = useRef(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [epicTradeData, setEpicTradeData] = useState(null);

  // --- TRADE STATES ---
  const [myOffer, setMyOffer] = useState({ coins: '', items: [] });
  const [partnerOffer, setPartnerOffer] = useState({ coins: '', items: [] });
  
  const [myConfirmations, setMyConfirmations] = useState(0); // 0=Editing, 1=Locked, 2=Final Accept
  const [partnerConfirmations, setPartnerConfirmations] = useState(0);

  const [partnerInfo, setPartnerInfo] = useState({ name: 'Waiting...', avatar: '' });

  // --- INITIALIZATION ---
  const fetchInventory = async (userId) => {
      const { data: inv } = await supabase.from('inventory').select(`id, item_id, items (name, value, image_url, color, is_shiny, is_mythic)`).eq('user_id', userId);
      if (inv) {
          setUserInventory(inv.map(i => ({ 
              ...i.items, inv_id: i.id, item_id: i.item_id 
          })));
      }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
        await fetchInventory(user.id);

        // Preload bot items
        const { data: allItems } = await supabase.from('items').select('*').gt('value', 0);
        if (allItems) setBotFullInventory(allItems);
      }
    };
    init();
    return () => cleanupChannel();
  }, []);

  const cleanupChannel = () => {
      if (activeChannelRef.current) {
          supabase.removeChannel(activeChannelRef.current);
          activeChannelRef.current = null;
      }
  };

  const calculateTotalValue = (offer) => {
      const coins = Number(offer.coins) || 0;
      const itemsValue = offer.items.reduce((sum, item) => sum + item.value, 0);
      return coins + itemsValue;
  };

  // --- ANTI-SCAM ENGINE: TRIGGER ON ANY OFFER EDIT ---
  const handleMyOfferChange = (newOffer) => {
      if (myConfirmations >= 1) return; // Block edit if locked
      setMyOffer(newOffer);
      
      // Local Bot Mode
      if (mode === 'bot') {
          setMyConfirmations(0);
          setPartnerConfirmations(0);
          simulateBotResponse(newOffer);
      } 
      // Online Mode
      else if (currentRoom) {
          syncOfferToDB(newOffer);
      }
  };

  const syncOfferToDB = async (newOffer) => {
      const isHost = currentRoom.host_id === currentUser.id;
      const updates = isHost ? { host_offer: newOffer, host_confirm: 0, guest_confirm: 0 } 
                             : { guest_offer: newOffer, host_confirm: 0, guest_confirm: 0 };
      
      await supabase.from('trading_lobbies').update(updates).eq('id', currentRoom.id);
  };

  // --- BOT LOGIC ---
  const simulateBotResponse = (playerOffer) => {
      const playerValue = calculateTotalValue(playerOffer);
      if (playerValue === 0) {
          setPartnerOffer({ coins: '', items: [] });
          return;
      }

      // TetoBot tries to match the value roughly (+/- 10%)
      let botItems = [];
      let currentBotVal = 0;
      const targetVal = playerValue * (0.9 + Math.random() * 0.2); // Random matching

      const shuffled = [...botFullInventory].sort(() => 0.5 - Math.random());
      for (const item of shuffled) {
          if (currentBotVal + item.value <= targetVal && botItems.length < 6) {
              botItems.push({...item, item_id: item.id, inv_id: `bot_${Math.random()}`});
              currentBotVal += item.value;
          }
      }

      let remainingCoins = Math.floor(targetVal - currentBotVal);
      setPartnerOffer({ coins: remainingCoins > 0 ? remainingCoins.toString() : '', items: botItems });
  };

  const executeBotTrade = async () => {
      setIsProcessing(true);
      await new Promise(r => setTimeout(r, 1500)); // Suspense

      // 1. Deduct my items/coins
      if (myOffer.items.length > 0) {
          await supabase.from('inventory').delete().in('id', myOffer.items.map(i => i.inv_id));
      }
      let newBalance = userProfile.saldo_verde - (Number(myOffer.coins) || 0);

      // 2. Add Partner items/coins to me
      if (partnerOffer.items.length > 0) {
          const insertPayload = partnerOffer.items.map(p => ({ user_id: currentUser.id, item_id: p.item_id || p.id }));
          await supabase.from('inventory').insert(insertPayload);
      }
      newBalance += (Number(partnerOffer.coins) || 0);

      // 3. Update Profile
      await supabase.from('profiles').update({ saldo_verde: newBalance }).eq('id', currentUser.id);
      setUserProfile(prev => ({...prev, saldo_verde: newBalance}));

      await fetchInventory(currentUser.id);
      
      // TRIGGER EPIC WINDOW
      setEpicTradeData(partnerOffer);
      setView('result');
      setIsProcessing(false);
  };

  // --- ONLINE LOBBY SYSTEM ---
  const fetchLobbies = async () => {
      const { data } = await supabase.from('trading_lobbies').select('*').eq('status', 'waiting');
      if (data) setLobbies(data);
  };

  const openLobbies = () => {
      setMode('online');
      fetchLobbies();
      setView('lobbies');
      cleanupChannel();
      const channel = supabase.channel('public:trading_lobbies')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_lobbies' }, fetchLobbies)
          .subscribe();
      activeChannelRef.current = channel;
  };

  const createTradeRoom = async () => {
      const { data } = await supabase.from('trading_lobbies').insert({
          host_id: currentUser.id, host_name: userProfile.username, host_avatar: userProfile.avatar_url,
          host_offer: { coins: '', items: [] }, guest_offer: { coins: '', items: [] },
          status: 'waiting'
      }).select().single();

      if (data) {
          setCurrentRoom(data);
          setPartnerInfo({ name: 'Waiting for partner...', avatar: '' });
          connectToRoom(data.id, true);
          setView('trading');
      }
  };

  const joinTradeRoom = async (lobby) => {
      const { data } = await supabase.from('trading_lobbies').update({
          guest_id: currentUser.id, guest_name: userProfile.username, guest_avatar: userProfile.avatar_url,
          status: 'trading'
      }).eq('id', lobby.id).select().single();

      if (data) {
          setCurrentRoom(data);
          setPartnerInfo({ name: data.host_name, avatar: getAvatar(data.host_avatar, data.host_name) });
          connectToRoom(data.id, false);
          setView('trading');
      }
  };

  const connectToRoom = (roomId, isHost) => {
      cleanupChannel();

      const channel = supabase.channel(`trade_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trading_lobbies', filter: `id=eq.${roomId}` }, (payload) => {
          const room = payload.new;
          setCurrentRoom(room);

          if (isHost && room.guest_id) {
              setPartnerInfo({ name: room.guest_name, avatar: getAvatar(room.guest_avatar, room.guest_name) });
          }

          // Sync Offers
          if (isHost) {
              setPartnerOffer(room.guest_offer || {coins:'', items:[]});
              setMyConfirmations(room.host_confirm);
              setPartnerConfirmations(room.guest_confirm);
          } else {
              setPartnerOffer(room.host_offer || {coins:'', items:[]});
              setMyConfirmations(room.guest_confirm);
              setPartnerConfirmations(room.host_confirm);
          }

          // Execution Trigger
          if (room.status === 'completed') {
              handleTradeSuccessOnline(isHost ? room.guest_offer : room.host_offer, room.final_balance);
          } else if (room.status === 'cancelled') {
              showToast("Trade Cancelled by partner.", "error");
              leaveToMenu();
          }
      }).subscribe();
      
      activeChannelRef.current = channel;
  };

  const handleTradeSuccessOnline = async (receivedOffer, myNewBalance) => {
      setUserProfile(prev => ({...prev, saldo_verde: myNewBalance}));
      await fetchInventory(currentUser.id);
      setEpicTradeData(receivedOffer);
      setView('result');
      cleanupChannel();
  };

  // --- ACTION BUTTONS ---
  const handleLockOffer = async () => {
      // Validation
      const myCoinVal = Number(myOffer.coins) || 0;
      if (myCoinVal > userProfile.saldo_verde) return showToast("Insufficient balance!", "error");
      
      if (mode === 'bot') {
          setMyConfirmations(1);
          setTimeout(() => setPartnerConfirmations(1), 1000); // Bot instantly locks too
      } else {
          setMyConfirmations(1);
          const isHost = currentRoom.host_id === currentUser.id;
          await supabase.from('trading_lobbies').update(isHost ? { host_confirm: 1 } : { guest_confirm: 1 }).eq('id', currentRoom.id);
      }
  };

  const handleFinalAccept = async () => {
      if (mode === 'bot') {
          executeBotTrade();
      } else {
          setIsProcessing(true);
          const isHost = currentRoom.host_id === currentUser.id;
          await supabase.from('trading_lobbies').update(isHost ? { host_confirm: 2 } : { guest_confirm: 2 }).eq('id', currentRoom.id);
          // Actual DB trigger or edge function should handle the swap when both = 2. 
          // For frontend demo purposes, we trust the host to execute the swap if both = 2:
          if (isHost && partnerConfirmations === 2) {
              executeOnlineSwapInDB();
          } else if (!isHost && partnerConfirmations === 2) {
              // Guest waits for host to finalize
          }
      }
  };

  const executeOnlineSwapInDB = async () => {
      // VERY SIMPLIFIED FRONTEND SWAP EXECUTION (Should be backend in production)
      const hostCoins = Number(currentRoom.host_offer.coins) || 0;
      const guestCoins = Number(currentRoom.guest_offer.coins) || 0;
      
      // Update items owner
      if (currentRoom.host_offer.items.length > 0) await supabase.from('inventory').update({user_id: currentRoom.guest_id}).in('id', currentRoom.host_offer.items.map(i=>i.inv_id));
      if (currentRoom.guest_offer.items.length > 0) await supabase.from('inventory').update({user_id: currentRoom.host_id}).in('id', currentRoom.guest_offer.items.map(i=>i.inv_id));
      
      // Update Balances
      const { data: pHost } = await supabase.from('profiles').select('saldo_verde').eq('id', currentRoom.host_id).single();
      const { data: pGuest } = await supabase.from('profiles').select('saldo_verde').eq('id', currentRoom.guest_id).single();
      
      const newHostBalance = pHost.saldo_verde - hostCoins + guestCoins;
      const newGuestBalance = pGuest.saldo_verde - guestCoins + hostCoins;
      
      await supabase.from('profiles').update({saldo_verde: newHostBalance}).eq('id', currentRoom.host_id);
      await supabase.from('profiles').update({saldo_verde: newGuestBalance}).eq('id', currentRoom.guest_id);
      
      // Mark Complete
      await supabase.from('trading_lobbies').update({status: 'completed', final_balance: newHostBalance}).eq('id', currentRoom.id); // Hack for frontend sync
  };

  const cancelTrade = async () => {
      if (mode === 'online' && currentRoom) {
          await supabase.from('trading_lobbies').update({ status: 'cancelled' }).eq('id', currentRoom.id);
      }
      leaveToMenu();
  };

  const leaveToMenu = () => {
      cleanupChannel();
      setView('menu');
      setCurrentRoom(null);
      setMyOffer({ coins: '', items: [] });
      setPartnerOffer({ coins: '', items: [] });
      setMyConfirmations(0);
      setPartnerConfirmations(0);
      setEpicTradeData(null);
  };


  // --- UI HELPERS ---
  const toggleItemInOffer = (pet) => {
      let newItems = [...myOffer.items];
      if (newItems.some(i => i.inv_id === pet.inv_id)) {
          newItems = newItems.filter(i => i.inv_id !== pet.inv_id);
      } else {
          if (newItems.length >= 12) return showToast("Max 12 items per trade", "error");
          newItems.push(pet);
      }
      handleMyOfferChange({ ...myOffer, items: newItems });
  };


  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-white font-sans overflow-hidden transition-colors duration-300">
      
      <div className="max-w-[1600px] mx-auto relative z-10 p-4 flex flex-col justify-center min-h-[calc(100vh-100px)]">
        
        {/* === MENU === */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center animate-fade-in relative py-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none"></div>
                <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-cyan-400 to-blue-600 drop-shadow-[0_0_40px_rgba(6,182,212,0.4)] z-10">TRADE CENTER</h1>
                <p className="text-gray-400 mb-16 tracking-[0.5em] uppercase font-bold border-b border-cyan-900/50 pb-4 z-10">Secure Exchange Network</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
                    <button onClick={() => { setMode('bot'); setPartnerInfo({name: 'TetoBot', avatar: '/TetoGun.png'}); setView('trading'); }} className="group relative bg-[#0a0a0a] border border-[#222] p-12 rounded-[2rem] transition-all hover:scale-105 hover:border-yellow-500 shadow-2xl flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform">🤖</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Trade Bot</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Instant Value Exchange</p>
                    </button>
                    <button onClick={openLobbies} className="group relative bg-[#0a0a0a] border border-[#222] p-12 rounded-[2rem] transition-all hover:scale-105 hover:border-cyan-500 shadow-2xl flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform">🌐</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">P2P Network</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Player to Player Market</p>
                    </button>
                </div>
            </div>
        )}

        {/* === LOBBIES === */}
        {view === 'lobbies' && (
            <div className="animate-fade-in max-w-5xl mx-auto w-full">
                <div className="flex justify-between items-center mb-8 bg-[#0a0a0a] p-6 rounded-[2rem] border border-[#222] shadow-xl">
                    <button onClick={leaveToMenu} className="text-gray-500 hover:text-white font-black tracking-widest uppercase text-sm">← Back</button>
                    <h2 className="text-3xl font-black uppercase tracking-widest text-cyan-500">Public Trades</h2>
                    <button onClick={createTradeRoom} className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all active:scale-95">Host Trade</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {lobbies.length === 0 ? (
                        <div className="col-span-full text-center text-gray-600 py-32 font-black uppercase tracking-widest text-2xl border-2 border-dashed border-[#222] rounded-[2rem]">
                            No active trades. Host one!
                        </div>
                    ) : lobbies.map(l => (
                        <div key={l.id} className="bg-[#111] border border-[#333] p-8 rounded-[2rem] flex flex-col hover:border-cyan-500 transition-colors group relative shadow-2xl">
                            <div className="flex items-center gap-6 mb-8">
                                <img src={getAvatar(l.host_avatar, l.host_name)} className="w-20 h-20 rounded-full border-4 border-[#222] object-cover" />
                                <div>
                                    <p className="font-black text-2xl tracking-wider text-white truncate max-w-[200px]">{l.host_name}</p>
                                    <p className="text-sm text-gray-500 uppercase font-black tracking-widest mt-1">Looking for offers</p>
                                </div>
                            </div>
                            <button onClick={() => joinTradeRoom(l)} className="w-full bg-white text-black hover:bg-cyan-500 hover:text-white py-4 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95">Join Trade</button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === TRADING ROOM === */}
        {view === 'trading' && (
          <div className="animate-fade-in">
            {/* Header Controls */}
            <div className="flex justify-between items-center mb-6">
                <button onClick={cancelTrade} className="px-6 py-3 bg-red-900/30 text-red-500 border border-red-900/50 rounded-xl font-black uppercase tracking-widest hover:bg-red-900/50 transition-all">Cancel Trade</button>
                <div className="text-center">
                    <h2 className="text-2xl font-black uppercase tracking-[0.3em] text-white">SECURE EXCHANGE</h2>
                    {myConfirmations === 0 && <p className="text-cyan-500 text-xs font-bold uppercase tracking-widest animate-pulse">Editing Offer...</p>}
                </div>
                <div className="w-32"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch h-[75vh] min-h-[600px]">
              
              {/* LADO A: MY OFFER */}
              <div className={`flex flex-col bg-[#0a0a0a] rounded-[2.5rem] border-4 p-8 transition-all duration-500 shadow-2xl relative overflow-hidden
                  ${myConfirmations >= 1 ? 'border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.15)]' : 'border-[#222]'}
              `}>
                <div className={`absolute inset-0 bg-green-500/5 transition-opacity duration-500 pointer-events-none ${myConfirmations >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>

                <div className="flex justify-between items-center mb-6 relative z-10 border-b border-[#222] pb-4">
                  <div className="flex items-center gap-4">
                      <img src={getAvatar(userProfile?.avatar_url, userProfile?.username)} className="w-12 h-12 rounded-full border-2 border-white" />
                      <h2 className="text-2xl font-black uppercase tracking-widest text-white">YOU</h2>
                  </div>
                  <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all
                      ${myConfirmations >= 1 ? 'bg-green-500 text-black border-green-400 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-[#111] text-gray-500 border-[#333]'}
                  `}>
                    {myConfirmations >= 1 ? 'OFFER LOCKED 🔒' : 'EDITING ✍️'}
                  </span>
                </div>

                {/* Coin Input */}
                <div className="bg-[#111] rounded-2xl p-6 mb-6 border border-[#222] relative z-10 transition-colors focus-within:border-green-500">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Offer Green Coins</label>
                    <span className="text-[#22c55e] text-[10px] font-black tracking-widest uppercase">Max: {formatValue(userProfile?.saldo_verde || 0)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <GreenCoin cls="w-10 h-10"/>
                    <input type="number" disabled={myConfirmations >= 1} value={myOffer.coins}
                      onChange={(e) => handleMyOfferChange({...myOffer, coins: e.target.value})}
                      className="bg-transparent text-4xl font-black text-white outline-none w-full placeholder-gray-800 disabled:opacity-50"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Pet Selection Grid */}
                <div className="flex-1 relative z-10 flex flex-col min-h-0">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Select Pets to Offer</h3>
                  
                  {userInventory.length === 0 ? (
                      <div className="flex-1 border-2 border-dashed border-[#222] rounded-2xl flex items-center justify-center text-gray-600 font-black uppercase tracking-widest">Empty Inventory</div>
                  ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {userInventory.map(pet => {
                            const isSelected = myOffer.items.some(i => i.inv_id === pet.inv_id);
                            return (
                                <div key={pet.inv_id} onClick={() => { if(myConfirmations < 1) toggleItemInOffer(pet); }} className={`relative transition-all cursor-pointer ${myConfirmations >= 1 && !isSelected ? 'opacity-20 grayscale' : ''} ${isSelected ? 'scale-105 shadow-[0_0_15px_rgba(34,197,94,0.4)] ring-2 ring-green-500 rounded-2xl z-10' : 'hover:-translate-y-1'}`}>
                                    <div className="pointer-events-none"><PetCard pet={pet} /></div>
                                </div>
                            );
                        })}
                      </div>
                  )}
                </div>

                {/* Value & Action Buttons */}
                <div className="mt-6 pt-6 border-t border-[#222] relative z-10">
                   <div className="flex justify-between items-center mb-6">
                       <span className="text-gray-500 font-black uppercase tracking-widest text-xs">Total Offer Value</span>
                       <span className="text-2xl font-black text-white flex items-center gap-2"><GreenCoin/> {formatValue(calculateTotalValue(myOffer))}</span>
                   </div>
                   
                   {myConfirmations === 0 && (
                       <button onClick={handleLockOffer} className="w-full py-5 bg-white text-black hover:bg-gray-200 rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] text-lg">
                           LOCK OFFER (1/2)
                       </button>
                   )}
                   {myConfirmations >= 1 && partnerConfirmations < 1 && (
                       <button onClick={() => handleMyOfferChange(myOffer)} className="w-full py-5 bg-[#222] text-gray-400 hover:text-white rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 text-sm border border-[#333]">
                           UNLOCK & EDIT
                       </button>
                   )}
                   {myConfirmations === 1 && partnerConfirmations >= 1 && (
                       <button onClick={handleFinalAccept} disabled={isProcessing} className="w-full py-6 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.5)] text-xl animate-pulse">
                           {isProcessing ? 'PROCESSING...' : 'ACCEPT TRADE (2/2)'}
                       </button>
                   )}
                   {myConfirmations === 2 && (
                       <button disabled className="w-full py-6 bg-green-600 text-white rounded-xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(34,197,94,0.5)] text-xl opacity-80 cursor-not-allowed">
                           WAITING FOR PARTNER...
                       </button>
                   )}
                </div>
              </div>

              {/* LADO B: PARTNER OFFER */}
              <div className={`flex flex-col bg-[#0a0a0a] rounded-[2.5rem] border-4 p-8 transition-all duration-500 shadow-2xl relative overflow-hidden
                  ${partnerConfirmations >= 1 ? 'border-cyan-500 shadow-[0_0_50px_rgba(6,182,212,0.15)]' : 'border-[#222]'}
              `}>
                <div className={`absolute inset-0 bg-cyan-500/5 transition-opacity duration-500 pointer-events-none ${partnerConfirmations >= 1 ? 'opacity-100' : 'opacity-0'}`}></div>

                {/* Cover for Waiting */}
                {mode === 'online' && !currentRoom?.guest_id && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
                        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_#06b6d4]"></div>
                        <p className="text-cyan-400 font-black uppercase tracking-widest text-xl animate-pulse">Waiting for partner...</p>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Room is open</p>
                    </div>
                )}

                <div className="flex justify-between items-center mb-6 relative z-10 border-b border-[#222] pb-4">
                  <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all
                      ${partnerConfirmations >= 1 ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : 'bg-[#111] text-gray-500 border-[#333]'}
                  `}>
                    {partnerConfirmations >= 1 ? 'OFFER LOCKED 🔒' : 'EDITING ✍️'}
                  </span>
                  <div className="flex items-center gap-4">
                      <h2 className="text-2xl font-black uppercase tracking-widest text-white">{partnerInfo.name}</h2>
                      <img src={partnerInfo.avatar} className="w-12 h-12 rounded-full border-2 border-white object-cover bg-[#222]" />
                  </div>
                </div>

                {/* Coin Input (Readonly) */}
                <div className="bg-[#111] rounded-2xl p-6 mb-6 border border-[#222] relative z-10">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Offered Coins</label>
                  </div>
                  <div className="flex items-center gap-4">
                    <GreenCoin cls="w-10 h-10"/>
                    <input type="text" disabled value={partnerOffer.coins ? formatValue(Number(partnerOffer.coins)) : ''}
                      className="bg-transparent text-4xl font-black text-white outline-none w-full placeholder-gray-800"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Pet Selection Grid (Readonly) */}
                <div className="flex-1 relative z-10 flex flex-col min-h-0">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Offered Pets</h3>
                  
                  {partnerOffer.items.length === 0 ? (
                      <div className="flex-1 border-2 border-dashed border-[#222] rounded-2xl flex items-center justify-center text-gray-600 font-black uppercase tracking-widest">No Pets Offered</div>
                  ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 overflow-y-auto custom-scrollbar pr-2 pb-4">
                        {partnerOffer.items.map(pet => (
                            <div key={pet.inv_id} className="relative transition-all pointer-events-none">
                                <PetCard pet={pet} />
                            </div>
                        ))}
                      </div>
                  )}
                </div>

                {/* Value */}
                <div className="mt-6 pt-6 border-t border-[#222] relative z-10">
                   <div className="flex justify-between items-center">
                       <span className="text-gray-500 font-black uppercase tracking-widest text-xs">Total Offer Value</span>
                       <span className="text-2xl font-black text-white flex items-center gap-2"><GreenCoin/> {formatValue(calculateTotalValue(partnerOffer))}</span>
                   </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* === EPIC RESULT SCREEN === */}
        {view === 'result' && epicTradeData && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in overflow-hidden">
                <div className="absolute top-10 right-10 z-50">
                    <img src="/Affiliates.png" className="w-24 h-24 animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] filter grayscale brightness-200" alt="Backpack" />
                </div>

                <div className="text-[120px] leading-none mb-4 z-10 drop-shadow-[0_0_80px_rgba(34,197,94,0.8)] animate-bounce-slight">🤝</div>
                <h2 className="text-5xl md:text-7xl font-black mb-12 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl text-green-400">TRADE SUCCESSFUL!</h2>
                
                <div className="flex flex-col items-center max-w-4xl z-10 mb-16">
                    <p className="text-gray-400 font-black uppercase tracking-widest mb-8">You Received</p>
                    
                    <div className="flex flex-wrap gap-8 justify-center items-center">
                        {epicTradeData.coins && Number(epicTradeData.coins) > 0 && (
                            <div className="text-6xl font-black text-green-400 flex items-center gap-4 animate-fly-to-backpack drop-shadow-[0_0_40px_rgba(34,197,94,0.8)]">
                                <GreenCoin cls="w-20 h-20"/> +{formatValue(Number(epicTradeData.coins))}
                            </div>
                        )}
                        
                        {epicTradeData.items.map((pet, i) => (
                            <div key={i} className="animate-fly-to-backpack drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]" style={{animationDelay: `${i * 0.15}s`}}>
                                <div className="scale-125 pointer-events-none"><PetCard pet={pet} /></div>
                            </div>
                        ))}
                        
                        {!epicTradeData.coins && epicTradeData.items.length === 0 && (
                            <p className="text-gray-500 font-black text-2xl uppercase">Nothing (Gift)</p>
                        )}
                    </div>
                </div>

                <button onClick={leaveToMenu} className="px-16 py-6 bg-white text-black text-2xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:scale-105 z-10 active:scale-95">
                    COLLECT & LEAVE
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-bounce-slight { animation: bounceSlight 2s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceSlight { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

        /* EPIC BACKPACK FLYING ANIMATION */
        @keyframes flyToBackpack {
            0% { transform: scale(0) translateY(100px); opacity: 0; }
            15% { transform: scale(1.2) translateY(0); opacity: 1; }
            60% { transform: scale(1) translateY(0); opacity: 1; }
            100% { transform: scale(0.1) translate(calc(45vw - 100px), calc(-40vh + 100px)); opacity: 0; }
        }
        .animate-fly-to-backpack { animation: flyToBackpack 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}
