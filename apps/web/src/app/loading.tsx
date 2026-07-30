import React from "react";

export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Top Toolbar Skeleton */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="h-5 w-32 bg-slate-200 rounded"></div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-9 w-40 bg-slate-200 rounded-lg"></div>
          <div className="h-9 w-24 bg-slate-200 rounded-lg"></div>
        </div>
      </div>

      {/* Main Table / Card Skeleton */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="h-4 w-full bg-slate-100 rounded"></div>
        <div className="h-12 w-full bg-slate-100 rounded-lg"></div>
        <div className="h-12 w-full bg-slate-100 rounded-lg"></div>
        <div className="h-12 w-full bg-slate-100 rounded-lg"></div>
      </div>
    </div>
  );
}
