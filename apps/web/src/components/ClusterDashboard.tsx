"use client";

import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  AlertTriangle,
  HardDrive,
  Cpu,
  RefreshCw,
  Zap,
  Skull,
  ShieldCheck,
  Radio,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface NodeInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  status: string; // ACTIVE, UNHEALTHY, DEAD
  totalStorageBytes: number;
  usedStorageBytes: number;
  activeUploads: number;
  activeDownloads: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  lastHeartbeat: string;
}

interface ClusterMetrics {
  totalFiles: number;
  totalStorageUsedBytes: number;
  activeNodesCount?: number;
  unhealthyNodesCount?: number;
  deadNodesCount?: number;
  underReplicatedFilesCount?: number;
  totalNodes?: number;
  activeNodes?: number;
  deadNodes?: number;
  totalChunks?: number;
  systemHealthStatus?: "HEALTHY" | "DEGRADED" | "CRITICAL";
  clusterHealth?: "HEALTHY" | "DEGRADED" | "WARNING";
}

interface AuditLog {
  id: string;
  eventType: string;
  message: string;
  details: string | null;
  createdAt: string;
}

// Default initial nodes to guarantee cards stay permanently mounted without a single frame of blanking
const DEFAULT_INITIAL_NODES: NodeInfo[] = [
  {
    id: "node-us-east-1",
    name: "Data Node 1 (US-East)",
    address: "https://clouddfs-coordinator.onrender.com",
    port: 4001,
    status: "ACTIVE",
    totalStorageBytes: 100 * 1024 * 1024 * 1024,
    usedStorageBytes: 10 * 1024 * 1024 * 1024,
    activeUploads: 0,
    activeDownloads: 0,
    cpuUsagePct: 12.0,
    memoryUsagePct: 35.0,
    lastHeartbeat: new Date().toISOString(),
  },
  {
    id: "node-eu-west-1",
    name: "Data Node 2 (EU-West)",
    address: "https://clouddfs-coordinator.onrender.com",
    port: 4002,
    status: "ACTIVE",
    totalStorageBytes: 100 * 1024 * 1024 * 1024,
    usedStorageBytes: 8 * 1024 * 1024 * 1024,
    activeUploads: 0,
    activeDownloads: 0,
    cpuUsagePct: 8.5,
    memoryUsagePct: 28.0,
    lastHeartbeat: new Date().toISOString(),
  },
];

const DEFAULT_INITIAL_METRICS: ClusterMetrics = {
  totalFiles: 0,
  totalStorageUsedBytes: 0,
  activeNodesCount: 2,
  deadNodesCount: 0,
  systemHealthStatus: "HEALTHY",
};

export const ClusterDashboard: React.FC = () => {
  const { showToast } = useToast();

  // Initialize with permanent default state so cards NEVER unmount or flash blank
  const [nodes, setNodes] = useState<NodeInfo[]>(DEFAULT_INITIAL_NODES);
  const [metrics, setMetrics] = useState<ClusterMetrics | null>(DEFAULT_INITIAL_METRICS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  const fetchData = async (manualClick = false) => {
    if (manualClick) {
      setIsRefreshing(true);
    }

    try {
      const [nodesRes, metricsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/nodes`),
        fetch(`${API_BASE}/api/metrics`),
        fetch(`${API_BASE}/api/audit-logs`),
      ]);

      if (nodesRes.ok) {
        const freshNodes: NodeInfo[] = await nodesRes.json();
        if (freshNodes && freshNodes.length > 0) {
          // Stock-market in-place update (keeps existing DOM nodes mounted)
          setNodes((prev) => {
            if (prev.length === 0) return freshNodes;
            return prev.map((oldNode) => {
              const matchingFresh = freshNodes.find((f) => f.id === oldNode.id);
              return matchingFresh ? { ...oldNode, ...matchingFresh } : oldNode;
            });
          });
        }
      }

      if (metricsRes.ok) {
        const freshMetrics = await metricsRes.json();
        setMetrics((prev) => ({ ...prev, ...freshMetrics }));
      }

      if (logsRes.ok) {
        const freshLogs = await logsRes.json();
        setLogs(freshLogs);
      }

      if (manualClick) {
        showToast("info", "Cluster telemetry refreshed!");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (manualClick) {
        showToast("error", "Failed to refresh cluster telemetry.");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchData(false);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleSimulateFailover = async (nodeId: string, currentStatus: string) => {
    setActionLoadingId(nodeId);
    const action = currentStatus === "DEAD" ? "REVIVE" : "KILL";
    const targetStatus = action === "KILL" ? "DEAD" : "ACTIVE";

    // Instant in-place mutation (like a stock ticker button action)
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, status: targetStatus } : n))
    );

    try {
      const res = await fetch(`${API_BASE}/api/nodes/${nodeId}/failover-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showToast(
          action === "KILL" ? "error" : "success",
          `Node ${nodeId} ${action === "KILL" ? "simulated crash triggered" : "revived successfully"}`
        );
        await fetchData(false);
      }
    } catch (err) {
      console.error("Failover simulation error:", err);
      showToast("error", "Action failed.");
      // Rollback on network failure
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, status: currentStatus } : n))
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const activeNodesCount =
    metrics?.activeNodes ?? metrics?.activeNodesCount ?? nodes.filter((n) => n.status === "ACTIVE").length;
  const deadNodesCount =
    metrics?.deadNodes ?? metrics?.deadNodesCount ?? nodes.filter((n) => n.status === "DEAD").length;
  const healthStatus =
    deadNodesCount > 0 ? "DEGRADED" : "HEALTHY";

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="white-panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Server className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Cluster Control & Telemetry Dashboard
            </h2>
            <p className="text-xs text-slate-500">
              Real-time node telemetry, automated failover simulations, & distributed storage health.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>10s Sync Active</span>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="min-btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-semibold"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-slate-900" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Key Metric Cards Grid (PERMANENTLY MOUNTED - ZERO BLANKING) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Health Badge Card */}
        <div className="white-panel p-4 space-y-2 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cluster Health
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                healthStatus === "HEALTHY"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <Activity className="w-3 h-3" />
              {healthStatus}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Automated heartbeat checks active</p>
        </div>

        {/* Active Nodes Card */}
        <div className="white-panel p-4 space-y-2 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Data Nodes
            </span>
            <Server className="w-4 h-4 text-slate-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{activeNodesCount}</span>
            <span className="text-xs text-slate-500">/ {nodes.length} online</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{
                width: `${nodes.length > 0 ? (activeNodesCount / nodes.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Total Storage Used */}
        <div className="white-panel p-4 space-y-2 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Cluster Storage
            </span>
            <HardDrive className="w-4 h-4 text-slate-700" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {formatSize(metrics?.totalStorageUsedBytes || 0)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Across {metrics?.totalFiles || 0} file(s)
          </p>
        </div>

        {/* Simulated Dead Nodes Alert */}
        <div className="white-panel p-4 space-y-2 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Node Failures
            </span>
            <AlertTriangle
              className={`w-4 h-4 ${
                deadNodesCount > 0 ? "text-rose-500 animate-bounce" : "text-slate-400"
              }`}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-black ${
                deadNodesCount > 0 ? "text-rose-600" : "text-slate-900"
              }`}
            >
              {deadNodesCount}
            </span>
            <span className="text-xs text-slate-500">dead node(s)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            {deadNodesCount > 0 ? "Read failover active on replica nodes" : "0 node failures detected"}
          </p>
        </div>
      </div>

      {/* Storage Node Control & Telemetry Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-slate-700" /> Data Nodes & Live Chaos Engineering Simulation
          </h3>
          <span className="text-xs text-slate-400">
            Test killing or reviving node instances on demand
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node) => {
            const isDead = node.status === "DEAD";
            const isUnhealthy = node.status === "UNHEALTHY";

            return (
              <div
                key={node.id}
                className={`white-panel p-4 space-y-4 border transition-all ${
                  isDead
                    ? "border-rose-200 bg-rose-50/20"
                    : isUnhealthy
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{node.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {node.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">{node.address}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start shrink-0">
                    <span
                      className={`min-badge ${
                        isDead
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : isUnhealthy
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {isDead ? (
                        <Skull className="w-3 h-3 text-rose-600" />
                      ) : (
                        <Radio className="w-3 h-3 text-emerald-600" />
                      )}
                      {node.status}
                    </span>
                  </div>
                </div>

                {/* Telemetry Metrics Progress Bars */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                      <span>CPU Load</span>
                      <span>{node.cpuUsagePct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full transition-all duration-500"
                        style={{ width: `${node.cpuUsagePct}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                      <span>RAM Usage</span>
                      <span>{node.memoryUsagePct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full transition-all duration-500"
                        style={{ width: `${node.memoryUsagePct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Chaos Engineering Toggle Button Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Heartbeat:{" "}
                    {new Date(node.lastHeartbeat).toLocaleTimeString()}
                  </span>

                  <button
                    onClick={() => handleSimulateFailover(node.id, node.status)}
                    disabled={actionLoadingId === node.id}
                    className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      isDead
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                        : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                    }`}
                  >
                    {actionLoadingId === node.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isDead ? (
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Skull className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{isDead ? "Revive Node" : "Simulate Node Crash (Kill)"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="white-panel p-4 sm:p-5 space-y-3 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-3">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-700" /> System Event Audit Trail
          </h3>
          <span className="text-xs font-mono text-slate-400">Last 50 events</span>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-2 pr-1 touch-pan-y">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No audit logs logged yet.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-semibold shrink-0">
                    {log.eventType}
                  </span>
                  <span className="text-slate-800 font-medium truncate">{log.message}</span>
                </div>

                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
