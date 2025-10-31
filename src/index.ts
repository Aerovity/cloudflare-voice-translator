/**
 * Cloudflare Voice-to-Voice Translator
 * Uses Workers AI (Llama 3.3), Durable Objects, and KV
 */

export interface Env {
  AI: Ai;
  CONVERSATION_MEMORY: DurableObjectNamespace;
  TRANSLATION_CACHE: KVNamespace;
}

export { ConversationMemory } from './durable-objects/ConversationMemory';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: Transcribe audio (speech-to-text)
    if (url.pathname === '/api/transcribe' && request.method === 'POST') {
      try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
          return new Response(JSON.stringify({ error: 'No audio file provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Convert audio to array buffer for Workers AI
        const audioBuffer = await audioFile.arrayBuffer();

        // Use Whisper model for speech-to-text
        const response = await env.AI.run('@cf/openai/whisper', {
          audio: [...new Uint8Array(audioBuffer)]
        });

        return new Response(JSON.stringify({
          text: response.text,
          language: response.language || 'unknown'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Transcription failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Route: Translate text using Llama 3.3
    if (url.pathname === '/api/translate' && request.method === 'POST') {
      try {
        const { text, sourceLang, targetLang, sessionId } = await request.json();

        if (!text || !targetLang) {
          return new Response(JSON.stringify({
            error: 'Missing required fields: text, targetLang'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check cache first
        const cacheKey = `${text}-${sourceLang}-${targetLang}`;
        const cached = await env.TRANSLATION_CACHE.get(cacheKey);
        if (cached) {
          return new Response(JSON.stringify({
            translatedText: cached,
            cached: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Use Llama 3.3 for translation
        const prompt = `Translate the following text from ${sourceLang || 'auto-detect'} to ${targetLang}. Provide ONLY the translation, no explanations or additional text.\n\nText: ${text}\n\nTranslation:`;

        const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          prompt,
          max_tokens: 500,
          temperature: 0.3
        });

        const translatedText = response.response?.trim() || '';

        // Store conversation in Durable Object if sessionId provided
        if (sessionId) {
          const id = env.CONVERSATION_MEMORY.idFromName(sessionId);
          const stub = env.CONVERSATION_MEMORY.get(id);
          await stub.fetch(new Request('https://internal/add', {
            method: 'POST',
            body: JSON.stringify({
              original: text,
              translated: translatedText,
              sourceLang,
              targetLang,
              timestamp: Date.now()
            })
          }));
        }

        // Cache the translation for 1 hour
        await env.TRANSLATION_CACHE.put(cacheKey, translatedText, { expirationTtl: 3600 });

        return new Response(JSON.stringify({
          translatedText,
          cached: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Translation failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Route: Text-to-speech
    if (url.pathname === '/api/synthesize' && request.method === 'POST') {
      try {
        const { text, lang } = await request.json();

        if (!text) {
          return new Response(JSON.stringify({ error: 'No text provided' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Note: Workers AI doesn't have native TTS yet, so we'll return the text
        // In production, you'd integrate with an external TTS API (e.g., ElevenLabs, Google TTS)
        // or use the browser's Web Speech API on the frontend

        return new Response(JSON.stringify({
          text,
          message: 'Use browser Web Speech API for synthesis',
          lang
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Synthesis request failed',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Route: Get conversation history
    if (url.pathname === '/api/history' && request.method === 'GET') {
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const id = env.CONVERSATION_MEMORY.idFromName(sessionId);
        const stub = env.CONVERSATION_MEMORY.get(id);
        const response = await stub.fetch(new Request('https://internal/get'));
        const history = await response.json();

        return new Response(JSON.stringify(history), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Failed to retrieve history',
          details: error.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Default route - serve info
    return new Response(JSON.stringify({
      name: 'Cloudflare Voice-to-Voice Translator',
      version: '1.0.0',
      endpoints: {
        transcribe: 'POST /api/transcribe (multipart/form-data with audio file)',
        translate: 'POST /api/translate (JSON: {text, sourceLang, targetLang, sessionId})',
        synthesize: 'POST /api/synthesize (JSON: {text, lang})',
        history: 'GET /api/history?sessionId=xxx'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
