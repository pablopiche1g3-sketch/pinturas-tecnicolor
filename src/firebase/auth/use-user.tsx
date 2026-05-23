'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

/**
 * Hook que gestiona el estado de autenticación de Firebase.
 * - `user`  : objeto `User` cuando hay sesión activa, o `null`.
 * - `loading` : `true` mientras Firebase determina el estado inicial.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Usa la instancia por defecto de Firebase (inicializada en index.ts)
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { user, loading };
}
