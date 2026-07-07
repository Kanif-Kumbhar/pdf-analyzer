import React from "react";
import MetadataRow from "./metadata-row";
import KeyTakeawayCard from "./key-takeaway-card";
import TopicsList from "./topics-list";
import KeyPointsList from "./key-points-list";

export interface AnalysisData {
  documentType: string;
  title: string;
  authors: string[];
  summary: string;
  keyTakeaway: string;
  topics: string[];
  keyPoints: string[];
  targetAudience: string;
  complexityLevel: string;
  language: string;
  metadata: {
    pageCount: number;
    estimatedReadingMinutes: number;
  };
}

interface AnalysisResultProps {
  data: AnalysisData;
}

export default function AnalysisResult({ data }: AnalysisResultProps) {
  return (
    <div className="w-full max-w-4xl bg-surface-container-lowest border border-outline-variant/30 rounded-[12px] shadow-card p-6 sm:p-8 flex flex-col gap-6 transition-all duration-300">
      {/* Header Info */}
      <div className="flex flex-col gap-3">
        <div>
          <span className="inline-flex items-center bg-surface-container-high text-on-surface-variant font-label-md text-label-md px-3 py-1 rounded-md mb-3 font-semibold">
            {data.documentType}
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface leading-snug">
            {data.title}
          </h2>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          By {data.authors.join(", ")}
        </p>
      </div>

      <div className="h-px w-full bg-outline-variant/20"></div>

      {/* Summary */}
      <div className="flex flex-col gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">
          Summary
        </h3>
        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
          {data.summary}
        </p>
      </div>

      {/* Key Takeaway */}
      <KeyTakeawayCard takeaway={data.keyTakeaway} />

      {/* Topics */}
      <div className="flex flex-col gap-4 mt-2">
        <TopicsList topics={data.topics} />
        <KeyPointsList points={data.keyPoints} />
      </div>

      <div className="h-px w-full bg-outline-variant/20 my-2"></div>

      {/* Metadata Grid */}
      <MetadataRow
        targetAudience={data.targetAudience}
        complexityLevel={data.complexityLevel}
        estimatedReadingMinutes={data.metadata.estimatedReadingMinutes}
        pageCount={data.metadata.pageCount}
        language={data.language}
      />
    </div>
  );
}
