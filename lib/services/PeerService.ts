import { SignalMessage } from "../shared/control-types";
import { FileChunk, FileTransferMessage } from "../shared/fille-transfer-types";

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

// =========================================================
// PEER SERVICE
// =========================================================
export class PeerService {
  private readonly peerConnection: RTCPeerConnection;

  private controlDataChannel: RTCDataChannel | null = null;
  private fileControlChannel: RTCDataChannel | null = null;
  private fileDataChannel: RTCDataChannel | null = null;

  private controlMessageHandler: ((message: unknown) => void) | null = null;
  private fileControlMessageHandler:
    | ((message: FileTransferMessage) => void)
    | null = null;
  private fileChunkHandler: ((chunk: FileChunk) => void) | null = null;

  private signalHandler: ((signal: SignalMessage) => void) | null = null;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  constructor() {
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);
    this.setupPeerConnection();
  }

  // =========================================================
  // OFFERER SIDE
  // =========================================================
  public async createOffer(): Promise<void> {
    this.controlDataChannel = this.peerConnection.createDataChannel("control");
    this.fileControlChannel =
      this.peerConnection.createDataChannel("file-control");
    this.fileDataChannel = this.peerConnection.createDataChannel("file");

    this.setupControlChannel(this.controlDataChannel);
    this.setupFileControlChannel(this.fileControlChannel);
    this.setupFileChannel(this.fileDataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.signalHandler?.({
      type: "offer",
      payload: offer,
    });
  }

  // =========================================================
  // SIGNAL HANDLING
  // =========================================================
  public async handleSignal(signal: SignalMessage): Promise<void> {
    switch (signal.type) {
      case "offer":
        await this.handleOffer(signal.payload);
        break;

      case "answer":
        await this.handleAnswer(signal.payload);
        break;

      case "ice-candidate":
        await this.handleIceCandidate(signal.payload);
        break;
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (this.peerConnection.signalingState !== "stable") {
      console.warn(
        "Ignoring offer, state:",
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
        "Ignoring answer, state:",
        this.peerConnection.signalingState,
      );
      return;
    }

    await this.peerConnection.setRemoteDescription(answer);
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.peerConnection.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }

    await this.peerConnection.addIceCandidate(candidate);
  }

  // =========================================================
  // CONTROL CHANNEL API
  // =========================================================
  public sendControlMessage(data: unknown): void {
    if (
      !this.controlDataChannel ||
      this.controlDataChannel.readyState !== "open"
    ) {
      throw new Error("Control channel not ready");
    }

    this.controlDataChannel.send(JSON.stringify(data));
  }

  public onControlMessage(handler: (message: unknown) => void): void {
    this.controlMessageHandler = handler;
  }

  // =========================================================
  // FILE CONTROL CHANNEL API
  // =========================================================
  public sendFileControlMessage(data: FileTransferMessage): void {
    if (!this.fileControlChannel) {
      throw new Error("File control channel not defined");
    }

    if (
      !this.fileControlChannel ||
      this.fileControlChannel.readyState !== "open"
    ) {
      throw new Error("File control channel not ready");
    }

    this.fileControlChannel.send(JSON.stringify(data));
  }

  public onFileControlMessage(
    handler: (message: FileTransferMessage) => void,
  ): void {
    this.fileControlMessageHandler = handler;
  }

  // =========================================================
  // FILE CHANNEL API
  // =========================================================
  public sendFileChunk(chunk: FileChunk): void {
    if (!this.fileDataChannel || this.fileDataChannel.readyState !== "open") {
      throw new Error("File channel not ready");
    }

    const fileIdBytes = new TextEncoder().encode(chunk.fileId);

    const buffer = new ArrayBuffer(
      4 + fileIdBytes.byteLength + 4 + chunk.data.byteLength,
    );

    const view = new DataView(buffer);

    let offset = 0;

    // fileId length
    view.setUint32(offset, fileIdBytes.byteLength);
    offset += 4;

    // fileId
    new Uint8Array(buffer, offset, fileIdBytes.byteLength).set(fileIdBytes);
    offset += fileIdBytes.byteLength;

    // index
    view.setUint32(offset, chunk.index);
    offset += 4;

    // payload
    new Uint8Array(buffer, offset).set(new Uint8Array(chunk.data));

    this.fileDataChannel.send(buffer);
  }

  public onFileChunk(handler: (chunk: FileChunk) => void): void {
    this.fileChunkHandler = handler;
  }

  // =========================================================
  // CLOSE
  // =========================================================
  public close(): void {
    this.controlDataChannel?.close();
    this.fileDataChannel?.close();
    this.peerConnection.close();
  }

  public onSignal(handler: (signal: SignalMessage) => void): void {
    this.signalHandler = handler;
  }

  // =========================================================
  // INTERNAL SETUP
  // =========================================================
  private setupPeerConnection(): void {
    this.peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;

      this.signalHandler?.({
        type: "ice-candidate",
        payload: event.candidate.toJSON(),
      });
    };

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;

      if (channel.label === "control") {
        this.controlDataChannel = channel;
        this.setupControlChannel(channel);
      }

      if (channel.label === "file-control") {
        this.fileControlChannel = channel;
        this.setupFileControlChannel(channel);
      }

      if (channel.label === "file") {
        this.fileDataChannel = channel;
        this.setupFileChannel(channel);
      }
    };
  }

  // =========================================================
  // CHANNEL SETUP
  // =========================================================
  private setupControlChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.controlMessageHandler?.(message);
      } catch {
        this.controlMessageHandler?.(event.data);
      }
    };
  }

  private setupFileControlChannel(channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.fileControlMessageHandler?.(message);
      } catch {
        this.fileControlMessageHandler?.(event.data);
      }
    };
  }

  private setupFileChannel(channel: RTCDataChannel): void {
    channel.binaryType = "arraybuffer";

    channel.onmessage = (event) => {
      const buffer = event.data as ArrayBuffer;
      const view = new DataView(buffer);

      let offset = 0;

      const fileIdLen = view.getUint32(offset);
      offset += 4;

      const fileId = new TextDecoder().decode(
        buffer.slice(offset, offset + fileIdLen),
      );
      offset += fileIdLen;

      const index = view.getUint32(offset);
      offset += 4;

      const data = buffer.slice(offset);

      this.fileChunkHandler?.({
        fileId,
        index,
        data,
      });
    };
  }
}
