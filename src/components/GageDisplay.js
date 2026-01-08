import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('TA_SUPABASE_URL', 'TA_SUPABASE_ANON_KEY');

export default function GageDisplay({ playerName }) {
  const [player, setPlayer] = useState(null);
  const [gage, setGage] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Récupérer les infos du joueur et son gage
  const fetchData = async () => {
    setLoading(true);
    
    // On récupère le joueur
    const { data: playerData } = await supabase
      .from('players')
      .select('*')
      .eq('name', playerName)
      .single();

    if (playerData) {
      setPlayer(playerData);
      
      // Si le joueur a un gage en cours, on récupère les détails du gage
      if (playerData.current_gage_id) {
        const { data: gageData } = await supabase
          .from('gages')
          .select('*')
          .eq('id', playerData.current_gage_id)
          .single();
        setGage(gageData);
      } else {
        setGage(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Optionnel : s'abonner aux changements en temps réel
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players' }, fetchData)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [playerName]);

  // 2. Action : Valider le gage
  const handleValidate = async () => {
    if (!player) return;

    const { error } = await supabase
      .from('players')
      .update({ 
        points: player.points + 1, 
        current_gage_id: null,
        gage_status: 'completed' 
      })
      .eq('id', player.id);

    if (!error) {
      alert("Bien joué ! +1 point !");
      fetchData(); // Rafraîchir l'affichage
    }
  };

  if (loading) return <p>Chargement du défi...</p>;

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Salut {playerName} ! 🏔️</h1>
      <p>Tes points : <strong>{player?.points || 0}</strong></p>
      
      <hr />

      {gage ? (
        <div style={{ background: '#f0f0f0', padding: '20px', borderRadius: '10px', border: '2px solid #333' }}>
          <h2 style={{ color: '#e63946' }}>🔥 TON DÉFI : {gage.title}</h2>
          <p>{gage.description}</p>
          <button 
            onClick={handleValidate}
            style={{ padding: '10px 20px', fontSize: '18px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
          >
            J'ai fini mon gage ! ✅
          </button>
        </div>
      ) : (
        <div>
          <p>Pas de gage pour l'instant... Profite de l'apéro ! 🍻</p>
          <button onClick={fetchData} style={{ fontSize: '12px' }}>Actualiser</button>
        </div>
      )}
    </div>
  );
}