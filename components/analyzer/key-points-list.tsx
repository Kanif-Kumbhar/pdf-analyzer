import React from "react";

interface KeyPointsListProps {
  points: string[];
}

export default function KeyPointsList({ points }: KeyPointsListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-headline-md text-headline-md text-on-surface">
        Key Highlights
      </h3>
      <ul className="space-y-2">
        {points.map((point, idx) => (
          <li key={idx} className="flex items-start gap-2.5">
            <span className="bg-primary-container text-on-primary font-label-md text-label-md px-2 py-0.5 rounded-md mt-0.5 select-none text-[11px] font-bold">
              {idx + 1}
            </span>
            <span className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {point}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
