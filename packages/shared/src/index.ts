import { z } from "zod";

// --- CONSTANTS ---
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_REPLICATION_FACTOR = 2;
export const HEARTBEAT_INTERVAL_MS = 5000; // 5s
export const NODE_UNHEALTHY_THRESHOLD_MS = 15000; // 15s
export const NODE_DEAD_THRESHOLD_MS = 30000; // 30s

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
  filename: z.string().min(1),
  sizeBytes: z.number().positive(),
  mimeType: z.string().optional().default("application/octet-stream"),
  parentFolderId: z.string().nullable().optional(),
  replicationFactor: z.number().min(1).max(3).optional().default(DEFAULT_REPLICATION_FACTOR),
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
  name: z.string().min(1),
  parentFolderId: z.string().nullable().optional(),
});
export type CreateFolderPayload = z.infer<typeof CreateFolderSchema>;
