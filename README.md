# YNAB Statement Formatter

Converts credit card statement images to YNAB-compatible CSV format using AI-powered extraction.

## Features

- AI-powered transaction extraction from statement images
- Multi-provider support: Google AI Studio, OpenRouter, z.ai, LM Studio
- Model Testing Lab to compare AI performance
- Smart date parsing for various formats
- Batch processing of multiple statements
- Custom instructions for bank-specific formats
- Editable results before export

## Quick Start

1. Clone and install:
```bash
git clone https://github.com/yjsoon/ynab-llm-formatter.git
cd ynab-formatter
npm install
```

2. Configure API key (Google AI Studio recommended):
```bash
cp .env.example .env.local
# Edit .env.local with your API key
```

3. Start the server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Option 1: Google AI Studio (Default)
```env
LLM_PROVIDER=googleaistudio
GOOGLEAISTUDIO_API_KEY=your_api_key_here
GOOGLEAISTUDIO_MODEL=gemini-2.5-flash-lite
```

Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Option 2: OpenRouter
```env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=google/gemini-2.5-flash-lite
```

Sign up at [openrouter.ai](https://openrouter.ai) for API access.

### Option 3: z.ai
```env
LLM_PROVIDER=z.ai
Z_AI_API_KEY=your_api_key_here
```

### Option 4: LM Studio (Local)
```env
LLM_PROVIDER=lm-studio
LM_STUDIO_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=qwen2.5-vl-7b-instruct
```

Download [LM Studio](https://lmstudio.ai/) and load a vision-capable model.

## Usage

1. Select AI model from dropdown
2. Upload statement images (PNG, JPG, WebP)
3. Add custom instructions if needed
4. Process and review extracted transactions
5. Download CSV for YNAB import

### Custom Instructions

- "Dates are in DD/MM/YYYY format"
- "Ignore transactions marked as REVERSAL"
- "Foreign currency amounts shown as (USD 50.00)"
- "Statement is from DBS Bank Singapore"

## Model Testing Lab

Visit `/test` to compare AI models:
- Test extraction accuracy across providers
- Compare processing speeds and costs
- Find the best model for your statement format

## Development

```bash
npm run dev    # Development server
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint
```

## License

MIT