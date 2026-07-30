import { db } from "@clouddfs/database";
import {
  DEFAULT_CHUNK_SIZE,
  NodeStatus,
  ChunkPlacement,
  DownloadRouteChunk,
} from "@clouddfs/shared";

export class ChunkManager {
  /**
   * Selects healthy active nodes and computes chunk placements for an incoming file upload.
   */
  public async allocateChunks(
    fileId: string,
    sizeBytes: number,
    replicationFactor: number = 2
  ): Promise<{ totalChunks: number; chunkSize: number; placements: ChunkPlacement[] }> {
    const activeNodes = await db.node.findMany({
      where: { status: NodeStatus.ACTIVE },
    });

    if (activeNodes.length === 0) {
      throw new Error("No active data nodes available in the cluster to store chunks.");
    }

    const totalChunks = Math.ceil(sizeBytes / DEFAULT_CHUNK_SIZE);
    const placements: ChunkPlacement[] = [];

    for (let index = 0; index < totalChunks; index++) {
      // Simple round-robin placement across active nodes
      const primaryIndex = index % activeNodes.length;
      const primaryNode = activeNodes[primaryIndex];

      let replicaNode = undefined;
      if (replicationFactor > 1 && activeNodes.length > 1) {
        const replicaIndex = (index + 1) % activeNodes.length;
        replicaNode = activeNodes[replicaIndex];
      }

      const storageKeyPrimary = `chunks/${fileId}/chunk_${index}.bin`;
      const storageKeyReplica = replicaNode ? `chunks_replica/${fileId}/chunk_${index}.bin` : undefined;

      placements.push({
        chunkIndex: index,
        primaryNodeId: primaryNode.id,
        primaryNodeAddress: primaryNode.address,
        replicaNodeId: replicaNode?.id,
        replicaNodeAddress: replicaNode?.address,
        storageKeyPrimary,
        storageKeyReplica,
      });
    }

    return {
      totalChunks,
      chunkSize: DEFAULT_CHUNK_SIZE,
      placements,
    };
  }

  /**
   * Resolves chunk read routes for a file download, performing automatic failover if primary node is dead/unhealthy.
   */
  public async resolveDownloadRoute(fileId: string): Promise<DownloadRouteChunk[]> {
    const file = await db.file.findUnique({
      where: { id: fileId },
      include: { chunks: { orderBy: { chunkIndex: "asc" } } },
    });

    if (!file) {
      throw new Error("File not found");
    }

    const allNodes = await db.node.findMany();
    const nodeMap = new Map<string, any>(allNodes.map((n: any) => [n.id, n]));

    const routeChunks: DownloadRouteChunk[] = [];

    for (const chunk of file.chunks) {
      const primaryNode = nodeMap.get(chunk.primaryNodeId);
      const replicaNode = chunk.replicaNodeId ? nodeMap.get(chunk.replicaNodeId) : undefined;

      let preferredNodeAddress = primaryNode?.address || "http://localhost:4001";
      let failoverOccurred = false;

      // Failover logic: if primary node is dead/unhealthy and replica node is active, reroute!
      if (!primaryNode || primaryNode.status !== NodeStatus.ACTIVE) {
        if (replicaNode && replicaNode.status === NodeStatus.ACTIVE) {
          preferredNodeAddress = replicaNode.address;
          failoverOccurred = true;
        } else {
          console.warn(`[ChunkManager] Chunk #${chunk.chunkIndex} of file ${fileId} primary node ${chunk.primaryNodeId} is down and no active replica available.`);
        }
      }

      if (failoverOccurred) {
        console.log(`[ChunkManager] AUTOMATIC FAILOVER: Routed download for chunk #${chunk.chunkIndex} from primary (${chunk.primaryNodeId}) to active replica (${replicaNode?.id})`);
        
        await db.auditLog.create({
          data: {
            eventType: "FAILOVER_ROUTED",
            message: `Automated failover routed chunk #${chunk.chunkIndex} of file ${file.name} to replica ${replicaNode?.name}`,
            details: JSON.stringify({ fileId, chunkIndex: chunk.chunkIndex, replicaNodeId: replicaNode?.id }),
          },
        });
      }

      routeChunks.push({
        chunkIndex: chunk.chunkIndex,
        chunkId: chunk.id,
        sizeBytes: chunk.sizeBytes,
        checksum: chunk.checksum,
        primaryNodeAddress: primaryNode?.address || "",
        replicaNodeAddress: replicaNode?.address,
        storageKeyPrimary: chunk.storageKeyPrimary,
        storageKeyReplica: chunk.storageKeyReplica || undefined,
        preferredNodeAddress,
      });
    }

    return routeChunks;
  }
}
