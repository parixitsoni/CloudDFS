import React from "react";

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white border border-slate-200 p-5 rounded-xl h-20"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-28"></div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-28"></div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-28"></div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-28"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-48"></div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl h-48"></div>
      </div>
    </div>
  );
}
