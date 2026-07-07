import React from "react";

interface MetadataRowProps {
  targetAudience: string;
  complexityLevel: string;
  estimatedReadingMinutes: number;
  pageCount: number;
  language: string;
}

export default function MetadataRow({
  targetAudience,
  complexityLevel,
  estimatedReadingMinutes,
  pageCount,
  language,
}: MetadataRowProps) {
  const items = [
    { label: "Target Audience", value: targetAudience },
    { label: "Complexity", value: complexityLevel },
    { label: "Reading Time", value: `${estimatedReadingMinutes} min` },
    { label: "Page Count", value: `${pageCount} pages` },
    { label: "Language", value: language },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <span className="font-label-md text-label-md text-on-surface-variant font-medium">
            {item.label}
          </span>
          <span className="font-body-md text-body-md text-on-surface font-semibold">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
