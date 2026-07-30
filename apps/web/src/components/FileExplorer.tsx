"use client";

import React, { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  Share2,
  CheckCircle,
  RefreshCw,
  Search,
  ChevronRight,
  Layers,
  ShieldAlert,
  X,
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  totalChunks: number;
  isFolder: boolean;
  parentFolderId: string | null;
  replicationFactor: number;
  status: string;
  createdAt: string;
}

export const FileExplorer: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Root" },
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

  const fetchFiles = async (folderId: string | null = currentFolderId) => {
    setLoading(true);
    try {
      const url = folderId
        ? `${API_BASE}/api/files?parentFolderId=${folderId}`
        : `${API_BASE}/api/files`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentFolderId);
  }, [currentFolderId]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/api/files/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentFolderId: currentFolderId,
        }),
      });
      if (res.ok) {
        setNewFolderName("");
        setShowFolderModal(false);
        fetchFiles();
      }
    } catch (err) {
      console.error("Create folder failed:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatusText(`Initiating upload for "${selectedFile.name}"...`);

    try {
      const initRes = await fetch(`${API_BASE}/api/files/upload/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: selectedFile.name,
          sizeBytes: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          parentFolderId: currentFolderId,
          replicationFactor: 2,
        }),
      });

      if (!initRes.ok) {
        throw new Error("Failed to initiate upload");
      }

      const initData = await initRes.json();
      const { fileId, totalChunks, chunkSize, placements } = initData;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, selectedFile.size);
        const chunkBlob = selectedFile.slice(start, end);
        const placement = placements[i];

        setUploadStatusText(
          `Uploading Chunk ${i + 1}/${totalChunks} (${placement.primaryNodeId})...`
        );

        const formData = new FormData();
        formData.append("chunk", chunkBlob, `chunk_${i}.bin`);
        formData.append("fileId", fileId);
        formData.append("chunkIndex", i.toString());
        formData.append("primaryNodeId", placement.primaryNodeId);
        formData.append("replicaNodeId", placement.replicaNodeId || "");
        formData.append("storageKeyPrimary", placement.storageKeyPrimary);
        formData.append("storageKeyReplica", placement.storageKeyReplica || "");

        const chunkRes = await fetch(`${API_BASE}/api/chunks/upload`, {
          method: "POST",
          body: formData,
        });

        if (!chunkRes.ok) {
          throw new Error(`Chunk ${i} upload failed`);
        }

        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      setUploadStatusText("Finalizing metadata...");
      setTimeout(() => {
        setIsUploading(false);
        fetchFiles();
      }, 800);
    } catch (err) {
      console.error("File upload error:", err);
      setUploadStatusText(`Upload error: ${(err as Error).message}`);
      setTimeout(() => setIsUploading(false), 3000);
    }
  };

  const handleDownload = (file: FileItem) => {
    window.open(`${API_BASE}/api/files/${file.id}/download`, "_blank");
  };

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/files/${file.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchFiles();
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
    }
  };

  const handleShare = (file: FileItem) => {
    const link = `${API_BASE}/api/files/${file.id}/download`;
    navigator.clipboard.writeText(link);
    alert(`Share link copied:\n${link}`);
  };

  const navigateToFolder = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Toolbar */}
      <div className="white-panel p-3.5 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-sm py-0.5">
          {breadcrumbs.map((b, idx) => (
            <React.Fragment key={b.id || "root"}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
              <button
                onClick={() => navigateToBreadcrumb(idx)}
                className={`truncate max-w-[100px] sm:max-w-[140px] transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? "text-slate-900 font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {b.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Mobile Toolbar Layout (Stacked 3 Rows on < 640px) */}
        <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2">
          {/* Search Box - Full Width on Mobile */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          {/* Mobile Buttons Row (Upload, New Folder, Refresh) */}
          <div className="flex items-center gap-2">
            <label className="min-btn-primary py-2 px-3 text-xs sm:text-sm cursor-pointer flex-1 justify-center sm:flex-none">
              <Upload className="w-4 h-4" />
              <span>Upload</span>
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={() => setShowFolderModal(true)}
              className="min-btn-secondary py-2 px-3 text-xs sm:text-sm flex-1 justify-center sm:flex-none"
            >
              <FolderPlus className="w-4 h-4 text-slate-600" />
              <span>New Folder</span>
            </button>

            <button
              onClick={() => fetchFiles()}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors shrink-0"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="white-panel p-4 space-y-2 border-slate-300 shadow-sm">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-800 truncate max-w-[75%]">{uploadStatusText}</span>
            <span className="text-slate-900 font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-slate-900 transition-all duration-300 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="white-panel p-4 animate-pulse flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-slate-200 rounded"></div>
                <div className="h-4 w-36 bg-slate-200 rounded"></div>
              </div>
              <div className="h-6 w-20 bg-slate-150 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="white-panel p-10 text-center text-slate-500">
          <Folder className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          No files found in this directory.
        </div>
      ) : (
        <>
          {/* MOBILE VIEW CARDS (< 640px) */}
          <div className="block sm:hidden space-y-3">
            {filteredFiles.map((file) => (
              <div key={file.id} className="white-panel p-3.5 space-y-3">
                {/* Folder Card Mobile Layout */}
                {file.isFolder ? (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => navigateToFolder(file)}
                      className="flex items-center gap-2 font-semibold text-slate-900 text-sm hover:underline min-w-0"
                    >
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="min-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Healthy
                      </span>
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                        title="Delete Folder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* File Card Mobile Layout */
                  <>
                    {/* Header: Title */}
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <h4 className="font-semibold text-slate-900 text-sm leading-snug break-words flex-1">
                        {file.name}
                      </h4>
                    </div>

                    {/* Status & Metadata Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div>
                        {file.status === "READY" && (
                          <span className="min-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Healthy
                          </span>
                        )}
                        {file.status === "UNDER_REPLICATED" && (
                          <span className="min-badge bg-amber-50 text-amber-700 border-amber-200">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            Under-Replicated
                          </span>
                        )}
                        {file.status === "UPLOADING" && (
                          <span className="min-badge bg-slate-100 text-slate-700 border-slate-200">
                            <RefreshCw className="w-3 h-3 animate-spin text-slate-700" />
                            Uploading
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>{formatSize(file.sizeBytes)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-700 font-medium">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {file.totalChunks} {file.totalChunks === 1 ? "chunk" : "chunks"}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                          N={file.replicationFactor}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleDownload(file)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <button
                        onClick={() => handleShare(file)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 flex items-center justify-center gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium border border-rose-200 flex items-center justify-center shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* DESKTOP TABLE VIEW (≥ 640px) */}
          <div className="hidden sm:block white-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Name</th>
                    <th className="px-4 py-3.5">Size</th>
                    <th className="px-4 py-3.5">Chunks</th>
                    <th className="px-4 py-3.5">Replication</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3.5 font-medium text-slate-900">
                        {file.isFolder ? (
                          <button
                            onClick={() => navigateToFolder(file)}
                            className="flex items-center gap-2.5 hover:text-slate-900 text-left group"
                          >
                            <Folder className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                            <span className="truncate max-w-xs">{file.name}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            <span className="truncate max-w-xs">{file.name}</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {file.isFolder ? "—" : formatSize(file.sizeBytes)}
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {file.isFolder ? (
                          "—"
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px] text-slate-700 font-medium">
                            <Layers className="w-3 h-3 text-slate-500" />
                            {file.totalChunks} {file.totalChunks === 1 ? "chunk" : "chunks"}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {file.isFolder ? (
                          "—"
                        ) : (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                            N={file.replicationFactor}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {file.status === "READY" && (
                          <span className="min-badge bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Healthy
                          </span>
                        )}
                        {file.status === "UNDER_REPLICATED" && (
                          <span className="min-badge bg-amber-50 text-amber-700 border-amber-200">
                            <ShieldAlert className="w-3 h-3 text-amber-600" />
                            Under-Replicated
                          </span>
                        )}
                        {file.status === "UPLOADING" && (
                          <span className="min-badge bg-slate-100 text-slate-700 border-slate-200">
                            <RefreshCw className="w-3 h-3 animate-spin text-slate-700" />
                            Uploading
                          </span>
                        )}
                      </td>

                      <td className="px-4 sm:px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!file.isFolder && (
                            <>
                              <button
                                onClick={() => handleDownload(file)}
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white transition-all duration-200 border border-slate-200"
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleShare(file)}
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                                title="Share Link"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(file)}
                            className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="white-panel max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900">Create New Folder</h3>
              <button
                onClick={() => setShowFolderModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <input
                type="text"
                placeholder="Folder Name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="min-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="min-btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
