import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Heart, ShieldAlert, Info, X, CheckCircle2, AlertCircle, Zap, Ghost, UserPlus } from 'lucide-react';
import confetti from 'canvas-confetti';

// --- CONFIGURATION DU DESIGN ---
const GAGE_COLORS = {
  green: { border: 'border-green-500', text: 'text-green-400', shadow: 'shadow-[0_0_15px_rgba(34,197,94,0.4)]', bg: 'bg-green-500/10' },
  orange: { border: 'border-orange-500', text: 'text-orange-400', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]', bg: 'bg-orange-500/10' },
  red: { border: 'border-red-500', text: 'text-red-400', shadow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]', bg: 'bg-red-500/20' }
};

export default function ValDIlliezRoyale() {
  // --- ÉTATS ---
  const [user, setUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myGages, setMyGages] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerHistory, setPlayerHistory] = useState([]);
  const [showRules, setShowRules] = useState(false);
  const [showJokerModal, setShowJokerModal] = useState(false);
  const [loginData, setLoginData] = useState({ name: '', pass: '' });
  const [timeLeft, setTimeLeft] = useState(null);

  // --- INITIALISATION & SYNCHRONISATION ---
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem('valDIlliezUser');
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        fetchPrivateData(parsed.id);
      }
      fetchGlobalData();
    };
    init();

    const channel = supabase.channel('global-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, fetchGlobalData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // --- GESTION DU TIMER (3H) ---
  useEffect(() => {
    if (myGages[0]?.assigned_at) {
      const timer = setInterval(() => {
        const limit = 3 * 3600000;
        const diff = limit - (Date.now() - new Date(myGages[0].assigned_at).getTime());
        setTimeLeft(diff > 0 ? diff : 0);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [myGages]);

  // --- RÉCUPÉRATION DES DONNÉES ---
  const fetchGlobalData = async () => {
    const { data } = await supabase.from('players').select('*').order('points', { ascending: false });
    setPlayers(data || []);
  };

  const fetchPrivateData = async (userId) => {
    const { data: p } = await supabase.from('players').select('*').eq('id', userId).maybeSingle();
    if (p) {
      setUser(p);
      if (p.current_gage_id) {
        const { data: g } = await supabase.from('gages').select('*').eq('id', p.current_gage_id).maybeSingle();
        setMyGages(g ? [{ ...g, assigned_at: p.gage_assigned_at }] : []);
      } else { setMyGages([]); }
    }
  };

  const fetchPlayerHistory = async (playerId) => {
    const { data } = await supabase.from('history').select('*').eq('player_id', playerId).order('created_at', { ascending: false });
    setPlayerHistory(data || []);
  };

  // --- LOGIQUE DE CONNEXION ---
  const handleLogin = async () => {
    const { data } = await supabase.from('players').select('*').eq('name', loginData.name).eq('password', loginData.pass).maybeSingle();
    if (data) {
      localStorage.setItem('valDIlliezUser', JSON.stringify(data));
      setUser(data);
      fetchPrivateData(data.id);
    } else { alert("Accès refusé !"); }
  };

  // --- ACTIONS DU JEU ---
  const completeGage = async (gageId, points) => {
    console.log("🏆 Validation du défi et notification n8n...");
    const gageTitle = myGages[0]?.title || "Défi inconnu";
    
    await supabase.from('history').insert([
      { player_id: user.id, gage_title: gageTitle, status: 'success' }
    ]);

    const { error } = await supabase.from('players').update({
      points: (user.points || 0) + (points || 1),
      current_gage_id: null,
      gage_status: 'success'
    }).eq('id', user.id);

    if (!error) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });

      try {
        fetch('https://n8n-latest-fsq5.onrender.com/webhook/congrats-notif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: user.name, 
            gage: gageTitle, 
            points_gained: points || 1 
          })
        });
        console.log("✅ Notification envoyée à n8n");
      } catch (e) {
        console.error("❌ Erreur notification n8n:", e);
      }

      await fetchGlobalData();
      await fetchPrivateData(user.id);
      await fetchPlayerHistory(user.id);
    }
  };

  const abandonGage = async () => {
    const cost = (user.lives || 0) > 0 ? 0 : 1;
    await supabase.from('history').insert([{ player_id: user.id, gage_title: myGages[0].title, status: 'failed' }]);
    await supabase.from('players').update({
      points: (user.points || 0) - cost,
      lives: Math.max(0, (user.lives || 0) - 1),
      current_gage_id: null,
      gage_status: 'failed'
    }).eq('id', user.id);
    fetchPrivateData(user.id);
    fetchGlobalData();
  };

  const handleSendJoker = async (targetId) => {
    const target = players.find(p => p.id === targetId);
    if (!target || target.current_gage_id) return alert("Cible occupée ou invalide !");

    await supabase.from('players').update({ 
      current_gage_id: myGages[0].id, 
      gage_assigned_at: new Date(), 
      gage_status: 'pending' 
    }).eq('id', target.id);
    
    await supabase.from('players').update({ 
      points: (user.points || 0) - 1, 
      current_gage_id: null 
    }).eq('id', user.id);
    
    setShowJokerModal(false);
    alert(`Défi refilé à ${target.name} ! -1 point pour toi.`);
    fetchPrivateData(user.id);
    fetchGlobalData();
  };

  // --- GESTION DES ARCHIVES ---
  const toggleHistoryStatus = async (item) => {
    const isNowSuccess = item.status !== 'success';
    const newStatus = isNowSuccess ? 'success' : 'failed';
    const pointsAdjustment = isNowSuccess ? 1 : -1;

    const { error: histError } = await supabase.from('history').update({ status: newStatus }).eq('id', item.id);

    if (!histError) {
      const { error: pError } = await supabase.from('players').update({ 
        points: (user.points || 0) + pointsAdjustment 
      }).eq('id', user.id).select();

      if (!pError) {
        await fetchGlobalData();
        await fetchPrivateData(user.id);
        await fetchPlayerHistory(user.id);
      }
    }
  };

  const openProfile = (player) => {
    setSelectedPlayer(player);
    fetchPlayerHistory(player.id);
  };

  // --- UTILITAIRES ---
  const formatTime = (ms) => {
    if (!ms || ms <= 0) return "00:00:00";
    const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
    const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // --- RENDU : LOGIN ---
  if (!user) return (
    <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm bg-white/5 p-10 rounded-[40px] border border-white/10 backdrop-blur-3xl shadow-2xl">
        <h1 className="text-4xl font-black italic text-center mb-10 text-red-600 uppercase tracking-tighter">Royale Access</h1>
        <div className="space-y-4">
          <input className="w-full bg-white/5 p-5 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all" 
                 placeholder="Prénom" onChange={e => setLoginData({ ...loginData, name: e.target.value })} />
          <input className="w-full bg-white/5 p-5 rounded-2xl border border-white/10 outline-none focus:border-red-600 transition-all" 
                 type="password" placeholder="Pass" onChange={e => setLoginData({ ...loginData, pass: e.target.value })} />
          <button onClick={handleLogin} className="w-full bg-red-600 p-5 rounded-2xl font-black uppercase shadow-lg shadow-red-600/30 hover:scale-[0.98] transition-all">Lancer la Session</button>
        </div>
      </div>
    </div>
  );

  // --- RENDU : INTERFACE PRINCIPALE ---
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 p-4 font-sans selection:bg-red-500/30">
      
      {/* HEADER STICKY */}
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-10 bg-white/5 p-5 rounded-[35px] border border-white/10 backdrop-blur-md sticky top-4 z-50 shadow-2xl">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => openProfile(user)}>
          <div className="w-14 h-14 bg-gradient-to-tr from-red-600 to-orange-500 rounded-full flex items-center justify-center text-2xl font-black shadow-lg">
            {user.name?.[0]}
          </div>
          <div>
            <div className="font-black italic uppercase text-lg">{user.name} <span className="text-red-500 ml-2">{user.points || 0} pts</span></div>
            <div className="flex gap-1 mt-1">
              {[...Array(3)].map((_, i) => (
                <Heart key={i} size={16} className={i < (user.lives ?? 3) ? "text-red-600 fill-red-600" : "text-slate-800"} />
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => setShowRules(true)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all shadow-lg"><Info size={24} /></button>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* MISSIONS EN COURS */}
        <section className="lg:col-span-2 space-y-8">
          <h2 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-slate-600">
            <Zap size={16} className="text-yellow-500 drop-shadow-[0_0_8px_gold]" /> Objectifs Actifs
          </h2>
          
          <AnimatePresence>
            {myGages.map(gage => (
              <motion.div key={gage.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={`p-10 rounded-[50px] border-2 ${GAGE_COLORS[gage.color]?.border} ${GAGE_COLORS[gage.color]?.bg} ${GAGE_COLORS[gage.color]?.shadow} relative overflow-hidden shadow-2xl`}
              >
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className="max-w-[70%]">
                    <h3 className={`text-4xl font-black italic uppercase leading-none mb-4 ${GAGE_COLORS[gage.color]?.text}`}>{gage.title}</h3>
                    <p className="text-slate-300 text-lg leading-relaxed">{gage.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 mb-1 tracking-widest uppercase">Timer</div>
                    <div className="text-2xl font-black font-mono text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]">{formatTime(timeLeft)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-5 relative z-10">
                  <button onClick={() => completeGage(gage.id, gage.points)} className="bg-white text-black font-black py-5 rounded-2xl hover:scale-95 transition-transform uppercase text-sm italic shadow-xl">Réussi (+{gage.points})</button>
                  <button onClick={abandonGage} className="border border-white/20 text-white font-bold py-5 rounded-2xl hover:bg-white/5 transition-colors uppercase text-sm italic shadow-xl">Abandon</button>
                </div>

                <button onClick={() => setShowJokerModal(true)} className="w-full mt-8 flex items-center justify-center gap-2 text-xs uppercase font-black text-slate-500 hover:text-red-500 transition-colors">
                  <ShieldAlert size={16} /> Activer Joker (-1pt)
                </button>
              </motion.div>
            ))}
            {myGages.length === 0 && (
              <div className="h-80 flex flex-col items-center justify-center border-4 border-dashed border-white/5 rounded-[50px] text-slate-700">
                <Ghost size={64} className="mb-6 opacity-10" />
                <p className="font-black uppercase tracking-[0.5em] text-sm italic">Silence Radio...</p>
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* CLASSEMENT */}
        <section className="space-y-8">
          <h2 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.4em] text-slate-600">
            <Trophy size={16} className="text-yellow-500" /> Leaderboard
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-[40px] p-6 space-y-4 shadow-2xl backdrop-blur-xl">
            {players.map((p, i) => (
              <div key={p.id} onClick={() => openProfile(p)} 
                   className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${p.id === user.id ? 'border-red-600 bg-red-600/5 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'border-white/5 bg-white/2 hover:border-white/20'}`}>
                <div className="flex items-center gap-5">
                  <span className={`text-xs font-black ${i < 3 ? 'text-yellow-500 font-mono' : 'text-slate-700'}`}>0{i+1}</span>
                  <div className="font-black uppercase italic text-base">{p.name}</div>
                </div>
                <div className="text-2xl font-black italic text-white">{p.points || 0}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* MODALE JOKER (LISTE DÉROULANTE) */}
      <AnimatePresence>
        {showJokerModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[150] flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#0f0f12] border border-white/10 rounded-[40px] p-8 shadow-2xl">
              <h3 className="text-xl font-black uppercase italic mb-6 text-center text-red-500">Cibler un Joueur</h3>
              <div className="space-y-3">
                {players.filter(p => p.id !== user.id).map(p => (
                  <button key={p.id} onClick={() => handleSendJoker(p.id)} disabled={!!p.current_gage_id}
                          className={`w-full p-4 rounded-2xl border border-white/5 flex justify-between items-center transition-all ${p.current_gage_id ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:bg-white/5 hover:border-red-600'}`}>
                    <span className="font-bold uppercase tracking-widest text-sm">{p.name}</span>
                    {p.current_gage_id ? <span className="text-[10px] text-red-500 font-black">OCCUPÉ</span> : <UserPlus size={18} className="text-green-500" />}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowJokerModal(false)} className="w-full mt-6 text-slate-500 font-bold uppercase text-xs hover:text-white transition-colors">Annuler</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODALE HISTORIQUE (PROFIL) */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPlayer(null)}
                      className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-[#0f0f12] border border-white/10 rounded-[50px] p-12 relative shadow-2xl" onClick={e => e.stopPropagation()}>
              <button className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors" onClick={() => setSelectedPlayer(null)}><X size={24} /></button>
              
              <div className="text-center mb-12">
                <div className="w-24 h-24 bg-red-600 mx-auto rounded-full flex items-center justify-center text-4xl font-black mb-6 shadow-2xl shadow-red-900/50">
                  {selectedPlayer.name?.[0]}
                </div>
                <h2 className="text-4xl font-black uppercase italic mb-2 tracking-tighter">{selectedPlayer.name}</h2>
                <p className="text-red-600 font-black uppercase tracking-[0.4em] text-xs drop-shadow-sm">{selectedPlayer.points} POINTS</p>
              </div>

              <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-white/5 pb-3">Archives des Missions</h3>
                <div className="max-h-72 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                  {playerHistory.length > 0 ? playerHistory.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                      <div className="flex flex-col">
                        <span className="font-black text-sm uppercase italic leading-tight">{item.gage_title}</span>
                        <span className="text-[8px] text-slate-600 font-mono italic opacity-50 mt-1 uppercase">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {selectedPlayer.id === user.id && (
                          <button onClick={() => toggleHistoryStatus(item)} 
                                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-yellow-500 transition-all">
                            <Zap size={16}/>
                          </button>
                        )}
                        {item.status === 'success' ? <CheckCircle2 size={20} className="text-green-500" /> : <AlertCircle size={20} className="text-red-500" />}
                      </div>
                    </div>
                  )) : <div className="text-center text-slate-600 italic py-10 font-bold uppercase text-[10px] tracking-widest">Dossier Vide</div>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RÈGLES DU JEU */}
      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRules(false)}
                      className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-10 text-center overflow-y-auto">
            <div className="max-w-md space-y-10 my-auto">
              <h2 className="text-6xl font-black italic text-red-600 uppercase tracking-tighter drop-shadow-[0_0_15px_rgba(220,38,38,0.3)]">Le Règlement</h2>
              <div className="space-y-8 text-slate-400 text-lg leading-relaxed">
                <p>⏳ <strong className="text-white">DÉLAI</strong> : 3h par mission. L'échec n'est pas une option.</p>
                <p>❤️ <strong className="text-white">VIES</strong> : 3 coeurs au départ. L'abandon coûte 1 coeur. À 0 vie, échec = -1 point.</p>
                <p>🃏 <strong className="text-white">JOKER</strong> : Refile ton défi (-1pt). Si la cible refuse, elle perd 2 points.</p>
              </div>
              
              <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-3xl text-left">
                <h4 className="text-white font-black uppercase text-xs mb-3 flex items-center gap-2">
                  <AlertCircle size={14} /> Connexion WhatsApp
                </h4>
                <p className="text-slate-400 text-[10px] mb-4 leading-relaxed uppercase font-bold tracking-wider">
                  Obligatoire pour les alertes : clique et envoie le message.
                </p>
                <a href="https://wa.me/14155238886?text=join%20many-part" target="_blank" rel="noopener noreferrer"
                   className="block w-full bg-[#25D366] text-white font-black p-4 rounded-2xl text-center text-xs uppercase hover:scale-95 transition-all shadow-xl">
                  Réactiver les alertes
                </a>
              </div>

              <button onClick={() => setShowRules(false)} className="w-full bg-white text-black font-black p-6 rounded-3xl uppercase italic tracking-widest hover:bg-slate-100 transition-all shadow-2xl">Accepter la mission</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}