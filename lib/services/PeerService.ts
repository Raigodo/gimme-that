import { SignalMessage } from "../shared/SignallingMessage";

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

export class PeerService {
  private readonly peerConnection: RTCPeerConnection;

  private dataChannel: RTCDataChannel | null = null;

  private messageHandler: ((message: unknown) => void) | null = null;

  private signalHandler: ((signal: SignalMessage) => void) | null = null;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);

    this.setupPeerConnection();
  }

  public async createOffer(): Promise<void> {
    this.dataChannel = this.peerConnection.createDataChannel("chat");

    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();

    await this.peerConnection.setLocalDescription(offer);

    this.signalHandler?.({
      type: "offer",
      payload: offer,
    });
  }

  public async handleSignal(signal: SignalMessage): Promise<void> {
    switch (signal.type) {
      case "offer": {
        await this.handleOffer(signal.payload);
        break;
      }

      case "answer": {
        await this.handleAnswer(signal.payload);
        break;
      }

      case "ice-candidate": {
        await this.handleIceCandidate(signal.payload);
        break;
      }
    }
  }

  public send(data: unknown): void {
    if (!this.dataChannel) {
      throw new Error("Data channel not created");
    }

    if (this.dataChannel.readyState !== "open") {
      throw new Error("Data channel not open");
    }

    this.dataChannel.send(JSON.stringify(data));
  }

  public close(): void {
    this.dataChannel?.close();
    this.peerConnection.close();
  }

  public onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  public onSignal(handler: (signal: SignalMessage) => void): void {
    this.signalHandler = handler;
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (this.peerConnection.signalingState !== "stable") {
      console.warn(
        "Ignoring offer, invalid state:",
        this.peerConnection.signalingState,
      );
      return;
    }

    await this.peerConnection.setRemoteDescription(offer);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.signalHandler?.({
      type: "answer",
      payload: answer,
    });
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (this.peerConnection.signalingState !== "have-local-offer") {
      console.warn(
        "Ignoring answer, invalid state:",
        this.peerConnection.signalingState,
      );
      return;
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  private async handleIceCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    // If remote description is NOT ready yet → queue it
    if (!this.peerConnection.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  private setupPeerConnection(): void {
    this.peerConnection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }

      this.signalHandler?.({
        type: "ice-candidate",
        payload: event.candidate.toJSON(),
      });
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;

      this.setupDataChannel(event.channel);
    };
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        this.messageHandler?.(message);
      } catch {
        this.messageHandler?.(event.data);
      }
    };
  }
}
