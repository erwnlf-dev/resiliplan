-- Add openai_compatible provider type and base_url column for custom OpenAI-spec endpoints
-- (LiteLLM, Ollama, vLLM, OpenRouter, local llama.cpp, etc.)

-- Extend enum with new value
ALTER TYPE ai_provider_type ADD VALUE IF NOT EXISTS 'openai_compatible';

-- Add base_url column (nullable; required only for openai_compatible)
ALTER TABLE ai_providers ADD COLUMN IF NOT EXISTS base_url TEXT;
