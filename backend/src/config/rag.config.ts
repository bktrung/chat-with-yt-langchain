export const RAG_CONFIG = {
  // Dynamic retrieval based on similarity threshold
  minChunks: 5,
  maxChunks: 20,
  similarityThreshold: 0.4, // Only retrieve chunks above this score

  // Message history
  maxMessages: 50, // Gemini Flash has 1M token context window

  // Chunking strategy
  chunkSize: 1000,
  chunkOverlap: 200,

  // LLM configuration
  temperature: 0.7,
  model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash-exp',
} as const;

export type RagConfig = typeof RAG_CONFIG;

