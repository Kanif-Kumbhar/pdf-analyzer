import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Analyzer Pro - Intelligent Document Summarization",
  description: "Extract summaries, key takeaways, and metadata from any online document instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        {children}
      </body>
    </html>
  );
}
