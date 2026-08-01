"use client";

import React, { useState } from "react";
import {
  Lock,
  X,
  Users,
  Clock,
  Globe,
  Laptop,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/Toast";

interface VisitorLog {
  id: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  browser: string;
  os: string;
  deviceType: string;
  durationSeconds: number;
  pagePath: string;
  createdAt: string;
}

interface AnalyticsStats {
  totalVisitors: number;
  uniqueVisitors: number;
  averageDurationSeconds: number;
  logs: VisitorLog[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminVisitorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();

  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  if (!isOpen) return null;

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/analytics/stats?secretKey=${encodeURIComponent(passkey)}`);
      
      if (!res.ok) {
        throw new Error("Invalid Admin Secret Passkey.");
      }

      const data: AnalyticsStats = await res.json();
      setStats(data);
      setIsAuthenticated(true);
      showToast("success", "Admin access granted!");
    } catch (err) {
      setErrorMsg("Incorrect secret passkey. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!passkey) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/stats?secretKey=${encodeURIComponent(passkey)}`);
      if (res.ok) {
        setStats(await res.json());
        showToast("info", "Visitor telemetry updated!");
      }
    } catch (err) {
      showToast("error", "Failed to refresh telemetry.");
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return "< 10s";
    const mins = Math.floor(sec / 60);
    const remainderSec = Math.floor(sec % 60);
    if (mins === 0) return `${remainderSec}s`;
    return `${mins}m ${remainderSec}s`;
  };

  const handleClose = () => {
    setErrorMsg("");
    setPasskey("");
    setShowPasskey(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full ${
          isAuthenticated ? "max-w-4xl" : "max-w-md"
        } bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-900" />
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {isAuthenticated ? "Private Visitor Analytics" : "Admin Access"}
            </h3>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Password Prompt (Unauthenticated state) */}
        {!isAuthenticated ? (
          <form onSubmit={handleAuthenticate} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Secret Passkey</label>
              <div className="relative flex items-center">
                <input
                  type={showPasskey ? "text" : "password"}
                  value={passkey}
                  onChange={(e) => setPasskey(e.target.value)}
                  placeholder="Enter Secret Passkey"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  title={showPasskey ? "Hide passkey" : "Show passkey"}
                >
                  {showPasskey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errorMsg && <p className="text-xs font-semibold text-rose-600 mt-1">{errorMsg}</p>}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center transition-colors border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Submit"}
              </button>
            </div>
          </form>
        ) : (
          /* Authenticated Dashboard View */
          <div className="p-3 sm:p-6 space-y-5 overflow-y-auto w-full">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="white-panel p-3 space-y-1 border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <span>Total Visits</span>
                  <Users className="w-3.5 h-3.5 text-slate-700" />
                </div>
                <div className="text-xl font-black text-slate-900">{stats?.totalVisitors || 0}</div>
              </div>

              <div className="white-panel p-3 space-y-1 border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <span>Unique Visitors</span>
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-xl font-black text-slate-900">{stats?.uniqueVisitors || 0}</div>
              </div>

              <div className="white-panel p-3 space-y-1 border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  <span>Avg Dwell Time</span>
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-xl font-black text-slate-900">
                  {formatDuration(stats?.averageDurationSeconds || 0)}
                </div>
              </div>
            </div>

            {/* Refresh Action Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-slate-900" /> Visitor Telemetry Log
              </h4>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            {/* MOBILE CARD VIEW (< 640px) */}
            <div className="block sm:hidden space-y-3">
              {stats?.logs.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs">No visitor logs recorded yet.</p>
              ) : (
                stats?.logs.map((log) => (
                  <div
                    key={log.id}
                    className="white-panel p-3 space-y-2 border-slate-200 text-xs text-slate-800"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="font-mono font-bold text-slate-900 text-xs">{log.ip}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400" />
                        <span>{log.city}, {log.region}, {log.country}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1">
                        {log.deviceType === "Mobile" ? (
                          <Smartphone className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Laptop className="w-3 h-3 text-slate-500" />
                        )}
                        <span>{log.os} / {log.browser}</span>
                      </div>
                      <span className="font-semibold text-emerald-700">
                        {formatDuration(log.durationSeconds)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* DESKTOP TABLE VIEW (≥ 640px) */}
            <div className="hidden sm:block white-panel overflow-hidden border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[640px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Timestamp</th>
                      <th className="px-3 py-2">IP Address</th>
                      <th className="px-3 py-2">Location & Region</th>
                      <th className="px-3 py-2">Device & Browser</th>
                      <th className="px-3 py-2">Time Spent</th>
                      <th className="px-3 py-2">Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 text-[11px]">
                    {stats?.logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-slate-400">
                          No visitor logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      stats?.logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                            {log.ip}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            <span className="inline-flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-400" />
                              {log.city}, {log.region}, {log.country}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              {log.deviceType === "Mobile" ? (
                                <Smartphone className="w-3 h-3 text-slate-500" />
                              ) : (
                                <Laptop className="w-3 h-3 text-slate-500" />
                              )}
                              <span>{log.os} / {log.browser}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">
                            {formatDuration(log.durationSeconds)}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-600">
                            {log.pagePath}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
