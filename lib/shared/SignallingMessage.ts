export type SignalMessage =
  | {
      type: "offer";
      payload: RTCSessionDescriptionInit;
    }
  | {
      type: "answer";
      payload: RTCSessionDescriptionInit;
    }
  | {
      type: "ice-candidate";
      payload: RTCIceCandidateInit;
    };
