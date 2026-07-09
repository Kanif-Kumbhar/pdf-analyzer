"use client";

import React, { useState, useEffect } from "react";
import UrlForm from "../components/analyzer/url-form";
import DropZone from "../components/analyzer/drop-zone";
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
  const [urlInput, setUrlInput] = useState("");
  const [inputTab, setInputTab] = useState<"url" | "upload">("url");
  
  interface HistoryItem {
    url: string;
    title: string;
    accessed_at: string;
  }
  
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  
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

  const fetchHistory = async (page: number) => {
    try {
      const res = await fetch(`/api/history?page=${page}&pageSize=3`);
      if (res.ok) {
        const payload = await res.json();
        setHistoryItems(payload.items || []);
        setHistoryTotal(payload.totalCount || 0);
        setHistoryPage(payload.page || 1);
      }
    } catch (err) {
      console.warn("Failed to fetch search history:", err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateRateLimit();
    fetchHistory(1);
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
      setUrlInput(url);
      fetchHistory(1);
    } catch (err: unknown) {
      console.error("Error in handleUrlSubmit:", err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred while communicating with the server.";
      setErrorMessage(msg);
      setErrorCode("CLIENT_FETCH_ERROR");
      setErrorRequestId(null);
      setState("ERROR");
    } finally {
      // Refresh the rate limit status dynamically
      updateRateLimit();
    }
  };

  const handleFileUpload = async (file: File) => {
    setState("LOADING");
    setErrorMessage("");
    setErrorCode(null);
    setErrorRequestId(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        const errorMsg = payload.error?.message || "Failed to analyze the PDF document.";
        const code = payload.error?.code || "INTERNAL_ERROR";
        const reqId = payload.error?.requestId || null;
        setErrorMessage(errorMsg);
        setErrorCode(code);
        setErrorRequestId(reqId);
        setState("ERROR");
        return;
      }

      setAnalysisData(payload.data);
      setState("SUCCESS");
      fetchHistory(1);
    } catch (err: unknown) {
      console.error("Error in handleFileUpload:", err);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setErrorCode("CLIENT_FETCH_ERROR");
      setErrorRequestId(null);
      setState("ERROR");
    } finally {
      updateRateLimit();
    }
  };

  const handleRetry = () => {
    setState("IDLE");
    setErrorMessage("");
    setErrorCode(null);
    setErrorRequestId(null);
  };

  // Load cached analysis result by content hash (for uploaded-file history items).
  const handleCachedResult = async (hash: string) => {
    setState("LOADING");
    setErrorMessage("");
    setErrorCode(null);
    setErrorRequestId(null);

    try {
      const response = await fetch(`/api/analyze/cached?hash=${hash}`);
      const payload = await response.json();

      if (!response.ok) {
        const errorMsg = payload.error?.message || "Could not load the cached result.";
        setErrorMessage(errorMsg);
        setErrorCode(payload.error?.code || "NOT_FOUND");
        setErrorRequestId(null);
        setState("ERROR");
        return;
      }

      setAnalysisData(payload.data);
      setState("SUCCESS");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setErrorCode("CLIENT_FETCH_ERROR");
      setErrorRequestId(null);
      setState("ERROR");
    }
  };

  // Handle click on history item. Uploads fetch from cache, URLs go to submit flow.
  const handleHistoryItemClick = (url: string) => {
    if (url.startsWith("upload::")) {
      const hash = url.replace("upload::", "");
      handleCachedResult(hash);
    } else {
      setInputTab("url");
      setUrlInput(url);
      handleUrlSubmit(url);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body-md min-h-screen flex flex-col">
      {/* TopNavBar */}
      <header className="bg-surface-container-lowest border-b border-outline-variant/30 sticky top-0 z-50 w-full">
        <div className="max-w-[1280px] mx-auto h-16 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="font-headline-md text-headline-md font-bold text-on-background text-lg sm:text-xl">
              PDF Analyzer
            </span>
            <span className="bg-primary/10 text-primary text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider">
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
                <span className="hidden sm:inline">AI Analyses Remaining: </span>
                <span className="sm:hidden">Remaining: </span>
                {analysisRemaining} / {analysisMax}
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
          
          <div className="w-full mt-4 flex flex-col gap-3">
            {/* Tab switcher */}
            <div className="flex rounded-lg border border-outline-variant/40 overflow-hidden w-full">
              <button
                onClick={() => setInputTab("url")}
                disabled={state === "LOADING"}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                  inputTab === "url"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
                } disabled:opacity-60`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
                URL
              </button>
              <button
                onClick={() => setInputTab("upload")}
                disabled={state === "LOADING"}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                  inputTab === "upload"
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
                } disabled:opacity-60`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                </svg>
                Upload PDF
              </button>
            </div>

            {inputTab === "url" ? (
              <UrlForm onSubmit={handleUrlSubmit} isLoading={state === "LOADING"} value={urlInput} onChange={setUrlInput} />
            ) : (
              <DropZone onFileSelect={handleFileUpload} isLoading={state === "LOADING"} />
            )}

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
            {historyItems.length === 0 ? (
              <div className="p-6 text-center text-on-surface-variant font-body-md">
                No recent analyses found.
              </div>
            ) : (
              <>
                {historyItems.map((item, idx) => {
                  const isUpload = item.url.startsWith("upload::");
                  return (
                    <a
                      key={idx}
                      className="flex items-center justify-between p-4 border-b last:border-0 border-outline-variant/20 hover:bg-surface-container-low transition-colors group"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleHistoryItemClick(item.url);
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isUpload ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            strokeWidth={1.5} stroke="currentColor"
                            className="w-5 h-5 shrink-0 text-outline group-hover:text-primary transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            strokeWidth={1.5} stroke="currentColor"
                            className="w-5 h-5 shrink-0 text-outline group-hover:text-primary transition-colors">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5-3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-md text-body-md text-on-surface font-medium truncate max-w-lg sm:max-w-xl md:max-w-2xl">
                            {item.title}
                          </span>
                          {isUpload && (
                            <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wider mt-0.5">
                              Uploaded file
                            </span>
                          )}
                        </div>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth={2} stroke="currentColor"
                        className="w-4 h-4 shrink-0 text-outline-variant">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </a>
                  );
                })}
                
                {/* Pagination Controls */}
                {historyTotal > 3 && (
                  <div className="flex justify-between items-center px-4 py-3 bg-surface-container-lowest border-t border-outline-variant/20">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Showing {(historyPage - 1) * 3 + 1} - {Math.min(historyPage * 3, historyTotal)} of {historyTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchHistory(historyPage - 1)}
                        disabled={historyPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-outline/30 text-body-sm hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed font-medium text-on-surface"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => fetchHistory(historyPage + 1)}
                        disabled={historyPage * 3 >= historyTotal}
                        className="px-3 py-1.5 rounded-lg border border-outline/30 text-body-sm hover:bg-surface-container-low transition-colors disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed font-medium text-on-surface"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/30 w-full mt-auto">
        <div className="max-w-[1280px] mx-auto py-6 px-6 flex justify-center items-center">
          <div className="font-body-md text-body-md text-on-surface-variant text-center">
            © 2026 PDF Analyzer Pro. Precision document intelligence.
          </div>
        </div>
      </footer>
    </div>
  );
}
