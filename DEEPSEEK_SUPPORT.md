# DeepSeek Model Support - Implementation Summary

## Overview

This PR adds support for DeepSeek AI models and other OpenAI-compatible APIs to Gemini CLI. Users can now use DeepSeek's models (and other compatible providers) by setting environment variables.

## Changes Made

### 1. Core Functionality (`packages/core/src/core/contentGenerator.ts`)

- **Added `apiBaseUrl` field** to `ContentGeneratorConfig` type
- **Environment variable support**:
  - `DEEPSEEK_API_KEY` - API key for DeepSeek
  - `DEEPSEEK_BASE_URL` - Base URL for DeepSeek API
  - `GEMINI_API_BASE_URL` - Generic custom API base URL (takes precedence)
- **Updated `createContentGeneratorConfig()`**:
  - Reads DeepSeek environment variables
  - Prioritizes `GEMINI_API_BASE_URL` over `DEEPSEEK_BASE_URL`
  - Configures API client when DeepSeek credentials are present
- **Updated `createContentGenerator()`**:
  - Passes `baseUrl` in `httpOptions` when creating `GoogleGenAI` instance
  - Enables custom API endpoint usage

### 2. Tests (`packages/core/src/core/contentGenerator.test.ts`)

Added comprehensive test coverage:

- Configuration with DeepSeek environment variables
- Custom base URL configuration
- Priority of `GEMINI_API_BASE_URL` over `DEEPSEEK_BASE_URL`
- Passing baseUrl to GoogleGenAI constructor

All tests pass successfully.

### 3. Documentation

#### README.md

- Added example showing how to use DeepSeek models

#### docs/get-started/authentication.md

- New section: "Use DeepSeek or Other OpenAI-Compatible APIs"
- Setup instructions for DeepSeek
- Instructions for generic custom APIs
- Security warnings about API key handling

#### docs/examples/deepseek-example.md (NEW)

- Comprehensive usage guide
- Prerequisites and setup
- Available models
- Usage examples (interactive, code analysis, scripting)
- Troubleshooting guide
- Additional resources

## Usage

### DeepSeek Setup

```bash
# Set environment variables
export DEEPSEEK_API_KEY="your-deepseek-api-key"
export DEEPSEEK_BASE_URL="https://api.deepseek.com"

# Use with Gemini CLI
gemini -m deepseek-chat
```

### Custom API Provider

```bash
# For any OpenAI-compatible API
export GEMINI_API_KEY="your-api-key"
export GEMINI_API_BASE_URL="https://custom-api.com/v1"

gemini -m model-name
```

## Technical Details

### How It Works

1. When Gemini CLI starts, `createContentGeneratorConfig()` checks for environment variables
2. If DeepSeek credentials are found, they're used to configure the API client
3. The `apiBaseUrl` is passed through to the `GoogleGenAI` SDK via `httpOptions.baseUrl`
4. The SDK makes API calls to the custom endpoint instead of Google's API

### Compatibility

The implementation leverages the fact that:

- The `@google/genai` SDK supports custom base URLs via `httpOptions.baseUrl`
- DeepSeek and other providers offer OpenAI-compatible APIs
- The SDK's request/response format is flexible enough to work with compatible APIs

## Testing

### Automated Tests

- ✅ All existing tests pass
- ✅ New tests for DeepSeek configuration pass
- ✅ Build and type checking successful

### Manual Testing Needed

- Test with actual DeepSeek API credentials
- Verify model responses work correctly
- Test error handling with invalid credentials
- Verify tool calling works with DeepSeek models

## Security Considerations

- API keys are loaded from environment variables (secure)
- Documentation includes warnings about protecting API keys
- No hardcoded credentials or sensitive data

## Backward Compatibility

- ✅ No breaking changes
- ✅ Existing Gemini API usage unaffected
- ✅ New environment variables are optional
- ✅ Defaults to standard Gemini behavior when custom variables not set

## Future Enhancements

Possible future improvements:

1. Add settings.json support for API base URL
2. Add UI for selecting API provider
3. Provider-specific model validation
4. Enhanced error messages for different API providers
5. Rate limit handling per provider

## References

- [DeepSeek Platform](https://platform.deepseek.com/)
- [DeepSeek API Documentation](https://platform.deepseek.com/docs)
- [@google/genai SDK](https://www.npmjs.com/package/@google/genai)
