import { AppError } from "../errors/app-error";

const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE
  ? parseInt(process.env.MAX_FILE_SIZE, 10)
  : 10 * 1024 * 1024; // 10 MB default

export interface ValidatedUpload {
  data: Buffer; // Raw PDF bytes as a Buffer
  filename: string; // Original filename from the upload
  size: number; // Byte size of the file
}

// Extract, size-check, and validate an uploaded PDF file from multipart/form-data.
export async function validateUploadedPdf(request: Request): Promise<ValidatedUpload> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw AppError.invalidRequest("Could not parse multipart form data. Please upload a valid PDF file.");
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw AppError.invalidRequest("No file was provided. Please include a 'file' field in the form data.");
  }

  const filename = file.name || "upload.pdf";

  // Size check before reading all bytes
  if (file.size > MAX_FILE_SIZE) {
    throw AppError.pdfTooLarge("This PDF exceeds the maximum supported size (10 MB).");
  }

  // Read all bytes
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Double-check actual byte count (file.size can be spoofed in some environments)
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw AppError.pdfTooLarge("This PDF exceeds the maximum supported size (10 MB).");
  }

  // Reject empty files
  if (buffer.byteLength < 5) {
    throw AppError.invalidPdf("The uploaded file is too small to be a valid PDF.");
  }

  // Magic byte check: PDF files must start with %PDF-
  const signature = buffer.toString("ascii", 0, 5);
  if (signature !== "%PDF-") {
    throw AppError.invalidPdf(
      "The uploaded file is not a valid PDF document. Only PDF files are accepted."
    );
  }

  return { data: buffer, filename, size: buffer.byteLength };
}
