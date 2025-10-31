# 🌍 Cloudflare Voice-to-Voice Translator

A real-time voice-to-voice translation application powered by Cloudflare's AI stack, demonstrating the power of **Workers AI**, **Llama 3.3**, **Durable Objects**, **KV**, and **Cloudflare Pages**.

Built for Cloudflare's AI assignment to showcase a creative, real-world use case of their AI ecosystem.

## 🎯 Project Overview

This application allows users to:
1. **Speak** in their native language
2. **Transcribe** speech to text using Workers AI (Whisper model)
3. **Translate** the text using Llama 3.3 on Workers AI
4. **Listen** to the translation via text-to-speech (Web Speech API)
5. **Store** conversation history using Durable Objects
6. **Cache** translations using Cloudflare KV for performance

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                          │
│  (Frontend: HTML + CSS + JavaScript)                         │
│  - Voice Recording UI                                        │
│  - Translation Display                                       │
│  - Audio Playback                                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ API Calls
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloudflare Workers                           │
│  (Orchestration Layer: TypeScript)                           │
│                                                               │
│  Routes:                                                      │
│  • POST /api/transcribe  → Speech-to-Text                   │
│  • POST /api/translate   → LLM Translation                   │
│  • POST /api/synthesize  → Text-to-Speech Info              │
│  • GET  /api/history     → Retrieve Conversation            │
└──────────┬──────────────┬──────────────┬────────────────────┘
           │              │              │
           ▼              ▼              ▼
   ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐
   │  Workers AI  │  │   Durable   │  │  Cloudflare KV   │
   │              │  │   Objects   │  │                  │
   │ - Whisper    │  │             │  │ - Translation    │
   │   (STT)      │  │ - Session   │  │   Cache          │
   │ - Llama 3.3  │  │   Memory    │  │ - 1hr TTL        │
   │   (LLM)      │  │ - History   │  │                  │
   └──────────────┘  └─────────────┘  └──────────────────┘
```

## 🚀 Cloudflare Products Used

### 1. **Workers AI** ⭐
- **Whisper Model** (`@cf/openai/whisper`): Converts speech to text
- **Llama 3.3 70B** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`): Performs intelligent translation with context understanding

### 2. **Cloudflare Workers** ⚡
- Serverless backend handling all API requests
- Routes for transcription, translation, and history management
- CORS support for frontend integration

### 3. **Durable Objects** 💾
- Persistent storage for conversation/translation history
- Session-based memory management
- Maintains up to 50 translations per session

### 4. **Cloudflare KV** 🗄️
- Caches translations to reduce API calls
- 1-hour TTL for cached results
- Key format: `{text}-{sourceLang}-{targetLang}`

### 5. **Cloudflare Pages** 🌐
- Hosts the frontend application
- Modern, responsive UI with voice recording
- Real-time display of transcription and translation

## 📋 Meeting Assignment Criteria

### ✅ Criterion 1: Use of Workers AI
- **Whisper** model for speech-to-text transcription
- **Llama 3.3 70B** for intelligent, context-aware translation
- Demonstrates multiple AI models working together

### ✅ Criterion 2: Cloudflare Workers Integration
- TypeScript-based Worker handling all backend logic
- RESTful API endpoints for transcription, translation, and history
- Proper error handling and CORS configuration

### ✅ Criterion 3: Storage (Durable Objects + KV)
- **Durable Objects** store session-based conversation history
- **KV** caches translations for performance optimization
- Data persistence across requests

### ✅ Criterion 4: Creative Real-World Application
- **Voice-to-voice translation** is a practical, user-friendly tool
- Useful for travelers, language learners, and international communication
- Demonstrates the power of AI for breaking language barriers
- Professional UI/UX with modern design

## 🛠️ Setup & Deployment

### Prerequisites
- Node.js 18+ installed
- Cloudflare account ([sign up free](https://dash.cloudflare.com/sign-up))
- Wrangler CLI installed globally

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aerovity/cloudflare-voice-translator.git
   cd cloudflare-voice-translator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

4. **Create KV namespace**
   ```bash
   npx wrangler kv:namespace create "TRANSLATION_CACHE"
   npx wrangler kv:namespace create "TRANSLATION_CACHE" --preview
   ```

   Update `wrangler.toml` with the generated IDs:
   ```toml
   [[kv_namespaces]]
   binding = "TRANSLATION_CACHE"
   id = "your_production_id"
   preview_id = "your_preview_id"
   ```

5. **Deploy the Worker**
   ```bash
   npm run deploy
   ```

6. **Deploy the Frontend (Pages)**
   ```bash
   npm run deploy:pages
   ```

   Or connect your GitHub repo to Cloudflare Pages:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
   - Click "Create a project" → "Connect to Git"
   - Select your repository
   - Build settings:
     - Build command: (leave empty)
     - Build output directory: `public`

7. **Update API URL**

   After deploying the Worker, copy your Worker URL and update it in `public/app.js`:
   ```javascript
   const API_BASE_URL = 'https://voice-translator.YOUR-SUBDOMAIN.workers.dev';
   ```

   Redeploy Pages after updating.

### Local Development

1. **Start the Worker locally**
   ```bash
   npm run dev
   ```

2. **Serve the frontend**
   Open `public/index.html` in your browser, or use a local server:
   ```bash
   npx serve public
   ```

3. The Worker will run on `http://localhost:8787` and the frontend will automatically connect to it.

## 🎮 Usage

1. **Select Languages**: Choose source and target languages from the dropdowns
2. **Record Audio**: Click "Start Recording" and speak clearly
3. **View Results**: See transcribed text and translation appear automatically
4. **Listen**: Click "Speak Translation" to hear the translated text
5. **Review History**: Scroll down to see all translations in your session

## 🧪 Testing

### Test the Worker endpoints directly:

**Transcribe Audio:**
```bash
curl -X POST https://voice-translator.YOUR-SUBDOMAIN.workers.dev/api/transcribe \
  -F "audio=@recording.webm"
```

**Translate Text:**
```bash
curl -X POST https://voice-translator.YOUR-SUBDOMAIN.workers.dev/api/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how are you?",
    "sourceLang": "English",
    "targetLang": "Spanish",
    "sessionId": "test-session"
  }'
```

**Get History:**
```bash
curl https://voice-translator.YOUR-SUBDOMAIN.workers.dev/api/history?sessionId=test-session
```

## 📁 Project Structure

```
cloudflare-voice-translator/
├── src/
│   ├── index.ts                      # Main Worker script
│   └── durable-objects/
│       └── ConversationMemory.ts     # Durable Object for history
├── public/
│   ├── index.html                    # Frontend UI
│   ├── styles.css                    # Styling
│   └── app.js                        # Frontend logic
├── wrangler.toml                     # Cloudflare configuration
├── package.json                      # Dependencies
├── tsconfig.json                     # TypeScript config
└── README.md                         # This file
```

## 🌟 Features

- ✅ Real-time voice recording and transcription
- ✅ AI-powered translation using Llama 3.3
- ✅ Text-to-speech output in target language
- ✅ Translation caching for performance
- ✅ Conversation history storage
- ✅ Support for 12+ languages
- ✅ Modern, responsive UI
- ✅ No backend server needed (serverless)
- ✅ Fast global deployment via Cloudflare edge network

## 🔒 Security & Privacy

- No data stored long-term on servers
- Session-based history (temporary)
- CORS enabled for browser security
- Audio processed in-memory only
- Translations cached for 1 hour max

## 🚧 Future Enhancements

- [ ] Add support for file upload (audio/video)
- [ ] Implement batch translation
- [ ] Add language auto-detection UI feedback
- [ ] Support for more languages
- [ ] Native TTS integration (when available in Workers AI)
- [ ] User authentication and persistent history
- [ ] Real-time streaming translation

## 📄 License

MIT License - feel free to use this project for learning or building upon it.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Aerovity/cloudflare-voice-translator/issues).

## 👨‍💻 Author

Built as part of Cloudflare's AI assignment to demonstrate the capabilities of their AI platform.

---

**Built with ❤️ using Cloudflare's AI Stack**

🔗 [Live Demo](https://voice-translator.pages.dev) | 📚 [Documentation](https://developers.cloudflare.com/workers-ai/)
