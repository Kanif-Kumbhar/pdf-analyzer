import React from "react";

interface TopicsListProps {
  topics: string[];
}

export default function TopicsList({ topics }: TopicsListProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-label-md text-label-md text-on-surface-variant font-medium mr-1">
        Topics:
      </span>
      {topics.map((topic, idx) => (
        <span
          key={idx}
          className="bg-surface-container text-on-surface font-label-md text-label-md px-3 py-1 rounded-md border border-outline-variant/20 hover:bg-surface-container-high transition-colors"
        >
          {topic}
        </span>
      ))}
    </div>
  );
}
