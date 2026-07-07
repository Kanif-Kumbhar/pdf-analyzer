# 📄 PDF Analyzer Pro

A modern, high-performance Next.js application designed to retrieve, analyze, and extract deep insights from PDF documents via web URLs. 

It provides structured metadata, intelligent reading time estimates, complexity indexing, core key takeaways, and key points summaries through a premium user interface.

---

## ✨ Key Features

- **🔗 URL-Based Ingestion**: Paste any direct PDF link to analyze it instantly.
- **🧠 Deep Content Summarization**: Automatic generation of document summaries and high-level key takeaways.
- **🏷️ Topic Tagging & Key Points**: Identifies key topics and lists bulleted key arguments/points.
- **📊 Structural Metadata**: Displays page counts, language, target audience, complexity levels, and reading time estimates.
- **🛡️ Robust Error Handling**: Clean, user-friendly validation checklist interface when URLs are broken, restricted, or non-PDFs.
- **🎨 Premium UI/UX**: Designed with smooth micro-animations, glassmorphic accents, and responsive layout consistency.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Library**: React 19
- **Styling**: Tailwind CSS v4 + PostCSS
- **Language**: TypeScript

---

## 🚀 Getting Started

Follow these steps to run the application locally:

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the template environment file to create your local config:
```bash
cp .env.example .env.local
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

---

## 📁 Project Structure

```
├── app/                  # Next.js page routes, layouts, and global styles
├── components/           # React components
│   └── analyzer/         # PDF-specific UI components (results, errors, skeleton)
├── lib/                  # Business logic (parsing, security checks, helpers)
└── public/               # Static assets
```
