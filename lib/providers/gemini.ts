import { GoogleGenAI } from "@google/genai";
import { PDF_ANALYSIS_PROMPT } from "../analysis/prompt";

// Schema for Gemini's structured JSON output
const geminiAnalysisResponseSchema = {
  type: "OBJECT",
  properties: {
    documentType: { 
      type: "STRING", 
      description: "Categorized type of the document (e.g. Research Paper, Invoice, User Manual, etc.)" 
    },
    title: { 
      type: "STRING", 
      description: "The official title or a generated descriptive title of the document" 
    },
    authors: { 
      type: "ARRAY", 
      items: { type: "STRING" },
      description: "List of authors, creators, or organizations responsible for the document"
    },
    summary: { 
      type: "STRING", 
      description: "Concise professional summary of the document (2-4 sentences)" 
    },
    keyTakeaway: { 
      type: "STRING", 
      description: "The single most important conclusion or action point in one sentence" 
    },
    topics: { 
      type: "ARRAY", 
      items: { type: "STRING" },
      description: "List of 3-5 main topics or categories discussed"
    },
    keyPoints: { 
      type: "ARRAY", 
      items: { type: "STRING" },
      description: "List of 3-5 critical bullet arguments, facts, or findings"
    },
    targetAudience: { 
      type: "STRING", 
      description: "The intended reader category (e.g. AI Researchers, General Public, Developers)" 
    },
    complexityLevel: { 
      type: "STRING", 
      description: "Estimated complexity level (e.g. Beginner, Intermediate, Advanced)" 
    },
    language: { 
      type: "STRING", 
      description: "Primary language of the document (e.g. English, Spanish, German)" 
    }
  },
  required: [
    "documentType",
    "title",
    "authors",
    "summary",
    "keyTakeaway",
    "topics",
    "keyPoints",
    "targetAudience",
    "complexityLevel",
    "language"
  ]
};

let clientInstance: GoogleGenAI | null = null;

// Lazy initialization helper for Google Gen AI client.
function getGenAIClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is missing. Please add it to your .env.local file."
      );
    }
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

// Analyze PDF content using Gemini 2.5 Flash with structured JSON output.
export async function analyzePdfWithGemini(pdfBuffer: Buffer): Promise<unknown> {
  const ai = getGenAIClient();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBuffer.toString("base64"),
        },
      },
      { text: PDF_ANALYSIS_PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: geminiAnalysisResponseSchema as unknown as Record<string, unknown>,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini API returned an empty or invalid content response.");
  }

  try {
    return JSON.parse(text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse structured JSON from Gemini response: ${msg}. Raw output: ${text}`);
  }
}
