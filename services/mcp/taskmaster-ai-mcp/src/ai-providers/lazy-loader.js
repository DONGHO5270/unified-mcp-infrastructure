/**
 * Lazy loader for AI providers
 * Only loads AI SDK when actually needed, reducing startup time
 */

class AIProviderLazyLoader {
  constructor() {
    this.providers = new Map();
    this.loadingPromises = new Map();
  }

  /**
   * Get a provider instance, loading it only when needed
   * @param {string} providerName - Name of the AI provider
   * @returns {Promise<Object>} The AI provider instance
   */
  async getProvider(providerName) {
    // Return cached provider if already loaded
    if (this.providers.has(providerName)) {
      return this.providers.get(providerName);
    }

    // Return existing loading promise if provider is being loaded
    if (this.loadingPromises.has(providerName)) {
      return this.loadingPromises.get(providerName);
    }

    // Start loading the provider
    const loadingPromise = this.loadProvider(providerName);
    this.loadingPromises.set(providerName, loadingPromise);

    try {
      const provider = await loadingPromise;
      this.providers.set(providerName, provider);
      this.loadingPromises.delete(providerName);
      return provider;
    } catch (error) {
      this.loadingPromises.delete(providerName);
      throw error;
    }
  }

  /**
   * Dynamically load a specific AI provider
   * @param {string} providerName - Name of the AI provider
   * @returns {Promise<Object>} The loaded provider class
   */
  async loadProvider(providerName) {
    console.log(`Lazy loading AI provider: ${providerName}`);
    
    switch (providerName.toLowerCase()) {
      case 'anthropic':
        const { AnthropicAIProvider } = await import('./anthropic.js');
        return AnthropicAIProvider;

      case 'perplexity':
        const { PerplexityAIProvider } = await import('./perplexity.js');
        return PerplexityAIProvider;

      case 'google':
        const { GoogleAIProvider } = await import('./google.js');
        return GoogleAIProvider;

      case 'openai':
        const { OpenAIProvider } = await import('./openai.js');
        return OpenAIProvider;

      case 'xai':
        const { XAIProvider } = await import('./xai.js');
        return XAIProvider;

      case 'openrouter':
        const { OpenRouterAIProvider } = await import('./openrouter.js');
        return OpenRouterAIProvider;

      case 'ollama':
        const { OllamaAIProvider } = await import('./ollama.js');
        return OllamaAIProvider;

      case 'bedrock':
        const { BedrockAIProvider } = await import('./bedrock.js');
        return BedrockAIProvider;

      case 'azure':
        const { AzureProvider } = await import('./azure.js');
        return AzureProvider;

      case 'vertex':
      case 'google-vertex':
        const { VertexAIProvider } = await import('./google-vertex.js');
        return VertexAIProvider;

      default:
        throw new Error(`Unknown AI provider: ${providerName}`);
    }
  }

  /**
   * Check if a provider is loaded
   * @param {string} providerName - Name of the AI provider
   * @returns {boolean} True if provider is loaded
   */
  isLoaded(providerName) {
    return this.providers.has(providerName);
  }

  /**
   * Get list of loaded providers
   * @returns {string[]} Array of loaded provider names
   */
  getLoadedProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear all cached providers (useful for testing)
   */
  clearCache() {
    this.providers.clear();
    this.loadingPromises.clear();
  }
}

// Export singleton instance
export const aiProviderLoader = new AIProviderLazyLoader();

// Export the loader class for testing
export { AIProviderLazyLoader };