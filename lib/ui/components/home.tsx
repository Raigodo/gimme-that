"use client";

import { useEffect, useRef, useState } from "react";

import { RoomId } from "@/lib/shared/ids";
import { RoomService } from "@/lib/services/RoomService";

export default function Home() {
  const roomRef = useRef<RoomService | null>(null);

  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const room = new RoomService();

    room.onMessage((message) => {
      setMessages((previous) => [...previous, `REMOTE: ${String(message)}`]);
    });

    roomRef.current = room;

    return () => {
      room.leaveRoom();
    };
  }, []);

  async function createRoom() {
    if (!roomRef.current) {
      return;
    }

    const roomId = await roomRef.current.createRoom();

    setRoomId(roomId);

    setMessages((previous) => [...previous, `Created room: ${roomId}`]);
  }

  async function joinRoom() {
    if (!roomRef.current) {
      return;
    }

    await roomRef.current.joinRoom(roomId as RoomId);

    setMessages((previous) => [...previous, `Joined room: ${roomId}`]);
  }

  function sendMessage() {
    if (!roomRef.current) {
      return;
    }

    if (!message.trim()) {
      return;
    }

    roomRef.current.send(message);

    setMessages((previous) => [...previous, `ME: ${message}`]);

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
