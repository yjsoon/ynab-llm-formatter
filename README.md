# YNAB Statement Formatter

Converts credit card statement images to YNAB-compatible CSV format using AI-powered extraction.

## Features

- **AI-Powered Extraction**: Uses vision AI models to extract transactions from statement images
- **Multiple AI Providers**: OpenRouter (cloud), z.ai (cloud), and LM Studio (local)
- **Batch Processing**: Process multiple statement images at once
- **Smart Date Parsing**: Handles DD/MM/YYYY, MM/DD/YYYY, and ambiguous date formats
- **Custom Instructions**: Add specific prompts for your bank's format
- **Editable Results**: Review and edit before downloading
- **YNAB-Ready CSV**: Outputs in YNAB's expected format

## YNAB CSV Format

YNAB (You Need A Budget) expects CSV files with specific columns:

| Column | Description | Example |
|--------|-------------|---------|
| **Date** | Transaction date in YYYY-MM-DD format | 2025-06-15 |
| **Payee** | Merchant or company name | Starbucks |
| **Memo** | Additional details (optional) | USD 5.50 |
| **Outflow** | Money spent (debits) | $123.45 |
| **Inflow** | Money received (credits) | $50.00 |

**Important**: Each transaction should have EITHER an Outflow OR an Inflow value, never both.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- At least one AI provider API key (see below)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yjsoon/ynab-llm-formatter.git
cd ynab-formatter
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```

4. Configure your AI provider (see Configuration section below)

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### AI Provider Options

The app supports three AI provider options. Choose one and configure it in your `.env.local` file:

#### Option 1: OpenRouter (Recommended)

OpenRouter provides access to multiple AI models through a single API. Best for flexibility and reliability.

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=google/gemini-flash-1.5-8b  # Optional, can be changed in UI
```

**Getting an API Key:**
1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Add credits to your account
3. Copy your API key from settings

**Available Models** (selectable in UI):
- Gemini 2.5 Flash Lite (fastest)
- Pixtral 12B
- Claude 3 Haiku
- Llama 4 Scout (FREE)
- GPT-4o Mini
- And more...

#### Option 2: z.ai (Alternative Cloud)

z.ai provides access to advanced Chinese AI models with good vision capabilities.

```env
LLM_PROVIDER=z.ai
Z_AI_API_KEY=your_api_key_here
```

**Getting an API Key:**
1. Sign up at [z.ai](https://z.ai)
2. Navigate to API settings
3. Generate and copy your API key

#### Option 3: LM Studio (Local/Private)

Run AI models locally on your machine for complete privacy. No data leaves your computer.

```env
LLM_PROVIDER=lm-studio
LM_STUDIO_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=qwen2.5-vl-7b-instruct  # Or your loaded model
```

**Setup Instructions:**
1. Download [LM Studio](https://lmstudio.ai/)
2. Download a vision-capable model (e.g., Qwen2.5-VL, Mini-CPM-V)
3. Load the model in LM Studio
4. Start the local server (usually on port 1234)
5. Update `.env.local` with your model name

**Note**: Local models require significant RAM (8GB+ recommended) and may be slower than cloud options.

## Usage

### Basic Usage

1. **Select AI Model** (OpenRouter only): Choose from the dropdown in the top-right corner
2. **Upload Statements**: Drag and drop or click to browse for statement images (PNG, JPG, WebP)
3. **Add Custom Instructions** (Optional): Provide specific rules for your bank's format
4. **Process**: Click the process button to extract transactions
5. **Review & Edit**: Check extracted data and make corrections if needed
6. **Download CSV**: Export the formatted CSV for YNAB import

### Custom Instructions Examples

Use the Custom Instructions field to handle bank-specific formats:

- "Dates are in DD/MM/YYYY format"
- "Ignore transactions marked as 'REVERSAL'"
- "Foreign currency amounts shown as (USD 50.00)"
- "Use merchant name from description, not reference number"
- "Statement is from DBS Bank Singapore"

### Tips for Best Results

1. **Image Quality**: Use clear, high-resolution screenshots or scans
2. **Full Transactions**: Ensure all transaction details are visible in the image
3. **Multiple Pages**: Process multiple statement pages in one batch
4. **Date Formats**: The AI handles most date formats automatically, but custom instructions can help with ambiguous cases
5. **Review Results**: Always review extracted data before importing to YNAB

## Model Testing

Visit `/test` to access the Model Testing Arena where you can:
- Compare extraction accuracy across different AI models
- Test processing speed and costs
- Find the best model for your statement format

## Development

### Tech Stack

- **Framework**: Next.js 15.5 with App Router
- **Styling**: Tailwind CSS v4
- **AI Integration**: OpenRouter API, z.ai API, LM Studio
- **CSV Generation**: PapaParse
- **Language**: TypeScript

### Project Structure

```
├── app/
│   ├── api/
│   │   ├── process-statement/   # Main extraction endpoint
│   │   └── test-models/         # Model comparison endpoint
│   ├── page.tsx                 # Main UI
│   └── test/page.tsx            # Testing interface
├── components/
│   ├── FileUploader.tsx        # Drag-and-drop upload
│   └── TransactionTable.tsx    # Results display/edit
└── types/
    └── transaction.ts           # TypeScript definitions
```

### Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built for the [YNAB](https://www.ynab.com) community
- Powered by various AI model providers
- Inspired by the need to quickly digitise paper statements

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/yjsoon/ynab-llm-formatter/issues).