import {
  FileChunk,
  FileOffer,
  FileTransferMessage,
  TransferProgress,
  FileSession,
} from "../shared/fille-transfer-types";

const CHUNK_SIZE = 16 * 1024;

export class FileTransferService {
  private sendControlMessage: (msg: FileTransferMessage) => void;
  private sendChunk: (chunk: FileChunk) => void;

  private availableFiles = new Map<string, FileOffer>();
  private sessions = new Map<string, FileSession>();

  private onAvailableHandler: ((files: FileOffer[]) => void) | null = null;
  private onProgressHandler: ((p: TransferProgress) => void) | null = null;
  private onCompleteHandler: ((file: File) => void) | null = null;

  constructor(opts: {
    sendControlMessage: (msg: FileTransferMessage) => void;
    sendChunk: (chunk: FileChunk) => void;
  }) {
    this.sendControlMessage = opts.sendControlMessage;
    this.sendChunk = opts.sendChunk;
  }

  // =========================================================
  // OFFER FILE (UPLOAD INITIATION)
  // =========================================================
  public offer(file: File): void {
    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    this.availableFiles.set(fileId, {
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });

    this.sendControlMessage({
      type: "file-offer",
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      chunkSize: CHUNK_SIZE,
    });

    this.streamFile(file, fileId, CHUNK_SIZE, totalChunks);
  }

  private async streamFile(
    file: File,
    fileId: string,
    chunkSize: number,
    totalChunks: number,
  ) {
    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const slice = file.slice(start, start + chunkSize);

      const buffer = await slice.arrayBuffer();

      this.sendChunk({
        fileId,
        index,
        data: buffer,
      });
    }

    this.sendControlMessage({
      type: "file-complete",
      fileId,
    });
  }

  // =========================================================
  // REQUEST FILE (DOWNLOAD INITIATION)
  // =========================================================
  public request(fileId: string): void {
    this.sendControlMessage({
      type: "file-request",
      fileId,
    });
  }

  // =========================================================
  // INCOMING CONTROL MESSAGES
  // =========================================================
  public handleControlMessage(message: FileTransferMessage): void {
    switch (message.type) {
      case "file-offer": {
        this.sessions.set(message.fileId, {
          fileId: message.fileId,
          name: message.name,
          mimeType: message.mimeType,
          size: message.size,
          chunks: new Map(),
          receivedBytes: 0,
          totalChunks: Math.ceil(message.size / CHUNK_SIZE),
        });

        this.emitAvailable();
        break;
      }

      case "file-request": {
        console.log("requested to download", message.fileId);
        break;
      }

      case "file-complete": {
        console.log("download finished", this.sessions);
        break;
      }
    }
  }

  // =========================================================
  // INCOMING CHUNKS
  // =========================================================
  public handleChunk(chunk: FileChunk): void {
    let session = this.sessions.get(chunk.fileId);

    if (!session) {
      throw new Error("Missing file session (offer not received yet)");
    }

    session.chunks.set(chunk.index, chunk.data);
    session.receivedBytes += chunk.data.byteLength;

    this.emitProgress(session);

    // check completion
    if (session.chunks.size === session.totalChunks) {
      const file = this.reconstructFile(session);
      this.onCompleteHandler?.(file);
      this.downloadFile(file);
      this.sessions.delete(chunk.fileId);
    }
  }

  // =========================================================
  // RECONSTRUCTION
  // =========================================================
  private reconstructFile(session: FileSession): File {
    const buffers: ArrayBuffer[] = [];

    for (let i = 0; i < session.totalChunks; i++) {
      const chunk = session.chunks.get(i);
      if (!chunk) throw new Error("Missing chunk " + i);
      buffers.push(chunk);
    }

    const blob = new Blob(buffers, {
      type: session.mimeType,
    });

    return new File([blob], session.name, {
      type: session.mimeType,
    });
  }

  // =========================================================
  // EVENTS
  // =========================================================
  public onAvailableFiles(handler: (files: FileOffer[]) => void): void {
    this.onAvailableHandler = handler;
  }

  public onProgress(handler: (p: TransferProgress) => void): void {
    this.onProgressHandler = handler;
  }

  public onFileReceived(handler: (file: File) => void): void {
    this.onCompleteHandler = handler;
  }

  // =========================================================
  // HELPERS
  // =========================================================
  private emitAvailable() {
    this.onAvailableHandler?.(Array.from(this.availableFiles.values()));
  }

  private emitProgress(session: FileSession) {
    this.onProgressHandler?.({
      fileId: session.fileId,
      receivedBytes: session.receivedBytes,
      totalBytes: session.size || session.receivedBytes,
    });
  }

  private downloadFile(file: File): void {
    const url = URL.createObjectURL(file);

    const a = document.createElement("a");
    a.href = url;
    a.download = file.name; // 👈 THIS is the key
    document.body.appendChild(a);

    a.click();

    a.remove();
    URL.revokeObjectURL(url);
  }
}
