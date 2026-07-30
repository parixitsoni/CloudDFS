# CloudDFS System Architecture

CloudDFS is a distributed, fault-tolerant file storage system designed with a strict separation between the **Control Plane (Metadata Service)** and **Data Plane (Cloud Object Storage)**.

---

## 1. High-Level Architecture Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client as Next.js Web Client
    participant Master as Metadata Service (Coordinator)
    participant Node1 as Data Node #1 (US-East)
    participant Node2 as Data Node #2 (EU-West)
    participant S3 as Object Storage (Cloudflare R2 / S3)

    rect rgb(20, 30, 50)
    note right of Node1: Heartbeat Loop (Every 5s)
    Node1->>Master: Heartbeat (Status: ACTIVE, Load: 15%)
    Node2->>Master: Heartbeat (Status: ACTIVE, Load: 10%)
    end

    rect rgb(30, 50, 40)
    note right of Client: Write Path (Multipart Chunked Upload)
    Client->>Master: POST /api/files/upload/initiate (file.mp4, 12MB)
    Master-->>Client: Allocates Chunk placements (Chunk 0 -> Node1, Chunk 1 -> Node2)
    Client->>Master: POST /api/chunks/upload (Chunk 0 binary)
    Master->>S3: PutObject(chunks/fileId/chunk_0.bin)
    Master->>S3: PutObject(chunks_replica/fileId/chunk_0.bin) [N=2 Replication]
    Master-->>Client: Upload Completed & Verified
    end

    rect rgb(50, 30, 40)
    note right of Client: Read Path with Automatic Failover
    Client->>Master: GET /api/files/:id/download
    Master->>Master: Resolves chunk route; checks Node1 status
    alt Node1 is HEALTHY
        Master->>S3: GetObject(chunks/fileId/chunk_0.bin)
    else Node1 is DEAD (Automatic Failover)
        Master->>S3: GetObject(chunks_replica/fileId/chunk_0.bin)
    end
    Master-->>Client: Stream reassembled file (200 OK)
    end
```

---

## 2. Key Components

### 2.1 Metadata Service (Control Plane)
- **Role**: Serves as the central coordinator for file metadata, directory hierarchies, chunk index mappings, node health registry, and audit logging.
- **Stateless Design**: All state persists in PostgreSQL / Managed DB so multiple Coordinator instances can be horizontally scaled behind a load balancer.

### 2.2 Data Nodes & Heartbeat Protocol
- **Heartbeats**: Data Nodes periodically register themselves and send health telemetry (CPU load, memory load, active uploads/downloads) every `5000ms`.
- **Health Thresholds**:
  - `ACTIVE`: Heartbeat received within `< 15s`.
  - `UNHEALTHY`: No heartbeat for `> 15s`.
  - `DEAD`: No heartbeat for `> 30s`.
- When a node transitions to `UNHEALTHY` or `DEAD`, affected file records are marked as `UNDER_REPLICATED` and chunk download requests are re-routed to healthy replica nodes.

### 2.3 Data Storage (Cloud Object Storage)
- **Cloudflare R2 / AWS S3**: All actual chunk bytes reside in S3-compatible cloud storage.
- **Replication**: Files are stored with replication factor $N=2$. The primary copy is stored at `chunks/{fileId}/chunk_{index}.bin` and the secondary replica copy is stored at `chunks_replica/{fileId}/chunk_{index}.bin`.

---

## 3. Failure & High Availability Model

| Failure Scenario | Impact | Failover Mitigation |
| :--- | :--- | :--- |
| **Data Node Crash** | Single Data Node stops sending heartbeats | Metadata Coordinator marks node as `DEAD` after 30s. Download requests automatically switch to reading from the replica storage key (`chunks_replica/...`). Zero download downtime for users. |
| **Network Partition** | Transient delay in heartbeats | Node marked `UNHEALTHY`. Chunk read scheduler avoids routing new upload requests to this node until heartbeats resume. |
| **Primary Chunk Key Missing** | S3 object corruption / missing key | Storage provider automatically catches exception and falls back to reading the secondary replica chunk. |
