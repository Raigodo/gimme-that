"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

import { getApp, getApps, initializeApp } from "firebase/app";

import {
  getFirestore,
  collection,
  addDoc,
  getDoc,
  updateDoc,
  setDoc,
  doc,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDuN-Q-04J8GRh4DllvvJWYWE_9QjB_co4",
  authDomain: "gimme-that-c0fde.firebaseapp.com",
  projectId: "gimme-that-c0fde",
  storageBucket: "gimme-that-c0fde.firebasestorage.app",
  messagingSenderId: "1077904519946",
  appId: "1:1077904519946:web:641d444a4c186c2028c0f3",
  measurementId: "G-56X2E3XG5R",
};

type FirebaseProviderContextType = {
  firestore: {
    client: ReturnType<typeof getFirestore> | null;

    collection: typeof collection;
    addDoc: typeof addDoc;
    getDoc: typeof getDoc;
    updateDoc: typeof updateDoc;

    setDoc: typeof setDoc;
    doc: typeof doc;
    onSnapshot: typeof onSnapshot;
    arrayUnion: typeof arrayUnion;
    serverTimestamp: typeof serverTimestamp;
  };
};

const FirebaseProviderContext =
  createContext<FirebaseProviderContextType | null>(null);

function FirebaseProvider({ children }: PropsWithChildren) {
  const [firestoreClient, setFirestoreClient] = useState<ReturnType<
    typeof getFirestore
  > | null>(null);

  useEffect(() => {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    setFirestoreClient(getFirestore(app));
  }, []);

  return (
    <FirebaseProviderContext.Provider
      value={{
        firestore: {
          client: firestoreClient,

          collection,
          addDoc,
          getDoc,
          updateDoc,

          setDoc,
          doc,
          onSnapshot,
          arrayUnion,
          serverTimestamp,
        },
      }}
    >
      {children}
    </FirebaseProviderContext.Provider>
  );
}

export default FirebaseProvider;

export function useFirestore() {
  return useContext(FirebaseProviderContext)?.firestore ?? null;
}
