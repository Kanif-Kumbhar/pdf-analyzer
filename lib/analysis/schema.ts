import { z } from "zod";

/**
 * Zod schema defining the structure of the model's analysis output
 * and the success response data object.
 */
export const pdfAnalysisSchema = z.object({
  documentType: z.string().min(1, "Document type is required"),
  title: z.string().min(1, "Title is required"),
  authors: z.array(z.string()),
  summary: z.string().min(1, "Summary is required"),
  keyTakeaway: z.string().min(1, "Key takeaway is required"),
  topics: z.array(z.string()),
  keyPoints: z.array(z.string()),
  targetAudience: z.string().min(1, "Target audience is required"),
  complexityLevel: z.string().min(1, "Complexity level is required"),
  language: z.string().min(1, "Language is required"),
  metadata: z.object({
    pageCount: z.number().int().nonnegative().default(0),
    estimatedReadingMinutes: z.number().int().nonnegative().default(0),
    analyzedAt: z.string().min(1, "Analyzed timestamp is required"),
  }),
});

export type PdfAnalysis = z.infer<typeof pdfAnalysisSchema>;

/**
 * Zod schema defining the success API response structure.
 */
export const analysisSuccessResponseSchema = z.object({
  data: pdfAnalysisSchema,
});

export type AnalysisSuccessResponse = z.infer<typeof analysisSuccessResponseSchema>;
