"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive, Server, Cloud, Cpu, Menu, X, ChevronRight } from "lucide-react";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 border-b border-slate-200/90 backdrop-blur-md px-3.5 sm:px-6 py-3 mb-4 sm:mb-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200">
              <HardDrive className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  CloudDFS
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-medium">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Fault-Tolerant Distributed Storage</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <Link
              href="/"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === "/"
                  ? "bg-slate-900 text-white shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <HardDrive className="w-4 h-4" />
              File Explorer
            </Link>

            <Link
              href="/admin"
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === "/admin"
                  ? "bg-slate-900 text-white shadow-sm font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Server className="w-4 h-4" />
              Cluster Dashboard
            </Link>
          </nav>

          {/* Desktop Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Object Storage Active</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-medium">
              <Cpu className="w-3.5 h-3.5 text-slate-600" />
              <span>N=2 Replication</span>
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 active:scale-95 transition-transform"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-slate-900" />
          </button>
        </div>
      </header>

      {/* FULL-SCREEN WHITE BACKGROUND MOBILE OVERLAY DRAWER */}
      {mounted && mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-white p-5 flex flex-col justify-between overflow-y-auto md:hidden animate-in fade-in duration-200">
          <div>
            {/* Overlay Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tracking-tight text-slate-900">
                      CloudDFS
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-mono font-medium">
                      v1.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Fault-Tolerant Distributed Storage</p>
                </div>
              </Link>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 active:scale-95 transition-transform"
                aria-label="Close Navigation Menu"
              >
                <X className="w-6 h-6 text-slate-900" />
              </button>
            </div>

            {/* Overlay Main Links */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Navigation
              </p>

              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between p-4 rounded-2xl text-base font-bold transition-all ${
                  pathname === "/"
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-slate-50 text-slate-800 border border-slate-200/80 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5" />
                  <span>File Explorer</span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-60" />
              </Link>

              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between p-4 rounded-2xl text-base font-bold transition-all ${
                  pathname === "/admin"
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-slate-50 text-slate-800 border border-slate-200/80 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5" />
                  <span>Cluster Dashboard</span>
                </div>
                <ChevronRight className="w-5 h-5 opacity-60" />
              </Link>
            </div>
          </div>

          {/* Overlay Footer Telemetry */}
          <div className="space-y-4 pt-6 border-t border-slate-200 mt-6">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Cluster Telemetry
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium text-xs justify-center">
                <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Object Storage</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs justify-center">
                <Cpu className="w-4 h-4 text-slate-600 shrink-0" />
                <span>N=2 Replication</span>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 pt-2 font-mono">
              CloudDFS System v1.0
            </p>
          </div>
        </div>
      )}
    </>
  );
};
