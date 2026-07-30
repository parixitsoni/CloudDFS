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
  FileCheck,
  Radio,
  Clock,
  PieChart,
} from "lucide-react";

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
  activeNodesCount: number;
  unhealthyNodesCount: number;
  deadNodesCount: number;
  underReplicatedFilesCount: number;
  systemHealthStatus: "HEALTHY" | "DEGRADED" | "CRITICAL";
  timestamp: string;
}

interface AuditLog {
  id: string;
  eventType: string;
  message: string;
  details: string | null;
  createdAt: string;
}

export const ClusterDashboard: React.FC = () => {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [metrics, setMetrics] = useState<ClusterMetrics | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  const fetchData = async () => {
    try {
      const [nodesRes, metricsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/nodes`),
        fetch(`${API_BASE}/api/metrics`),
        fetch(`${API_BASE}/api/audit-logs`),
      ]);

      if (nodesRes.ok) setNodes(await nodesRes.json());
      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (err) {
      console.error("Dashboard poll error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateFailover = async (nodeId: string, currentStatus: string) => {
    setActionLoadingId(nodeId);
    const action = currentStatus === "DEAD" ? "REVIVE" : "KILL";

    try {
      const res = await fetch(`${API_BASE}/api/nodes/${nodeId}/failover-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Failover simulation error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Health Banner */}
      <div className="white-panel p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${
              metrics?.systemHealthStatus === "HEALTHY"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : metrics?.systemHealthStatus === "DEGRADED"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {metrics?.systemHealthStatus === "HEALTHY" ? (
              <ShieldCheck className="w-5 h-5" />
            ) : metrics?.systemHealthStatus === "DEGRADED" ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Skull className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Cluster Status</h2>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                  metrics?.systemHealthStatus === "HEALTHY"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : metrics?.systemHealthStatus === "DEGRADED"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {metrics?.systemHealthStatus || "HEALTHY"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Metadata Coordinator & Data Node Telemetry
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="min-btn-secondary text-xs py-1.5 self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Overview Grid (2 cols on mobile, 4 cols on desktop) */}
      {loading && !metrics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="white-panel p-3.5 h-24 bg-slate-100 rounded-xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          <div className="white-panel p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Total Files</span>
              <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics?.totalFiles ?? 0}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">Indexed metadata</p>
          </div>

          <div className="white-panel p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Storage Used</span>
              <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight truncate">
              {formatSize(metrics?.totalStorageUsedBytes ?? 0)}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">Object storage</p>
          </div>

          <div className="white-panel p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Active Nodes</span>
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 animate-pulse" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics?.activeNodesCount ?? 0}
            </p>
            <p className="text-[10px] sm:text-[11px] text-emerald-600 font-medium truncate">5s heartbeats online</p>
          </div>

          <div className="white-panel p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider">Under-Replicated</span>
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            </div>
            <p className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {metrics?.underReplicatedFilesCount ?? 0}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">Auto-repair ready</p>
          </div>
        </div>
      )}

      {/* Data Nodes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500" />
            Data Node Instances
          </h3>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Failover simulation: test killing or reviving node instances
          </span>
        </div>

        {loading && nodes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="white-panel p-4 h-44 bg-slate-100 rounded-xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`white-panel p-3.5 sm:p-4 space-y-3 ${
                  node.status === "ACTIVE"
                    ? "border-slate-200"
                    : node.status === "UNHEALTHY"
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-rose-300 bg-rose-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{node.name}</h4>
                    <p className="text-xs font-mono text-slate-500 truncate">{node.address}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border shrink-0 ${
                      node.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : node.status === "UNHEALTHY"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                {/* Hardware Usage Progress */}
                <div className="space-y-2 text-xs pt-1">
                  <div>
                    <div className="flex justify-between text-slate-500 text-[11px] mb-1">
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-slate-500" /> CPU Load
                      </span>
                      <span className="font-mono text-slate-900 font-medium">{node.cpuUsagePct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-slate-800 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(node.cpuUsagePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-500 text-[11px] mb-1">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-slate-500" /> Memory Load
                      </span>
                      <span className="font-mono text-slate-900 font-medium">{node.memoryUsagePct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-slate-700 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(node.memoryUsagePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-slate-500 text-[11px] pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> Heartbeat
                    </span>
                    <span className="font-mono text-slate-700">
                      {new Date(node.lastHeartbeat).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Simulation Action Button */}
                <div className="pt-1">
                  <button
                    onClick={() => handleSimulateFailover(node.id, node.status)}
                    disabled={actionLoadingId === node.id}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      node.status === "DEAD"
                        ? "min-btn-success w-full justify-center"
                        : "min-btn-danger w-full justify-center"
                    }`}
                  >
                    {actionLoadingId === node.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : node.status === "DEAD" ? (
                      <>
                        <Zap className="w-3.5 h-3.5" /> Revive Node
                      </>
                    ) : (
                      <>
                        <Skull className="w-3.5 h-3.5" /> Kill Node (Simulate Crash)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Audit Trail (Fully Mobile Responsive & Smooth Touch Scroll) */}
      <div className="white-panel p-3.5 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-500" />
          Cluster Audit Trail
        </h3>

        {/* Scroll Container with Touch-Pan-Y & Smooth Momentum Scroll */}
        <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto touch-pan-y pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No recent cluster events logged.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-slate-50/90 border border-slate-200 text-xs space-y-1.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 hover:border-slate-300 transition-colors"
              >
                {/* Header row on mobile: Badge & Timestamp */}
                <div className="flex items-center justify-between gap-2 sm:justify-start shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200/90 text-slate-800 font-semibold border border-slate-300">
                    {log.eventType}
                  </span>
                  <span className="text-slate-500 font-mono text-[10px] sm:hidden">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Log Message with Natural Wrapping (Never Truncates or Overflow Scrolls) */}
                <p className="text-slate-800 font-medium break-words text-xs leading-relaxed flex-1">
                  {log.message}
                </p>

                {/* Timestamp on Desktop */}
                <span className="text-slate-500 font-mono text-[10px] hidden sm:block shrink-0">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
