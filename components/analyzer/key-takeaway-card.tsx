import React from "react";

interface KeyTakeawayCardProps {
  takeaway: string;
}

export default function KeyTakeawayCard({ takeaway }: KeyTakeawayCardProps) {
  return (
    <div className="bg-primary/5 border-l-2 border-primary p-4 rounded-r-lg flex gap-3 items-start">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5 text-primary shrink-0 mt-0.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.666 8.944L9 9.75l-.666-.806A9.06 9.06 0 0 1 6 3.75h9.75a9.06 9.06 0 0 1-1.334 5.194L13.75 9.75l-.666-.806A3.75 3.75 0 0 0 9.666 8.944Z"
        />
      </svg>
      <div>
        <h4 className="font-label-md text-label-md text-on-surface font-bold mb-1">
          Key Takeaway
        </h4>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          {takeaway}
        </p>
      </div>
    </div>
  );
}
