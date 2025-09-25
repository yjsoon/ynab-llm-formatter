# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js application that converts credit card statements (PDF/image) to YNAB-compatible CSV format using AI-powered extraction via the z.ai API.

## Commands

```bash
# Development
npm run dev           # Start development server with Turbopack on http://localhost:3000
npm run build         # Build for production with Turbopack
npm run start         # Start production server
npm run lint          # Run ESLint

# No test framework is currently configured
```

## Architecture

### Core Components

1. **API Route Processing** (`app/api/process-statement/route.ts`)
   - Accepts PDF or image files via multipart form upload
   - PDF text extraction using `pdf-parse` via CommonJS module in `lib/pdf-parser.js`
   - Uses z.ai API with model switching:
     - `glm-4.5` for text-based PDF processing
     - `glm-4.5v` vision model for images
   - Returns transactions in YNAB format (date, payee, memo, outflow, inflow)

2. **Frontend Flow**
   - `app/page.tsx`: Main page with state management for transactions, loading, and errors
   - `components/FileUploader.tsx`: Drag-and-drop file upload interface
   - `components/TransactionTable.tsx`: Display and export transactions to CSV

### Data Format

Transactions follow YNAB CSV structure:
- `date`: YYYY-MM-DD format
- `payee`: Merchant name
- `memo`: Additional details (foreign currency, references)
- `outflow`: Charges/debits (positive number with $)
- `inflow`: Credits/refunds (positive number with $)

### Environment Configuration

Required environment variable in `.env`:
```
Z_AI_API_KEY=<your_api_key>
```

### Key Dependencies

- **Next.js 15.5.3** with App Router and Turbopack
- **pdf-parse**: Extract text from PDFs (wrapped in CommonJS module)
- **papaparse**: CSV generation
- **axios**: API calls to z.ai
- **Tailwind CSS v4**: Styling