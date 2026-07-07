"use client";

import React, { useState } from "react";

interface UrlFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export default function UrlForm({ onSubmit, isLoading }: UrlFormProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-3">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste PDF URL here"
        required
        disabled={isLoading}
        className="flex-grow rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-primary-container text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:bg-surface-tint transition-colors flex items-center gap-1.5 shadow-card disabled:opacity-60 cursor-pointer"
      >
        <span>Analyze</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-4.5 h-4.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
      </button>
    </form>
  );
}
