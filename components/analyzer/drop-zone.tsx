"use client";

import React, { useRef, useState } from "react";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export default function DropZone({ onFileSelect, isLoading }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return; // silently ignore — validation happens on server with better error messages
    }
    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`
        relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed
        cursor-pointer transition-all duration-200 select-none
        ${isDragging
          ? "border-primary bg-primary/8 scale-[1.01]"
          : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary/50 hover:bg-primary/5"
        }
        ${isLoading ? "opacity-60 cursor-not-allowed" : ""}
        ${selectedFile ? "py-4" : "py-8"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        disabled={isLoading}
        onChange={handleInputChange}
      />

      {selectedFile ? (
        /* File selected state */
        <div className="flex items-center gap-3 px-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-primary">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-medium text-on-surface text-sm truncate">{selectedFile.name}</p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              {isLoading ? " — Analyzing..." : " — Click to change"}
            </p>
          </div>
          {isLoading && (
            <svg className="w-5 h-5 text-primary animate-spin shrink-0"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
      ) : (
        /* Empty state */
        <>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
            ${isDragging ? "bg-primary/20" : "bg-surface-container"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              strokeWidth={1.5} stroke="currentColor"
              className={`w-6 h-6 transition-colors ${isDragging ? "text-primary" : "text-on-surface-variant"}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="font-medium text-on-surface text-sm">
            {isDragging ? "Drop your PDF here" : "Drag and drop a PDF"}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            or <span className="text-primary font-semibold">browse files</span> — max 10 MB
          </p>
        </>
      )}
    </div>
  );
}
