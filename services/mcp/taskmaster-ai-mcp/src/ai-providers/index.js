/**
 * src/ai-providers/index.js
 * Central export point for all AI provider classes
 * Now using lazy loading to reduce startup time
 */

import { aiProviderLoader } from './lazy-loader.js';

// Export the lazy loader for direct access
export { aiProviderLoader };

// Create placeholder classes that load real implementation on first use
class LazyAnthropicAIProvider {
  constructor() {
    this._loaded = false;
    this._instance = null;
  }
  
  async _ensureLoaded() {
    if (!this._loaded) {
      const Provider = await aiProviderLoader.getProvider('anthropic');
      this._instance = new Provider();
      this._loaded = true;
    }
    return this._instance;
  }
  
  async generateText(...args) {
    const instance = await this._ensureLoaded();
    return instance.generateText(...args);
  }
  
  async streamText(...args) {
    const instance = await this._ensureLoaded();
    return instance.streamText(...args);
  }
  
  async generateObject(...args) {
    const instance = await this._ensureLoaded();
    return instance.generateObject(...args);
  }
}

// For backward compatibility, export classes that work like constructors
export const AnthropicAIProvider = LazyAnthropicAIProvider;

// For now, keep original exports for other providers to avoid breaking everything
export { PerplexityAIProvider } from './perplexity.js';
export { GoogleAIProvider } from './google.js';
export { OpenAIProvider } from './openai.js';
export { XAIProvider } from './xai.js';
export { OpenRouterAIProvider } from './openrouter.js';
export { OllamaAIProvider } from './ollama.js';
export { BedrockAIProvider } from './bedrock.js';
export { AzureProvider } from './azure.js';
export { VertexAIProvider } from './google-vertex.js';

// Helper function to get provider by name
export async function getAIProvider(providerName) {
  return await aiProviderLoader.getProvider(providerName);
}
