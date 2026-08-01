import express, { Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { db } from "@clouddfs/database";
import { CloudStorageProvider } from "@clouddfs/storage";
import {
  UploadInitiateSchema,
  CreateFolderSchema,
  HeartbeatPayloadSchema,
  NodeStatus,
  FileStatus,
  HEARTBEAT_INTERVAL_MS,
  MAX_FILE_SIZE_BYTES,
  validateFileUpload,
} from "@clouddfs/shared";
import { HeartbeatMonitor } from "./services/HeartbeatMonitor.js";
import { ChunkManager } from "./services/ChunkManager.js";

// Argument & ENV parsing
const args = process.argv.slice(2);
function getArg(flag: string, fallback: string): string {
  const match = args.find((a) => a.startsWith(`--${flag}=`));
  if (match) return match.split("=")[1];
  return process.env[flag.toUpperCase().replace(/-/g, "_")] || fallback;
}

const SERVER_ROLE = getArg("role", "HYBRID"); // COORDINATOR, DATA_NODE, HYBRID
const PORT = parseInt(getArg("port", "4000"), 10);
const NODE_ID = getArg("node-id", "node-us-east-1");
const COORDINATOR_URL = getArg("coordinator-url", "http://localhost:4000");

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB per chunk limit

const storageProvider = new CloudStorageProvider();
const chunkManager = new ChunkManager();
let heartbeatMonitor: HeartbeatMonitor | null = null;

// Ensure initial demo nodes exist if cluster table is empty
async function ensureInitialNodesExist() {
  try {
    const count = await db.node.count();
    if (count === 0) {
      console.log("[Cluster] Seeding initial data nodes...");
      const liveAddress = process.env.RENDER_EXTERNAL_URL || "http://localhost:4000";
      const demoNodes = [
        {
          id: "node-us-east-1",
          name: "Data Node 1 (US-East)",
          address: liveAddress,
          port: 4001,
          status: NodeStatus.ACTIVE,
          totalStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
          usedStorageBytes: BigInt(10 * 1024 * 1024 * 1024),
          activeUploads: 0,
          activeDownloads: 0,
          cpuUsagePct: 12.0,
          memoryUsagePct: 35.0,
          lastHeartbeat: new Date(),
        },
        {
          id: "node-eu-west-1",
          name: "Data Node 2 (EU-West)",
          address: liveAddress,
          port: 4002,
          status: NodeStatus.ACTIVE,
          totalStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
          usedStorageBytes: BigInt(8 * 1024 * 1024 * 1024),
          activeUploads: 0,
          activeDownloads: 0,
          cpuUsagePct: 8.5,
          memoryUsagePct: 28.0,
          lastHeartbeat: new Date(),
        },
      ];

      for (const n of demoNodes) {
        await db.node.create({ data: n });
      }
    }
  } catch (err) {
    console.error("[Cluster] Node auto-seed error:", err);
  }
}

// Initialize background health checker on Coordinator
if (SERVER_ROLE === "COORDINATOR" || SERVER_ROLE === "HYBRID") {
  ensureInitialNodesExist().then(() => {
    heartbeatMonitor = new HeartbeatMonitor(HEARTBEAT_INTERVAL_MS);
    heartbeatMonitor.start();
  });

  // Periodically keep demo data node heartbeats fresh for cloud deployment
  setInterval(async () => {
    try {
      await ensureInitialNodesExist();
      await db.node.updateMany({
        where: { status: { not: "DEAD" } },
        data: { lastHeartbeat: new Date() },
      });
    } catch {
      // Suppress transient error
    }
  }, 10000);
}

// Background heartbeat sender for DATA_NODE
if (SERVER_ROLE === "DATA_NODE") {
  setInterval(async () => {
    try {
      await fetch(`${COORDINATOR_URL}/api/nodes/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: NODE_ID,
          name: `Data Node (${NODE_ID})`,
          address: `http://localhost:${PORT}`,
          port: PORT,
          totalStorageBytes: 100 * 1024 * 1024 * 1024,
          usedStorageBytes: 10 * 1024 * 1024 * 1024,
          activeUploads: 0,
          activeDownloads: 0,
          cpuUsagePct: Math.floor(Math.random() * 25) + 5,
          memoryUsagePct: Math.floor(Math.random() * 30) + 20,
        }),
      });
    } catch {
      // Suppress transient error during startup
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// --- HEALTH & STATUS ---
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    role: SERVER_ROLE,
    nodeId: NODE_ID,
    port: PORT,
    usingRealS3: storageProvider.isUsingRealS3(),
  });
});

// --- CLUSTER METRICS ---
app.get("/api/metrics", async (req: Request, res: Response) => {
  try {
    const totalFiles = await db.file.count({ where: { isFolder: false, status: { not: "DELETED" } } });
    const aggregateSize = await db.file.aggregate({
      _sum: { sizeBytes: true },
      where: { isFolder: false, status: { not: "DELETED" } },
    });

    const activeNodes = await db.node.count({ where: { status: NodeStatus.ACTIVE } });
    const unhealthyNodes = await db.node.count({ where: { status: NodeStatus.UNHEALTHY } });
    const deadNodes = await db.node.count({ where: { status: NodeStatus.DEAD } });
    const underReplicated = await db.file.count({ where: { status: FileStatus.UNDER_REPLICATED } });

    let systemHealthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
    if (deadNodes > 0 || underReplicated > 0) {
      systemHealthStatus = deadNodes >= activeNodes ? "CRITICAL" : "DEGRADED";
    }

    res.json({
      totalFiles,
      totalStorageUsedBytes: aggregateSize._sum.sizeBytes || 0,
      activeNodesCount: activeNodes,
      unhealthyNodesCount: unhealthyNodes,
      deadNodesCount: deadNodes,
      underReplicatedFilesCount: underReplicated,
      systemHealthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- NODE HEARTBEAT & MANAGEMENT ---
app.post("/api/nodes/heartbeat", async (req: Request, res: Response) => {
  try {
    const payload = HeartbeatPayloadSchema.parse(req.body);

    const updatedNode = await db.node.upsert({
      where: { id: payload.nodeId },
      update: {
        name: payload.name,
        address: payload.address,
        port: payload.port,
        status: NodeStatus.ACTIVE,
        totalStorageBytes: BigInt(payload.totalStorageBytes),
        usedStorageBytes: BigInt(payload.usedStorageBytes),
        activeUploads: payload.activeUploads,
        activeDownloads: payload.activeDownloads,
        cpuUsagePct: payload.cpuUsagePct,
        memoryUsagePct: payload.memoryUsagePct,
        lastHeartbeat: new Date(),
      },
      create: {
        id: payload.nodeId,
        name: payload.name,
        address: payload.address,
        port: payload.port,
        status: NodeStatus.ACTIVE,
        totalStorageBytes: BigInt(payload.totalStorageBytes),
        usedStorageBytes: BigInt(payload.usedStorageBytes),
        activeUploads: payload.activeUploads,
        activeDownloads: payload.activeDownloads,
        cpuUsagePct: payload.cpuUsagePct,
        memoryUsagePct: payload.memoryUsagePct,
        lastHeartbeat: new Date(),
      },
    });

    res.json({ success: true, nodeId: updatedNode.id, status: updatedNode.status });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get("/api/nodes", async (req: Request, res: Response) => {
  try {
    const nodes = await db.node.findMany({ orderBy: { port: "asc" } });
    const formatted = nodes.map((n: any) => ({
      ...n,
      totalStorageBytes: Number(n.totalStorageBytes),
      usedStorageBytes: Number(n.usedStorageBytes),
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// SIMULATION TOGGLE: Simulate killing or reviving a node on demand for live demo!
app.post("/api/nodes/:id/failover-test", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "KILL" | "REVIVE"

    const node = await db.node.findUnique({ where: { id } });
    if (!node) return res.status(404).json({ error: "Node not found" });

    const newStatus = action === "KILL" ? NodeStatus.DEAD : NodeStatus.ACTIVE;
    const lastHeartbeat = action === "KILL" ? new Date(Date.now() - 60000) : new Date();

    await db.node.update({
      where: { id },
      data: { status: newStatus, lastHeartbeat },
    });

    await db.auditLog.create({
      data: {
        eventType: "MANUAL_SIMULATION",
        message: `Admin manually performed simulation action [${action}] on node ${node.name}`,
        details: JSON.stringify({ nodeId: id, action, targetStatus: newStatus }),
      },
    });

    // Run health check immediately to trigger failover routing logic
    if (heartbeatMonitor) {
      await heartbeatMonitor.checkNodesHealth();
    }

    res.json({ success: true, nodeId: id, action, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Recursive folder statistics helper (sums contained file sizes, item count, and chunk count)
async function calculateFolderStats(folderId: string) {
  let totalBytes = 0;
  let totalFiles = 0;
  let totalChunks = 0;

  async function calculateRecursive(fId: string) {
    const children = await db.file.findMany({
      where: { parentFolderId: fId, status: { not: "DELETED" } },
      include: { _count: { select: { chunks: true } } },
    });

    for (const child of children) {
      if (child.isFolder) {
        await calculateRecursive(child.id);
      } else {
        totalBytes += child.sizeBytes;
        totalFiles += 1;
        totalChunks += child._count.chunks;
      }
    }
  }

  await calculateRecursive(folderId);
  return { totalBytes, totalFiles, totalChunks };
}

// --- FILE METADATA & FOLDERS ---
app.get("/api/files", async (req: Request, res: Response) => {
  try {
    const parentFolderId = (req.query.parentFolderId as string) || null;
    const files = await db.file.findMany({
      where: {
        parentFolderId,
        status: { not: "DELETED" },
      },
      include: {
        _count: { select: { chunks: true } },
      },
      orderBy: [{ isFolder: "desc" }, { name: "asc" }],
    });

    const enrichedFiles = await Promise.all(
      files.map(async (file) => {
        if (file.isFolder) {
          const stats = await calculateFolderStats(file.id);
          return {
            ...file,
            sizeBytes: stats.totalBytes,
            totalItems: stats.totalFiles,
            totalChunks: stats.totalChunks,
          };
        }
        return {
          ...file,
          totalChunks: file._count.chunks,
        };
      })
    );

    res.json(enrichedFiles);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/files/folder", async (req: Request, res: Response) => {
  try {
    const payload = CreateFolderSchema.parse(req.body);
    const pathPrefix = payload.parentFolderId ? `/folder-${payload.parentFolderId}` : "";
    
    const folder = await db.file.create({
      data: {
        name: payload.name,
        path: `${pathPrefix}/${payload.name}`,
        isFolder: true,
        parentFolderId: payload.parentFolderId || null,
        status: "READY",
      },
    });
    res.json(folder);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.delete("/api/files/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = await db.file.findUnique({ where: { id }, include: { chunks: true } });
    if (!file) return res.status(404).json({ error: "File not found" });

    // Cleanup chunks from storage
    for (const chunk of file.chunks) {
      try {
        await storageProvider.deleteChunk(chunk.storageKeyPrimary);
        if (chunk.storageKeyReplica) {
          await storageProvider.deleteChunk(chunk.storageKeyReplica);
        }
      } catch (err) {
        console.warn(`[Storage] Failed to delete chunk key ${chunk.storageKeyPrimary}:`, err);
      }
    }

    await db.file.update({
      where: { id },
      data: { status: "DELETED" },
    });

    await db.auditLog.create({
      data: {
        eventType: "FILE_DELETED",
        message: `Deleted file "${file.name}" (${file.id})`,
      },
    });

    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- CHUNKED UPLOAD ROUTE ---
app.post("/api/files/upload/initiate", async (req: Request, res: Response) => {
  try {
    const payload = UploadInitiateSchema.parse(req.body);

    const check = validateFileUpload(payload.filename, payload.sizeBytes, payload.mimeType);
    if (!check.valid) {
      return res.status(400).json({ error: check.error || "File upload blocked for security." });
    }

    const file = await db.file.create({
      data: {
        name: payload.filename,
        path: `/${payload.filename}`,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        isFolder: false,
        parentFolderId: payload.parentFolderId || null,
        replicationFactor: payload.replicationFactor,
        status: FileStatus.UPLOADING,
      },
    });

    const allocation = await chunkManager.allocateChunks(
      file.id,
      payload.sizeBytes,
      payload.replicationFactor
    );

    await db.file.update({
      where: { id: file.id },
      data: { totalChunks: allocation.totalChunks },
    });

    res.json({
      fileId: file.id,
      filename: file.name,
      totalChunks: allocation.totalChunks,
      chunkSize: allocation.chunkSize,
      placements: allocation.placements,
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post("/api/chunks/upload", upload.single("chunk"), async (req: Request, res: Response) => {
  try {
    const { fileId, chunkIndex, primaryNodeId, replicaNodeId, storageKeyPrimary, storageKeyReplica } = req.body;
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      return res.status(400).json({ error: "Missing chunk binary file buffer" });
    }

    const idx = parseInt(chunkIndex, 10);
    
    // Store Primary Copy in Object Storage (Cloudflare R2 / AWS S3 / Fallback)
    const primaryResult = await storageProvider.uploadChunk(storageKeyPrimary, fileBuffer);

    let replicaResult = null;
    if (storageKeyReplica) {
      replicaResult = await storageProvider.uploadChunk(storageKeyReplica, fileBuffer);
    }

    const chunkRecord = await db.chunk.create({
      data: {
        fileId,
        chunkIndex: idx,
        sizeBytes: primaryResult.size,
        checksum: primaryResult.checksum,
        primaryNodeId,
        replicaNodeId: replicaNodeId || null,
        storageKeyPrimary: primaryResult.key,
        storageKeyReplica: replicaResult?.key || null,
        status: "STORED",
      },
    });

    // Check if all chunks uploaded
    const storedChunksCount = await db.chunk.count({ where: { fileId } });
    const targetFile = await db.file.findUnique({ where: { id: fileId } });

    if (targetFile && storedChunksCount >= targetFile.totalChunks) {
      await db.file.update({
        where: { id: fileId },
        data: { status: FileStatus.READY },
      });

      await db.auditLog.create({
        data: {
          eventType: "FILE_UPLOAD_COMPLETE",
          message: `Successfully completed upload and chunking for file "${targetFile.name}" (${storedChunksCount} chunks)`,
          details: JSON.stringify({ fileId, totalSize: targetFile.sizeBytes }),
        },
      });
    }

    res.json({ success: true, chunkId: chunkRecord.id, checksum: primaryResult.checksum });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- DOWNLOAD & STREAMING ROUTE WITH AUTOMATIC FAILOVER ---
app.get("/api/files/:id/download", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = await db.file.findUnique({ where: { id }, include: { chunks: { orderBy: { chunkIndex: "asc" } } } });

    if (!file || file.status === "DELETED") {
      return res.status(404).json({ error: "File not found" });
    }

    const routes = await chunkManager.resolveDownloadRoute(file.id);

    // Reassemble file chunks in sequence
    const chunkBuffers: Buffer[] = [];
    for (const r of routes) {
      let buffer: Buffer | null = null;
      
      // Try primary key first, if fails try replica key
      try {
        buffer = await storageProvider.downloadChunk(r.storageKeyPrimary);
      } catch {
        if (r.storageKeyReplica) {
          console.warn(`[Download] Primary chunk read failed. Falling back to replica key: ${r.storageKeyReplica}`);
          buffer = await storageProvider.downloadChunk(r.storageKeyReplica);
        }
      }

      if (!buffer) {
        throw new Error(`Failed to retrieve chunk index ${r.chunkIndex} from storage`);
      }
      chunkBuffers.push(buffer);
    }

    const completeFileBuffer = Buffer.concat(chunkBuffers);

    const safeFilename = file.name.replace(/["\r\n]/g, "_");
    res.setHeader("Content-Type", "application/octet-stream"); // Force binary stream to avoid inline execution
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.setHeader("Content-Length", completeFileBuffer.length);
    res.send(completeFileBuffer);
  } catch (err) {
    console.error("[Download Route Error]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- SECURE VISITOR ANALYTICS TELEMETRY ---
interface AnalyticsEntry {
  id: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  userAgent: string;
  browser: string;
  os: string;
  deviceType: string;
  durationSeconds: number;
  pagePath: string;
  createdAt: string;
}

const analyticsLog: AnalyticsEntry[] = [];
const ADMIN_SECRET_PASSKEY = process.env.ADMIN_SECRET_KEY || "parixit2026";

function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType = "Desktop";

  if (/mobile/i.test(ua)) deviceType = "Mobile";
  else if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";

  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/edg/i.test(ua)) browser = "Edge";
  else if (/opera|opr/i.test(ua)) browser = "Opera";

  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { browser, os, deviceType };
}

app.post("/api/analytics/track", (req: Request, res: Response) => {
  try {
    const rawIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
    const userAgent = req.headers["user-agent"] || req.body.userAgent || "Unknown";
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    const country = (req.headers["cf-ipcountry"] as string) || req.body.country || "India (IN)";
    const region = req.body.region || "Rajasthan";
    const city = req.body.city || "Udaipur";
    const durationSeconds = Number(req.body.durationSeconds) || 0;
    const pagePath = req.body.pagePath || "/";

    const existingIndex = analyticsLog.findIndex((entry) => entry.ip === rawIp && entry.pagePath === pagePath);

    if (existingIndex !== -1 && durationSeconds > 0) {
      analyticsLog[existingIndex].durationSeconds = Math.max(analyticsLog[existingIndex].durationSeconds, durationSeconds);
      analyticsLog[existingIndex].createdAt = new Date().toISOString();
    } else {
      analyticsLog.unshift({
        id: `vis_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        ip: rawIp,
        country,
        region,
        city,
        userAgent,
        browser,
        os,
        deviceType,
        durationSeconds,
        pagePath,
        createdAt: new Date().toISOString(),
      });
      if (analyticsLog.length > 500) analyticsLog.pop();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Protected endpoint to retrieve analytics (ADMIN ONLY)
app.get("/api/analytics/stats", (req: Request, res: Response) => {
  const secretKey = (req.headers["x-admin-secret"] as string) || (req.query.secretKey as string);
  
  if (secretKey !== ADMIN_SECRET_PASSKEY) {
    return res.status(403).json({ error: "Access Denied: Invalid Admin Secret Passkey." });
  }

  const totalVisitors = analyticsLog.length;
  const uniqueIPs = new Set(analyticsLog.map((l) => l.ip));
  const totalDuration = analyticsLog.reduce((acc, l) => acc + l.durationSeconds, 0);
  const avgDuration = totalVisitors > 0 ? Math.round(totalDuration / totalVisitors) : 0;

  res.json({
    totalVisitors,
    uniqueVisitors: uniqueIPs.size,
    averageDurationSeconds: avgDuration,
    logs: analyticsLog,
  });
});

// --- AUDIT LOGS ---
app.get("/api/audit-logs", async (req: Request, res: Response) => {
  try {
    const logs = await db.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  CloudDFS ${SERVER_ROLE} node running on port ${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});
