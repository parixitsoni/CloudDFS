import { db } from "@clouddfs/database";
import {
  NODE_UNHEALTHY_THRESHOLD_MS,
  NODE_DEAD_THRESHOLD_MS,
  NodeStatus,
} from "@clouddfs/shared";

export class HeartbeatMonitor {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number;

  constructor(intervalMs: number = 5000) {
    this.intervalMs = intervalMs;
  }

  public start() {
    console.log(`[HeartbeatMonitor] Control Plane health checker started (interval: ${this.intervalMs}ms)`);
    this.timer = setInterval(() => this.checkNodesHealth(), this.intervalMs);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkNodesHealth() {
    try {
      const now = new Date();
      const nodes = await db.node.findMany();

      for (const node of nodes) {
        const timeSinceHeartbeat = now.getTime() - new Date(node.lastHeartbeat).getTime();

        let targetStatus: NodeStatus = NodeStatus.ACTIVE;

        if (timeSinceHeartbeat > NODE_DEAD_THRESHOLD_MS) {
          targetStatus = NodeStatus.DEAD;
        } else if (timeSinceHeartbeat > NODE_UNHEALTHY_THRESHOLD_MS) {
          targetStatus = NodeStatus.UNHEALTHY;
        }

        if (node.status !== targetStatus) {
          console.warn(
            `[HeartbeatMonitor] Node state change detected! Node "${node.name}" (${node.id}) transitioned from ${node.status} -> ${targetStatus}`
          );

          await db.node.update({
            where: { id: node.id },
            data: { status: targetStatus },
          });

          await db.auditLog.create({
            data: {
              eventType: "NODE_HEALTH_CHANGE",
              message: `Node ${node.name} status changed to ${targetStatus}`,
              details: JSON.stringify({
                nodeId: node.id,
                previousStatus: node.status,
                newStatus: targetStatus,
                timeSinceHeartbeatMs: timeSinceHeartbeat,
              }),
            },
          });

          if (targetStatus === NodeStatus.DEAD || targetStatus === NodeStatus.UNHEALTHY) {
            await this.markUnderReplicatedFiles(node.id);
          }
        }
      }
    } catch (err) {
      console.error("[HeartbeatMonitor] Health check error:", err);
    }
  }

  private async markUnderReplicatedFiles(deadNodeId: string) {
    try {
      const affectedChunks = await db.chunk.findMany({
        where: {
          OR: [{ primaryNodeId: deadNodeId }, { replicaNodeId: deadNodeId }],
        },
        select: { fileId: true },
      });

      const affectedFileIds = Array.from(new Set(affectedChunks.map((c: { fileId: string }) => c.fileId)));

      if (affectedFileIds.length > 0) {
        await db.file.updateMany({
          where: { id: { in: affectedFileIds } },
          data: { status: "UNDER_REPLICATED" },
        });

        console.warn(
          `[HeartbeatMonitor] Flagged ${affectedFileIds.length} files as UNDER_REPLICATED due to node failure: ${deadNodeId}`
        );
      }
    } catch (err) {
      console.error("[HeartbeatMonitor] Failed to mark under-replicated files:", err);
    }
  }
}
