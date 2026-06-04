"use client";

import { useEffect, useRef, useState } from "react";
import { RoomService } from "@/lib/services/RoomService";
import { RoomId } from "@/lib/shared/ids";
import { IncomingFile } from "@/lib/shared/fille-transfer-types";

export default function Home() {
  const roomRef = useRef<RoomService | null>(null);

  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const fileStore = useRef<Map<string, IncomingFile>>(new Map());

  useEffect(() => {
    const room = new RoomService();

    // =====================================================
    // CONTROL MESSAGES
    // =====================================================
    room.onMessage((msg) => {
      setMessages((prev) => [...prev, `REMOTE: ${JSON.stringify(msg)}`]);
    });

    // =====================================================
    // FILE PROGRESS (optional debug)
    // =====================================================
    room.files.onProgress?.((p) => {
      setMessages((prev) => [
        ...prev,
        `FILE PROGRESS: ${p.fileId} ${p.receivedBytes}/${p.totalBytes}`,
      ]);
    });

    // =====================================================
    // FILE RECEIVED (FINAL RESULT)
    // =====================================================
    room.files.onFileReceived?.((file) => {
      setMessages((prev) => [
        ...prev,
        `FILE RECEIVED: ${file.name} (${file.size} bytes)`,
      ]);
    });

    roomRef.current = room;

    return () => {
      room.leaveRoom();
    };
  }, []);

  // =========================================================
  // ROOM
  // =========================================================
  async function createRoom() {
    if (!roomRef.current) return;

    const id = await roomRef.current.createRoom();
    setRoomId(id);

    setMessages((p) => [...p, `Created room: ${id}`]);
  }

  async function joinRoom() {
    if (!roomRef.current) return;

    await roomRef.current.joinRoom(roomId as RoomId);

    setMessages((p) => [...p, `Joined room: ${roomId}`]);
  }

  // =========================================================
  // CHAT
  // =========================================================
  function sendMessage() {
    if (!roomRef.current || !message.trim()) return;

    roomRef.current.sendMessage(message);

    setMessages((p) => [...p, `ME: ${message}`]);
    setMessage("");
  }

  // =========================================================
  // FILE SEND (NEW ARCHITECTURE)
  // =========================================================
  function sendFile() {
    if (!roomRef.current || !file) return;

    setMessages((p) => [...p, `Sending file: ${file.name}`]);

    roomRef.current.files.offer(file);

    setMessages((p) => [...p, `File offered: ${file.name}`]);
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

      {/* CHAT */}
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="message"
      />

      <button onClick={sendMessage}>Send</button>

      <br />
      <br />

      {/* FILE */}
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button onClick={sendFile}>Send File</button>

      <br />
      <br />

      {/* LOG */}
      <div>
        {messages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>
    </main>
  );
}
