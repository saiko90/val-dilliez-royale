import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');

  const handleLogin = async () => {
    const { data, error } = await supabase.from('players').select('*').eq('name', name).eq('password', pass).single();
    if (data) {
      localStorage.setItem('valDIlliezUser', JSON.stringify(data));
      onLogin(data);
    } else { alert("Erreur d'identification !"); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-3xl font-black italic mb-8 uppercase text-red-500">Connexion</h1>
      <input className="bg-white/10 p-4 rounded-xl mb-4 w-full" placeholder="Prénom" onChange={e => setName(e.target.value)} />
      <input className="bg-white/10 p-4 rounded-xl mb-8 w-full" type="password" placeholder="Mot de passe" onChange={e => setPass(e.target.value)} />
      <button onClick={handleLogin} className="bg-red-600 w-full p-4 rounded-xl font-bold uppercase">Entrer dans la Royale</button>
    </div>
  );
}