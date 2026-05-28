'use client';

import React, { useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

/**
 * Proveedor de cliente para Firebase.
 * Este componente asegura que las instancias de Firebase se inicialicen 
 * y se pasen correctamente a través del contexto de React solo en el cliente.
 */
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Inicializamos Firebase solo una vez en el cliente
  const { firebaseApp, firestore, auth, storage } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      firestore={firestore}
      auth={auth}
      storage={storage}
    >
      {children}
    </FirebaseProvider>
  );
}
