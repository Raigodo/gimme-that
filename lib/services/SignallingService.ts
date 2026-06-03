import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { RoomId } from "../shared/ids";
import { SignalMessage } from "../shared/SignallingMessage";

const firebaseConfig = {
  apiKey: "AIzaSyDuN-Q-04J8GRh4DllvvJWYWE_9QjB_co4",
  authDomain: "gimme-that-c0fde.firebaseapp.com",
  projectId: "gimme-that-c0fde",
  storageBucket: "gimme-that-c0fde.firebasestorage.app",
  messagingSenderId: "1077904519946",
  appId: "1:1077904519946:web:641d444a4c186c2028c0f3",
  measurementId: "G-56X2E3XG5R",
};

export class SignalingService {
  private firestore: Firestore;

  private roomId: RoomId | null = null;

  private unsubscribe: (() => void) | null = null;

  constructor() {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

    this.firestore = getFirestore(app);
  }

  public async joinRoom(roomId: RoomId): Promise<void> {
    this.roomId = roomId;
  }

  public async leaveRoom(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.roomId = null;
  }

  public async send(signal: SignalMessage): Promise<void> {
    if (!this.roomId) {
      throw new Error("Not connected to a room");
    }

    await addDoc(collection(this.firestore, "rooms", this.roomId, "signals"), {
      ...signal,
      createdAt: Timestamp.now(),
    });
  }

  public onSignal(handler: (signal: SignalMessage) => void): () => void {
    if (!this.roomId) {
      throw new Error("Join room first");
    }

    const signalsRef = collection(
      this.firestore,
      "rooms",
      this.roomId,
      "signals",
    );

    const q = query(signalsRef, orderBy("createdAt", "asc"));

    this.unsubscribe?.();

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") {
          return;
        }

        const data = change.doc.data();

        handler(data as SignalMessage);
      });
    });

    return () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    };
  }
}
