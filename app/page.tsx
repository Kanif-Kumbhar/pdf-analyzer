"use client";

import React, { useState, useEffect } from "react";
import UrlForm from "../components/analyzer/url-form";
import AnalysisResult, { AnalysisData } from "../components/analyzer/analysis-result";
import AnalysisSkeleton from "../components/analyzer/analysis-skeleton";
import AnalysisError from "../components/analyzer/analysis-error";
import { analyzeRequestSchema } from "../lib/validation/analyze-request";


type VisualState = "IDLE" | "LOADING" | "SUCCESS" | "ERROR";

const mockAnalysis: AnalysisData = {
  documentType: "Research Paper",
  title: "Attention Is All You Need",
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  summary:
    "This paper introduces the Transformer, a new simple network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.",
  keyTakeaway:
    "Attention mechanisms alone can replace recurrence and convolution, achieving state-of-the-art results while dramatically improving training speed and parallelizability.",
  topics: ["Transformers", "Attention", "Deep Learning"],
  keyPoints: [
    "Introduces the Transformer architecture based solely on self-attention",
    "Removes recurrence and convolution from sequence-to-sequence modeling",
    "Uses multi-head self-attention to capture dependencies regardless of distance",
  ],
  targetAudience: "AI Researchers",
  complexityLevel: "Advanced",
  language: "English",
  metadata: {
    pageCount: 15,
    estimatedReadingMinutes: 24,
  },
};

export default function Home() {
  const [state, setState] = useState<VisualState>("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<string[]>([
    "Future of LLMs",
    "Climate Change Analysis Report 2024",
  ]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [analysisRemaining, setAnalysisRemaining] = useState<number | null>(null);
  const [analysisMax, setAnalysisMax] = useState<number>(10);

  // Fetch the rate limit status for the client IP
  const updateRateLimit = async () => {
    try {
      const response = await fetch("/api/limit");
      if (response.ok) {
        const payload = await response.json();
        setAnalysisRemaining(payload.analysisRemaining);
        setAnalysisMax(payload.analysisMax);
      }
    } catch (err) {
      console.warn("Failed to fetch rate limit status:", err);
    }
  };

  useEffect(() => {
    updateRateLimit();
  }, []);


  const handleUrlSubmit = async (url: string) => {
    // Validate the URL using the Zod schema contract
    const result = analyzeRequestSchema.safeParse({ pdfUrl: url });
    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message || "Invalid URL");
      setErrorCode("INVALID_URL");
      setErrorRequestId(null);
      setState("ERROR");
      return;
    }

    setState("LOADING");
    setErrorMessage("");
    setErrorCode(null);
    setErrorRequestId(null);

    try {
      console.log("Sending request to /api/analyze with URL:", url);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pdfUrl: url }),
      });

      console.log("Response received. Status:", response.status, "OK:", response.ok);
      const payload = await response.json();
      console.log("Response payload:", payload);

      if (!response.ok) {
        const errorMsg = payload.error?.message || "Failed to analyze the PDF document.";
        const code = payload.error?.code || "INTERNAL_ERROR";
        const reqId = payload.error?.requestId || null;
        console.warn("API returned error:", errorMsg, "Code:", code, "RequestId:", reqId);
        setErrorMessage(errorMsg);
        setErrorCode(code);
        setErrorRequestId(reqId);
        setState("ERROR");
        return;
      }

      setAnalysisData(payload.data);
      setState("SUCCESS");

      // Add to recent analyses
      const filename = url.split("/").pop() || "Document Analysis";
      setRecentAnalyses((prev) => [filename, ...prev.slice(0, 4)]);
    } catch (err: any) {
      console.error("Error in handleUrlSubmit:", err);
      setErrorMessage(err.message || "An unexpected error occurred while communicating with the server.");
      setErrorCode("CLIENT_FETCH_ERROR");
      setErrorRequestId(null);
      setState("ERROR");
    } finally {
      // Refresh the rate limit status dynamically
      updateRateLimit();
    }
  };

  const handleRetry = () => {
    setState("IDLE");
    setErrorMessage("");
    setErrorCode(null);
    setErrorRequestId(null);
  };

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 sticky top-0 z-50 w-full">
        <div className="max-w-[1280px] mx-auto h-16 px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="font-headline-md text-headline-md font-bold text-on-background">
              PDF Analyzer
            </span>
            <span className="bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Pro
            </span>
          </div>
          <div className="flex gap-4 items-center">
            {analysisRemaining !== null && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                analysisRemaining <= 2 
                  ? "bg-error-container text-on-error-container border-error/20 animate-pulse" 
                  : "bg-primary/5 text-primary border-primary/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${analysisRemaining <= 2 ? "bg-error" : "bg-primary"}`}></span>
                AI Analyses Remaining: {analysisRemaining} / {analysisMax}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col items-center py-10 px-6 max-w-[1280px] mx-auto w-full gap-8">
        {/* Hero Section */}
        <section className="w-full max-w-3xl flex flex-col items-center text-center gap-4">
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
            Analyze any PDF instantly
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
            Extract summaries, key takeaways, and structural metadata from any document URL.
          </p>
          
          <div className="w-full mt-4">
            <UrlForm onSubmit={handleUrlSubmit} isLoading={state === "LOADING"} />
            
            {state === "IDLE" && (
              <p className="text-xs text-on-surface-variant/75 mt-3">
                Try pasting any PDF link, or type <code className="bg-surface-container px-1 py-0.5 rounded font-mono font-semibold">error</code> to simulate a failed request.
              </p>
            )}
          </div>
        </section>

        {/* Dynamic States Container */}
        <section className="w-full flex justify-center min-h-[300px]">
          {state === "IDLE" && (
            <div className="w-full max-w-4xl border border-dashed border-outline-variant/60 rounded-xl p-12 flex flex-col items-center justify-center text-center gap-4 bg-surface-container-low/30">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-13.5h3.75a1.125 1.125 0 0 1 1.125 1.125v16.5a1.125 1.125 0 0 1-1.125 1.125H7.5A1.125 1.125 0 0 1 6.375 18.75V4.625A1.125 1.125 0 0 1 7.5 3.5h3.75a1.125 1.125 0 0 1 .5.124Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  No analysis active
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mt-1">
                  Enter a document link above to trigger the intelligent metadata and summary extractor.
                </p>
              </div>
            </div>
          )}

          {state === "LOADING" && <AnalysisSkeleton />}

          {state === "SUCCESS" && <AnalysisResult data={analysisData || mockAnalysis} />}

          {state === "ERROR" && (
            <AnalysisError
              code={errorCode}
              message={errorMessage || "Something went wrong while retrieving the file."}
              requestId={errorRequestId}
              onRetry={handleRetry}
            />
          )}
        </section>

        {/* Recent Analyses List */}
        <section className="w-full max-w-4xl mt-6 flex flex-col gap-4">
          <h3 className="font-headline-md text-headline-md text-on-surface">
            Recent Analyses
          </h3>
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[12px] overflow-hidden shadow-sm">
            {recentAnalyses.map((title, idx) => (
              <a
                key={idx}
                className="flex items-center justify-between p-4 border-b last:border-0 border-outline-variant/20 hover:bg-surface-container-low transition-colors group"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setState("SUCCESS");
                }}
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-outline group-hover:text-primary transition-colors"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                  <span className="font-body-md text-body-md text-on-surface font-medium">
                    {title}
                  </span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4 text-outline-variant"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/30 w-full mt-auto">
        <div className="max-w-[1280px] mx-auto py-6 px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-body-md text-body-md text-on-surface-variant">
            © 2026 PDF Analyzer Pro. Precision document intelligence.
          </div>
          <div className="flex gap-6 font-body-md text-body-md">
            <a className="text-on-secondary-container hover:text-primary transition-colors" href="#">
              Privacy Policy
            </a>
            <a className="text-on-secondary-container hover:text-primary transition-colors" href="#">
              Terms of Service
            </a>
            <a className="text-on-secondary-container hover:text-primary transition-colors" href="#">
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
