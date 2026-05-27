"use client";

import { useRef, useState } from "react";
import { useFirestore } from "./firebase-provider";
import { useRTCClient } from "./rtc-provider";

export default function Home() {
  const firestore = useFirestore();

  const pc = useRTCClient();

  const [roomId, setRoomId] = useState("");

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<string[]>([]);

  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  function setupDataChannel(channel: RTCDataChannel) {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      console.log("data channel open");
    };

    channel.onclose = () => {
      console.log("data channel closed");
    };

    channel.onmessage = (event: MessageEvent<string>) => {
      console.log("incoming:", event.data);

      setMessages((prev) => [...prev, `peer: ${event.data}`]);
    };
  }

  async function createRoom() {
    if (!firestore || !pc || !firestore.client) return;

    const roomRef = firestore.doc(
      firestore.client,
      "rooms",
      crypto.randomUUID(),
    );

    setRoomId(roomRef.id);

    const channel = pc.createDataChannel("chat");

    setupDataChannel(channel);

    pc.onconnectionstatechange = () => {
      console.log("connection state:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ice connection state:", pc.iceConnectionState);
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;

      await firestore.updateDoc(roomRef, {
        callerCandidates: firestore.arrayUnion(event.candidate.toJSON()),
      });
    };

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    await firestore.setDoc(roomRef, {
      createdAt: firestore.serverTimestamp(),

      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },

      callerCandidates: [],
      calleeCandidates: [],
    });

    firestore.onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();

      if (!data) return;

      if (data.answer && !pc.currentRemoteDescription) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      if (data.calleeCandidates) {
        for (const candidate of data.calleeCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {}
        }
      }
    });
  }

  async function joinRoom() {
    if (!firestore || !pc || !firestore.client || !roomId) return;

    const roomRef = firestore.doc(firestore.client, "rooms", roomId);

    const roomSnapshot = await firestore.getDoc(roomRef);

    const roomData = roomSnapshot.data();

    if (!roomData) {
      console.log("room not found");
      return;
    }

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    pc.onconnectionstatechange = () => {
      console.log("connection state:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ice connection state:", pc.iceConnectionState);
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;

      await firestore.updateDoc(roomRef, {
        calleeCandidates: firestore.arrayUnion(event.candidate.toJSON()),
      });
    };

    await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));

    const answer = await pc.createAnswer();

    await pc.setLocalDescription(answer);

    await firestore.updateDoc(roomRef, {
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });

    firestore.onSnapshot(roomRef, async (snapshot) => {
      const data = snapshot.data();

      if (!data?.callerCandidates) return;

      for (const candidate of data.callerCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {}
      }
    });
  }

  function sendMessage() {
    if (!dataChannelRef.current) {
      console.log("no data channel");
      return;
    }

    if (dataChannelRef.current.readyState !== "open") {
      console.log("data channel not open");
      return;
    }

    if (!message.trim()) return;

    dataChannelRef.current.send(message);

    setMessages((prev) => [...prev, `me: ${message}`]);

    setMessage("");
  }

  return (
    <main>
      <button onClick={createRoom}>Create Room</button>

      <br />

      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="room id"
      />

      <button onClick={joinRoom}>Join Room</button>

      <br />
      <br />

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="message"
      />

      <button onClick={sendMessage}>Send</button>

      <br />
      <br />

      <div>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
    </main>
  );
}
