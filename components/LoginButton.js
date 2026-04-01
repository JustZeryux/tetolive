"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../utils/Supabase';

export default function LoginButton() {
  const [user, setUser] = useState(null);

  // Comprobar si ya hay una sesión activa al cargar la página
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    // Escuchar cambios (cuando inicia o cierra sesión)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        // Esto redirigirá de vuelta a tu página principal después del login
        redirectTo: window.location.origin, 
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    // Si está logueado, mostramos su foto y botón de salir
    return (
      <div className="flex items-center gap-4">
        <img 
          src={user.user_metadata.avatar_url} 
          alt="Avatar" 
          className="w-10 h-10 rounded-full border-2 border-[#1E2532]"
        />
        <div className="flex flex-col">
          <span className="text-white font-bold">{user.user_metadata.custom_claims?.global_name || 'Usuario'}</span>
          <button onClick={handleLogout} className="text-red-400 text-xs text-left hover:text-red-300">
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // Si no está logueado, mostramos el botón de Discord
  return (
    <button 
      onClick={handleLogin}
      className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2 px-4 rounded transition-colors"
    >
      Login con Discord
    </button>
  );
}
