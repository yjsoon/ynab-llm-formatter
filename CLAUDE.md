# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js application that converts credit card statement images to YNAB-compatible CSV format using AI-powered extraction via the z.ai API.

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
   - Accepts image files (PNG/JPG) via multipart form upload
   - Uses z.ai API with `glm-4.5v` vision model for image processing
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

The application supports two LLM providers:

#### Option 1: Z.AI (Cloud-based)
```
LLM_PROVIDER=z.ai
Z_AI_API_KEY=<your_api_key>
```

#### Option 2: LM Studio (Local)
```
LLM_PROVIDER=lm-studio
LM_STUDIO_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=mini-cpm  # or your loaded model name
```

**LM Studio Setup:**
1. Download and install LM Studio from https://lmstudio.ai/
2. Load your preferred model (e.g., Mini CPM)
3. Start the local server (usually on port 1234)
4. Update `.env` with `LLM_PROVIDER=lm-studio`

**Note:** For image processing with LM Studio, ensure your model supports vision capabilities.

### Key Dependencies

- **Next.js 15.5.3** with App Router and Turbopack
- **papaparse**: CSV generation
- **axios**: API calls to z.ai
- **Tailwind CSS v4**: Styling