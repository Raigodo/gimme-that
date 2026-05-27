"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

type RTCProviderContextType = { client: RTCPeerConnection | null };

const RTCProviderContext = createContext<RTCProviderContextType>({
  client: null,
});

function RTCProviderProvider({ children }: PropsWithChildren) {
  const [client, setClient] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    const peerConnection = new RTCPeerConnection(servers);
    setClient(peerConnection);
    return () => {
      peerConnection.close();
    };
  }, []);

  return (
    <RTCProviderContext.Provider value={{ client }}>
      {children}
    </RTCProviderContext.Provider>
  );
}

export default RTCProviderProvider;

export function useRTCClient() {
  return useContext(RTCProviderContext).client;
}
