import { z } from "zod";

// Zod schema for incoming browser requests.
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

// Zod schema for error API responses.
export const analyzeFailureResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1, "Error code is required"),
    message: z.string().min(1, "Error message is required"),
    requestId: z.string().min(1, "Request ID is required"),
  }),
});

export type AnalyzeFailureResponse = z.infer<typeof analyzeFailureResponseSchema>;
