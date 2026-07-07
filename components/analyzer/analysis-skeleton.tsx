import React from "react";

export default function AnalysisSkeleton() {
  return (
    <div className="w-full max-w-4xl bg-surface-container-lowest border border-outline-variant/30 rounded-[12px] shadow-card p-8 flex flex-col gap-6 animate-pulse">
      {/* Title & Type skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-6 w-28 bg-surface-container-high rounded-md"></div>
        <div className="h-8 w-3/4 bg-surface-container-high rounded-md"></div>
        <div className="h-4 w-40 bg-surface-container-high rounded-md mt-1"></div>
      </div>

      <div className="h-px w-full bg-outline-variant/20"></div>

      {/* Summary skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-6 w-24 bg-surface-container-high rounded-md"></div>
        <div className="h-4 w-full bg-surface-container-high rounded-md"></div>
        <div className="h-4 w-full bg-surface-container-high rounded-md"></div>
        <div className="h-4 w-5/6 bg-surface-container-high rounded-md"></div>
      </div>

      {/* Takeaway skeleton */}
      <div className="bg-surface-container-low border-l-2 border-outline-variant p-4 rounded-r-lg flex gap-3">
        <div className="h-5 w-5 bg-surface-container-high rounded-full shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 bg-surface-container-high rounded-md"></div>
          <div className="h-4 w-full bg-surface-container-high rounded-md"></div>
        </div>
      </div>

      {/* Topics & Key points skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <div className="h-4 w-12 bg-surface-container-high rounded-md"></div>
          <div className="h-6 w-16 bg-surface-container-high rounded-md"></div>
          <div className="h-6 w-20 bg-surface-container-high rounded-md"></div>
          <div className="h-6 w-24 bg-surface-container-high rounded-md"></div>
        </div>
      </div>

      <div className="h-px w-full bg-outline-variant/20"></div>

      {/* Metadata grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-3 w-20 bg-surface-container-high rounded-md"></div>
            <div className="h-5 w-16 bg-surface-container-high rounded-md"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
