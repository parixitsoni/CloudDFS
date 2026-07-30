import { db } from "./index.js";

async function main() {
  console.log("[DB Seed] Starting database seeding...");

  // Seed demo nodes
  const nodes = [
    {
      id: "node-us-east-1",
      name: "Data Node 1 (US-East)",
      address: "http://localhost:4001",
      port: 4001,
      status: "ACTIVE",
      totalStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
      usedStorageBytes: BigInt(12 * 1024 * 1024 * 1024),
      activeUploads: 0,
      activeDownloads: 0,
      cpuUsagePct: 14.5,
      memoryUsagePct: 38.2,
      lastHeartbeat: new Date(),
    },
    {
      id: "node-eu-west-1",
      name: "Data Node 2 (EU-West)",
      address: "http://localhost:4002",
      port: 4002,
      status: "ACTIVE",
      totalStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
      usedStorageBytes: BigInt(8 * 1024 * 1024 * 1024),
      activeUploads: 0,
      activeDownloads: 0,
      cpuUsagePct: 9.8,
      memoryUsagePct: 29.4,
      lastHeartbeat: new Date(),
    },
    {
      id: "node-ap-south-1",
      name: "Data Node 3 (AP-South)",
      address: "http://localhost:4003",
      port: 4003,
      status: "ACTIVE",
      totalStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
      usedStorageBytes: BigInt(5 * 1024 * 1024 * 1024),
      activeUploads: 0,
      activeDownloads: 0,
      cpuUsagePct: 18.2,
      memoryUsagePct: 44.1,
      lastHeartbeat: new Date(),
    },
  ];

  for (const n of nodes) {
    await db.node.upsert({
      where: { id: n.id },
      update: { ...n, lastHeartbeat: new Date() },
      create: n,
    });
  }

  // Seed default folders
  const documentsFolder = await db.file.upsert({
    where: { id: "folder-docs-001" },
    update: {},
    create: {
      id: "folder-docs-001",
      name: "Documents",
      path: "/Documents",
      isFolder: true,
      status: "READY",
    },
  });

  const systemFolder = await db.file.upsert({
    where: { id: "folder-system-002" },
    update: {},
    create: {
      id: "folder-system-002",
      name: "System Backups",
      path: "/System Backups",
      isFolder: true,
      status: "READY",
    },
  });

  // Seed sample welcome document file
  const welcomeFile = await db.file.upsert({
    where: { id: "file-welcome-001" },
    update: {},
    create: {
      id: "file-welcome-001",
      name: "CloudDFS_Architecture_Overview.pdf",
      path: "/Documents/CloudDFS_Architecture_Overview.pdf",
      mimeType: "application/pdf",
      sizeBytes: 8420000, // ~8.4 MB
      totalChunks: 2,
      isFolder: false,
      parentFolderId: documentsFolder.id,
      replicationFactor: 2,
      status: "READY",
    },
  });

  // Chunks for sample file
  await db.chunk.upsert({
    where: { id: "chunk-w001-c0" },
    update: {},
    create: {
      id: "chunk-w001-c0",
      fileId: welcomeFile.id,
      chunkIndex: 0,
      sizeBytes: 5242880,
      checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      primaryNodeId: "node-us-east-1",
      replicaNodeId: "node-eu-west-1",
      storageKeyPrimary: `chunks/${welcomeFile.id}/chunk_0.bin`,
      storageKeyReplica: `chunks_replica/${welcomeFile.id}/chunk_0.bin`,
      status: "STORED",
    },
  });

  await db.chunk.upsert({
    where: { id: "chunk-w001-c1" },
    update: {},
    create: {
      id: "chunk-w001-c1",
      fileId: welcomeFile.id,
      chunkIndex: 1,
      sizeBytes: 3177120,
      checksum: "f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb",
      primaryNodeId: "node-eu-west-1",
      replicaNodeId: "node-ap-south-1",
      storageKeyPrimary: `chunks/${welcomeFile.id}/chunk_1.bin`,
      storageKeyReplica: `chunks_replica/${welcomeFile.id}/chunk_1.bin`,
      status: "STORED",
    },
  });

  // Seed sample audit log
  await db.auditLog.create({
    data: {
      eventType: "SYSTEM_INIT",
      message: "CloudDFS Cluster Initialized with 3 Data Nodes",
      details: JSON.stringify({ activeNodes: nodes.map((n) => n.id) }),
    },
  });

  console.log("[DB Seed] Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("[DB Seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
