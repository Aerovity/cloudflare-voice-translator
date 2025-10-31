/**
 * Durable Object for storing conversation/translation memory
 * Persists translation history for each session
 */

export interface TranslationEntry {
  original: string;
  translated: string;
  sourceLang?: string;
  targetLang: string;
  timestamp: number;
}

export class ConversationMemory {
  private state: DurableObjectState;
  private translations: TranslationEntry[] = [];

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Load existing translations from storage
    if (this.translations.length === 0) {
      const stored = await this.state.storage.get<TranslationEntry[]>('translations');
      if (stored) {
        this.translations = stored;
      }
    }

    // Add new translation entry
    if (url.pathname === '/add' && request.method === 'POST') {
      const entry: TranslationEntry = await request.json();
      this.translations.push(entry);

      // Keep only last 50 translations
      if (this.translations.length > 50) {
        this.translations = this.translations.slice(-50);
      }

      await this.state.storage.put('translations', this.translations);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all translations
    if (url.pathname === '/get' && request.method === 'GET') {
      return new Response(JSON.stringify({
        translations: this.translations,
        count: this.translations.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Clear history
    if (url.pathname === '/clear' && request.method === 'POST') {
      this.translations = [];
      await this.state.storage.delete('translations');

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  }
}
