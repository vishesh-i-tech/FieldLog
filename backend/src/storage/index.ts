import * as fs from 'fs';
import * as path from 'path';

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface IStorageProvider {
  generatePresignedUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds?: number
  ): Promise<PresignedUploadResult>;
  getDownloadUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(storageKey: string): Promise<boolean>;
}

/**
 * Local development storage stub for Phases 0-2.
 * Stores binary files in local directory and simulates presigned URLs.
 */
export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;
  private serverBaseUrl: string;

  constructor(baseDir = './uploads', serverBaseUrl = 'http://localhost:4000') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.serverBaseUrl = serverBaseUrl;

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async generatePresignedUploadUrl(
    storageKey: string,
    _mimeType: string,
    expiresInSeconds = 300
  ): Promise<PresignedUploadResult> {
    // Local dev mock upload URL
    const uploadUrl = `${this.serverBaseUrl}/api/v1/dev-storage/upload?key=${encodeURIComponent(storageKey)}`;
    return {
      uploadUrl,
      storageKey,
      expiresInSeconds,
    };
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `${this.serverBaseUrl}/api/v1/dev-storage/files/${storageKey}`;
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

// Default export provider instance
export const storageProvider: IStorageProvider = new LocalStorageProvider();
