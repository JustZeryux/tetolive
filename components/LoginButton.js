"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../utils/Supabase';

export default function LoginButton() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obtener la sesión inicial
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    };

    getInitialSession();

    // 2. Escuchar cambios de autenticación (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Estado de Auth cambiado:", _event, session?.user); // <-- Esto te ayudará a debuggear
        setUser(session?.user || null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'discord',
          options: {
            redirectTo: window.location.origin, 
            scopes: 'identify email', // <-- AGREGA ESTA LÍNEA AQUÍ
          },
        });
        if (error) console.error("Error al iniciar sesión:", error.message);
      };

  if (loading) {
    return <div className="text-gray-400 text-sm animate-pulse">Cargando...</div>;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col text-right">
          <span className="text-white font-bold text-sm">
            {user.user_metadata?.custom_claims?.global_name || user.user_metadata?.name || 'Usuario'}
          </span>
           <button 
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) console.error("Error al cerrar sesión:", error.message);
            }} 
            className="text-red-400 text-[10px] font-bold tracking-widest uppercase hover:text-red-300 text-right"
          >
            SALIR
          </button>
        </div>
        <img 
          src={user.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
          alt="Avatar" 
          className="w-10 h-10 rounded-full bg-[#222630] border-2 border-[#facc15]"
        />
      </div>
    );
  }

  return (
    <button 
      onClick={handleLogin}
      className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2 px-4 rounded text-sm transition-colors"
    >
      Login con Discord
    </button>
  );
}
