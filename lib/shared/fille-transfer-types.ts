export type IncomingFile = {
  fileId: string;
  chunks: ArrayBuffer[];
};

export type FileChunk = {
  fileId: string;
  index: number;
  data: ArrayBuffer;
};

export type FileOffer = {
  fileId: string;
  name: string;
  size: number;
  mimeType: string;
};

export type TransferProgress = {
  fileId: string;
  receivedBytes: number;
  totalBytes: number;
};

export type FileTransferMessage =
  | {
      type: "file-offer";
      fileId: string;
      name: string;
      size: number;
      mimeType: string;
      chunkSize: number;
    }
  | {
      type: "file-request";
      fileId: string;
    }
  | {
      type: "file-accept";
      fileId: string;
    }
  | {
      type: "file-complete";
      fileId: string;
    };

export type FileSession = {
  fileId: string;
  name: string;
  mimeType: string;
  size: number;

  chunks: Map<number, ArrayBuffer>;
  receivedBytes: number;
  totalChunks: number;
};
