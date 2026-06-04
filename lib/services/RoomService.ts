import { ulid } from "ulid";
import { RoomId } from "../shared/ids";
import { PeerService } from "./PeerService";
import { SignalingService } from "./SignallingService";
import { FileTransferService } from "./FileTransferService";

export class RoomService {
  private readonly signaling: SignalingService;
  private readonly peer: PeerService;
  private readonly fileTransfer: FileTransferService;

  private roomId: RoomId | null = null;

  private messageHandler: ((message: unknown) => void) | null = null;

  private signalAttached = false;

  constructor() {
    this.signaling = new SignalingService();
    this.peer = new PeerService();
    this.fileTransfer = new FileTransferService({
      sendControlMessage: (msg) => this.peer.sendFileControlMessage(msg),
      sendChunk: (chunk) => this.peer.sendFileChunk(chunk),
    });

    this.peer.onSignal((signal) => {
      this.signaling.send(signal);
    });

    this.peer.onControlMessage((message) => {
      this.messageHandler?.(message);
    });

    this.peer.onFileChunk((msg) => {
      console.log("Received file chunk:", msg);
      this.fileTransfer.handleChunk(msg);
    });

    this.peer.onFileControlMessage((msg) => {
      this.fileTransfer.handleControlMessage(msg);
    });
  }

  public get files(): FileTransferService {
    return this.fileTransfer;
  }

  // =========================================================
  // ROOM CREATION
  // =========================================================
  public async createRoom(): Promise<RoomId> {
    const roomId = ulid() as RoomId;

    await this.signaling.joinRoom(roomId);
    this.attachSignalHandler();

    this.roomId = roomId;

    return roomId;
  }

  public async joinRoom(roomId: RoomId): Promise<void> {
    await this.signaling.joinRoom(roomId);
    this.attachSignalHandler();

    this.roomId = roomId;

    // joiner becomes offerer
    await this.peer.createOffer();
  }

  // =========================================================
  // CONTROL MESSAGE
  // =========================================================
  public sendMessage(message: unknown): void {
    this.peer.sendControlMessage(message);
  }

  public onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  // =========================================================
  // CLEANUP
  // =========================================================
  public async leaveRoom(): Promise<void> {
    this.peer.close();
    await this.signaling.leaveRoom();

    this.roomId = null;
  }

  // =========================================================
  // SIGNAL BRIDGE
  // =========================================================
  private attachSignalHandler() {
    if (this.signalAttached) return;

    this.signalAttached = true;

    this.signaling.onSignal((signal) => {
      this.peer.handleSignal(signal);
    });
  }
}
