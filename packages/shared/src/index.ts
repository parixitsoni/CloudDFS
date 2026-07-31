import { z } from "zod";

// --- CONSTANTS & SECURITY LIMITS ---
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_REPLICATION_FACTOR = 2;
export const HEARTBEAT_INTERVAL_MS = 5000; // 5s
export const NODE_UNHEALTHY_THRESHOLD_MS = 15000; // 15s
export const NODE_DEAD_THRESHOLD_MS = 30000; // 30s

// Maximum allowed file size for public demo upload (20 MB)
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; 

// Prohibited extensions to prevent malware, phishing, and script execution
export const BLOCKED_FILE_EXTENSIONS = new Set([
  // Executable files & system scripts
  "exe", "dll", "bat", "cmd", "sh", "bash", "vbs", "vbe", "js", "jse", "jar",
  "scr", "msi", "pif", "com", "hta", "cpl", "reg", "ps1", "ps1xml", "ps2",
  "psc1", "psc2", "wsf", "wsc", "wsh", "gadget", "iso", "img", "vhd", "vmdk",
  "lnk", "inf", "ins", "isu", "job", "lib", "msp", "mst", "paf", "rgs", "sct",
  "shb", "shs", "u3p", "vb", "ws", "py", "rb", "pl", "cgi",
  // Web script & phishing / stored XSS formats
  "html", "htm", "xhtml", "svg", "php", "php3", "php4", "php5", "phtml",
  "asp", "aspx", "jsp", "jspx", "cfm", "shtml"
]);

// Prohibited MIME types to prevent inline script execution or dangerous binary execution
export const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "image/svg+xml",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "application/x-bat",
  "application/x-httpd-php",
  "application/javascript",
  "text/javascript",
  "application/x-powershell",
]);

// Helper to validate file size, filename security, double extensions, and MIME type
export function validateFileUpload(
  filename: string,
  sizeBytes: number,
  mimeType?: string
): { valid: boolean; error?: string } {
  // Check file size
  if (sizeBytes <= 0) {
    return { valid: false, error: "File cannot be empty." };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) exceeds public upload limit of 20 MB.`,
    };
  }

  // Check filename
  if (!filename || filename.trim().length === 0) {
    return { valid: false, error: "Filename cannot be empty." };
  }
  if (filename.length > 255) {
    return { valid: false, error: "Filename exceeds maximum length of 255 characters." };
  }
  // Prevent directory traversal or null byte injection
  if (/[\\/\x00]|\.\./.test(filename)) {
    return { valid: false, error: "Invalid filename containing dangerous characters or path sequences." };
  }

  // Check file extension(s)
  const parts = filename.toLowerCase().split(".");
  if (parts.length > 1) {
    const ext = parts[parts.length - 1];
    if (BLOCKED_FILE_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Uploading '.${ext}' files is blocked for safety (executable/phishing prevention).`,
      };
    }
    // Check for double extension bypass attempts like 'invoice.pdf.exe'
    if (parts.length > 2) {
      for (let i = 1; i < parts.length; i++) {
        if (BLOCKED_FILE_EXTENSIONS.has(parts[i])) {
          return {
            valid: false,
            error: `File contains prohibited extension '.${parts[i]}' blocked for safety.`,
          };
        }
      }
    }
  }

  // Check MIME type if provided
  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
    if (BLOCKED_MIME_TYPES.has(normalizedMime)) {
      return {
        valid: false,
        error: `MIME type '${normalizedMime}' is prohibited for public upload safety.`,
      };
    }
  }

  return { valid: true };
}

// --- ENUMS & TYPES ---
export enum NodeStatus {
  ACTIVE = "ACTIVE",
  UNHEALTHY = "UNHEALTHY",
  DEAD = "DEAD",
}

export enum FileStatus {
  UPLOADING = "UPLOADING",
  READY = "READY",
  UNDER_REPLICATED = "UNDER_REPLICATED",
  DELETED = "DELETED",
}

export enum ChunkStatus {
  PENDING = "PENDING",
  STORED = "STORED",
  MISSING = "MISSING",
}

// --- INTERFACES & SCHEMAS ---

export const HeartbeatPayloadSchema = z.object({
  nodeId: z.string(),
  name: z.string(),
  address: z.string(), // http://localhost:4001 or IP
  port: z.number(),
  totalStorageBytes: z.number().optional().default(100 * 1024 * 1024 * 1024), // 100 GB default quota
  usedStorageBytes: z.number().optional().default(0),
  activeUploads: z.number().optional().default(0),
  activeDownloads: z.number().optional().default(0),
  cpuUsagePct: z.number().optional().default(0),
  memoryUsagePct: z.number().optional().default(0),
});
export type HeartbeatPayload = z.infer<typeof HeartbeatPayloadSchema>;

export interface NodeInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  status: NodeStatus;
  lastHeartbeat: string;
  totalStorageBytes: number;
  usedStorageBytes: number;
  activeUploads: number;
  activeDownloads: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
}

export interface ChunkPlacement {
  chunkIndex: number;
  chunkHash?: string;
  primaryNodeId: string;
  primaryNodeAddress: string;
  replicaNodeId?: string;
  replicaNodeAddress?: string;
  storageKeyPrimary: string;
  storageKeyReplica?: string;
}

export const UploadInitiateSchema = z.object({
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().positive().max(MAX_FILE_SIZE_BYTES, "File size exceeds public upload limit of 20 MB"),
  mimeType: z.string().optional().default("application/octet-stream"),
  parentFolderId: z.string().nullable().optional(),
  replicationFactor: z.number().min(1).max(3).optional().default(DEFAULT_REPLICATION_FACTOR),
}).superRefine((data, ctx) => {
  const check = validateFileUpload(data.filename, data.sizeBytes, data.mimeType);
  if (!check.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: check.error || "File upload blocked for security reasons.",
    });
  }
});
export type UploadInitiatePayload = z.infer<typeof UploadInitiateSchema>;

export interface UploadInitiateResponse {
  fileId: string;
  filename: string;
  totalChunks: number;
  chunkSize: number;
  placements: ChunkPlacement[];
}

export interface DownloadRouteChunk {
  chunkIndex: number;
  chunkId: string;
  sizeBytes: number;
  checksum: string;
  primaryNodeAddress: string;
  replicaNodeAddress?: string;
  storageKeyPrimary: string;
  storageKeyReplica?: string;
  preferredNodeAddress: string;
}

export interface DownloadRouteResponse {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  totalChunks: number;
  chunks: DownloadRouteChunk[];
}

export interface ClusterMetrics {
  totalFiles: number;
  totalStorageUsedBytes: number;
  activeNodesCount: number;
  unhealthyNodesCount: number;
  deadNodesCount: number;
  underReplicatedFilesCount: number;
  systemHealthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  timestamp: string;
}

export const CreateFolderSchema = z.object({
  name: z.string().min(1).max(50).refine(
    (name) => !/[\\/:\*\?"<>\|]/.test(name) && name.trim() !== "." && name.trim() !== "..",
    { message: 'Folder name cannot contain special characters (\\ / : * ? " < > |) or be "." / ".."' }
  ),
  parentFolderId: z.string().nullable().optional(),
});
export type CreateFolderPayload = z.infer<typeof CreateFolderSchema>;

