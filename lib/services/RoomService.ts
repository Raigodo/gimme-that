import { ulid } from "ulid";
import { RoomId } from "../shared/ids";
import { PeerService } from "./PeerService";
import { SignalingService } from "./SignallingService";

export class RoomService {
  private readonly signaling: SignalingService;

  private readonly peer: PeerService;

  private roomId: RoomId | null = null;

  private messageHandler: ((message: unknown) => void) | null = null;

  private signalAttached = false;

  constructor() {
    this.signaling = new SignalingService();

    this.peer = new PeerService();

    this.peer.onSignal((signal) => {
      this.signaling.send(signal);
    });

    this.peer.onMessage((message) => {
      this.messageHandler?.(message);
    });
  }

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

    await this.peer.createOffer();
  }

  public send(message: unknown): void {
    this.peer.send(message);
  }

  public async leaveRoom(): Promise<void> {
    this.peer.close();

    await this.signaling.leaveRoom();

    this.roomId = null;
  }

  public onMessage(handler: (message: unknown) => void): void {
    this.messageHandler = handler;
  }

  private attachSignalHandler() {
    if (this.signalAttached) return;

    this.signalAttached = true;

    this.signaling.onSignal((signal) => {
      this.peer.handleSignal(signal);
    });
  }
}
