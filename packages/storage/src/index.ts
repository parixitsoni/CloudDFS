import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  forcePathStyle?: boolean;
}

export class CloudStorageProvider {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private isFallbackMode: boolean = false;
  private fallbackDir: string;

  constructor(config?: StorageConfig) {
    const endpoint = config?.endpoint || process.env.S3_ENDPOINT;
    const region = config?.region || process.env.S3_REGION || "auto";
    const accessKeyId = config?.accessKeyId || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY;
    this.bucketName = config?.bucketName || process.env.S3_BUCKET_NAME || "clouddfs-data";

    this.fallbackDir = path.join(process.cwd(), ".clouddfs_storage_mock");

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        endpoint: endpoint || undefined,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: config?.forcePathStyle ?? (endpoint ? true : false),
      });
      console.log(`[Storage] Initialized S3/R2 client for bucket "${this.bucketName}" at ${endpoint || "default AWS"}`);
    } else {
      this.isFallbackMode = true;
      console.log(`[Storage] No S3/R2 credentials provided. Initializing local storage provider fallback at "${this.fallbackDir}"`);
      if (!fs.existsSync(this.fallbackDir)) {
        fs.mkdirSync(this.fallbackDir, { recursive: true });
      }
    }
  }

  public isUsingRealS3(): boolean {
    return !this.isFallbackMode && this.s3Client !== null;
  }

  public async uploadChunk(
    key: string,
    buffer: Buffer,
    contentType: string = "application/octet-stream"
  ): Promise<{ key: string; size: number; checksum: string }> {
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    if (this.s3Client && !this.isFallbackMode) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
    } else {
      const targetPath = path.join(this.fallbackDir, key.replace(/\//g, "_"));
      await fs.promises.writeFile(targetPath, buffer);
    }

    return {
      key,
      size: buffer.length,
      checksum,
    };
  }

  public async downloadChunk(key: string): Promise<Buffer> {
    if (this.s3Client && !this.isFallbackMode) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      if (!response.Body) {
        throw new Error(`Empty response body for chunk key: ${key}`);
      }
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } else {
      const targetPath = path.join(this.fallbackDir, key.replace(/\//g, "_"));
      if (!fs.existsSync(targetPath)) {
        throw new Error(`Chunk not found in storage fallback: ${key}`);
      }
      return await fs.promises.readFile(targetPath);
    }
  }

  public async deleteChunk(key: string): Promise<void> {
    if (this.s3Client && !this.isFallbackMode) {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } else {
      const targetPath = path.join(this.fallbackDir, key.replace(/\//g, "_"));
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
      }
    }
  }

  public async getSignedUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.s3Client && !this.isFallbackMode) {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    }
    return `/api/storage/mock-upload?key=${encodeURIComponent(key)}`;
  }

  public async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.s3Client && !this.isFallbackMode) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn });
    }
    return `/api/storage/mock-download?key=${encodeURIComponent(key)}`;
  }

  public async hasChunk(key: string): Promise<boolean> {
    if (this.s3Client && !this.isFallbackMode) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          })
        );
        return true;
      } catch {
        return false;
      }
    } else {
      const targetPath = path.join(this.fallbackDir, key.replace(/\//g, "_"));
      return fs.existsSync(targetPath);
    }
  }
}
