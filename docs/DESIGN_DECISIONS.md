# CloudDFS Design Decisions & Engineering Trade-offs

This document details the core engineering trade-offs, consistency model, and architectural choices made when building **CloudDFS**.

---

## 1. Why Separate Metadata Control Plane from Data Plane?

### Local Disk vs Cloud Object Storage
Storing file chunks on server local disk (like traditional HDFS or GFS nodes) introduces severe operational complexity in cloud environments:
- Ephemeral server disks lose state on container restarts or cloud node scaling.
- Disks fill up, requiring complex block re-balancing across instances.

**CloudDFS Approach**: We store all actual chunk payloads directly in Cloudflare R2 / AWS S3 while maintaining chunk metadata and routing tables in PostgreSQL.
- **Durability**: Leverages Cloudflare R2 / AWS S3's 99.999999999% (11 9's) data durability.
- **Cost Efficiency**: Cloudflare R2 offers 10 GB free monthly storage with zero egress fees.
- **Stateless Compute**: API & Data nodes remain stateless, allowing instantaneous horizontal auto-scaling without disk migration.

---

## 2. Consistency Model & CAP Theorem Choices

According to the CAP Theorem, distributed file systems must choose between Consistency and Availability during network partitions.

### Strong Consistency for Metadata
- File index updates, folder structures, and chunk allocations require **Strong Consistency** ($C$). We achieve this by persisting metadata in ACID-compliant PostgreSQL (or SQLite during local dev).

### Eventual Consistency & High Availability for Data Chunks
- Object Storage reads and replica syncs favor **Availability** ($A$). Reads failover gracefully to secondary chunk keys if a primary node or chunk read fails.

---

## 3. Chunking & Multipart Strategy

### Chunk Size Selection (5 MB)
- Large single files (e.g. 500 MB videos) can exhaust server memory during uploads or fail due to network timeouts.
- CloudDFS breaks files into fixed-size **5 MB chunks**.
- **Benefits**:
  - Parallel chunk processing.
  - Resumeable uploads (failed chunk retries without re-uploading the entire file).
  - Fine-grained replication across cluster nodes.
