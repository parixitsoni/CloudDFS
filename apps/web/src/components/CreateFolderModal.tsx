"use client";

import React, { useState } from "react";
import { FolderPlus, X, AlertCircle } from "lucide-react";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => Promise<void>;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validateFolderName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "Folder name cannot be empty.";
    }
    if (trimmed.length > 50) {
      return "Folder name cannot exceed 50 characters.";
    }
    // Check for invalid path characters
    const invalidChars = /[\\/:\*\?"<>\|]/;
    if (invalidChars.test(trimmed)) {
      return 'Folder name cannot contain special characters: \\ / : * ? " < > |';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFolderName(val);
    if (error) {
      setError(validateFolderName(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateFolderName(folderName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(folderName.trim());
      setFolderName("");
      onClose();
    } catch (err) {
      setError((err as Error).message || "Failed to create folder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="white-panel max-w-sm w-full p-5 space-y-4 shadow-xl border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Create New Folder</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Folder Name
            </label>
            <input
              type="text"
              placeholder="e.g. Project Documents"
              value={folderName}
              onChange={handleChange}
              autoFocus
              className={`w-full bg-slate-50 border rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none transition-colors ${
                error
                  ? "border-rose-400 focus:border-rose-500 bg-rose-50/30"
                  : "border-slate-200 focus:border-slate-400"
              }`}
            />
            {error && (
              <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-btn-secondary py-1.5 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-btn-primary py-1.5 text-xs font-semibold"
            >
              {isSubmitting ? "Creating..." : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
