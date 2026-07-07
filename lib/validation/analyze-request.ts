import { z } from "zod";

/**
 * Zod schema defining the structure of the incoming browser request.
 */
export const analyzeRequestSchema = z.object({
  pdfUrl: z
    .string({
      message: "PDF URL is required",
    })
    .trim()
    .url("Please enter a valid HTTP or HTTPS URL.")
    .refine((url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, {
      message: "Please enter a valid HTTP or HTTPS URL.",
    }),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

/**
 * Zod schema defining the failure API response structure.
 */
export const analyzeFailureResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1, "Error code is required"),
    message: z.string().min(1, "Error message is required"),
    requestId: z.string().min(1, "Request ID is required"),
  }),
});

export type AnalyzeFailureResponse = z.infer<typeof analyzeFailureResponseSchema>;
