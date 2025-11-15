# Hunyuan Model Support

Gemini CLI now supports Tencent's Hunyuan models through an OpenAI-compatible API integration. This allows you to use Hunyuan's powerful language models with the same familiar Gemini CLI interface.

## Overview

Tencent Hunyuan (腾讯混元) is a series of large language models that offer:

- Ultra-long context windows up to 256K tokens
- Fast inference speeds
- Multimodal capabilities (text and vision)
- OpenAI-compatible API for easy integration

## Setup

### Prerequisites

1. A Tencent Cloud account with access to Hunyuan API
2. An API key from the [Tencent Cloud Console](https://console.cloud.tencent.com/)

### Configuration

Configure Hunyuan by setting environment variables:

```bash
# Required: Your Hunyuan API key
export HUNYUAN_API_KEY="your-api-key-here"

# Optional: Custom API endpoint (defaults to official Tencent endpoint)
export HUNYUAN_BASE_URL="https://api.hunyuan.cloud.tencent.com/v1"
```

You can also add these to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) for persistent configuration.

### Using .env file

Create a `.env` file in your project directory:

```env
HUNYUAN_API_KEY=your-api-key-here
HUNYUAN_BASE_URL=https://api.hunyuan.cloud.tencent.com/v1
```

## Available Models

Gemini CLI supports the following Hunyuan models:

### Hunyuan Turbo (`hunyuan-turbos-latest`)

- **Best for:** Complex tasks requiring deep reasoning
- **Context window:** 256K tokens
- **Speed:** Fast inference with high quality

### Hunyuan Lite (`hunyuan-lite`)

- **Best for:** Simple tasks that need quick responses
- **Context window:** 256K tokens
- **Speed:** Ultra-fast inference optimized for simple queries

### Hunyuan Vision (`hunyuan-vision`)

- **Best for:** Image understanding and multimodal tasks
- **Context window:** 256K tokens
- **Features:** Supports both text and image inputs

## Usage

### Using the Model Dialog

1. Launch Gemini CLI
2. Press `/` to open the command menu
3. Type `model` and select the model command
4. Choose from the available Hunyuan models:
   - Hunyuan Turbo
   - Hunyuan Lite

### Using Command-Line Flags

Specify the model directly when launching Gemini CLI:

```bash
# Use Hunyuan Turbo
gemini --model hunyuan-turbos-latest

# Use Hunyuan Lite
gemini --model hunyuan-lite

# Use Hunyuan Vision
gemini --model hunyuan-vision
```

### In Non-Interactive Mode

```bash
# Single query with Hunyuan
gemini --model hunyuan-turbos-latest "Explain quantum computing"

# Process files with Hunyuan
gemini --model hunyuan-lite --file input.txt "Summarize this document"
```

## Features and Limitations

### Supported Features

- ✅ Text generation and chat
- ✅ Streaming responses
- ✅ Long context windows (256K tokens)
- ✅ Temperature and top-p parameters
- ✅ Max output tokens configuration

### Current Limitations

- ❌ Embedding generation (not supported by Hunyuan API)
- ❌ Function calling (to be implemented)
- ❌ Tool use integration (to be implemented)
- ⚠️ Token counting is approximate (Hunyuan doesn't provide a direct token counting API)

## Troubleshooting

### API Key Issues

If you get authentication errors:

```bash
# Check if your API key is set
echo $HUNYUAN_API_KEY

# Verify it's not empty
[ -z "$HUNYUAN_API_KEY" ] && echo "API key not set" || echo "API key is set"
```

### Connection Issues

If you can't connect to the API:

1. Check your internet connection
2. Verify the base URL is correct
3. Ensure your API key has the necessary permissions in Tencent Cloud Console
4. Check if there are any firewall or proxy restrictions

### Rate Limiting

Hunyuan API has rate limits. If you encounter rate limit errors:

- Wait a few seconds before retrying
- Consider upgrading your Tencent Cloud plan for higher limits
- Use exponential backoff for retries

## Examples

### Basic Chat

```bash
# Start an interactive session with Hunyuan Turbo
gemini --model hunyuan-turbos-latest

# Then chat normally
> What are the key features of Hunyuan models?
```

### Code Generation

```bash
gemini --model hunyuan-turbos-latest "Write a Python function to calculate Fibonacci numbers"
```

### Document Analysis

```bash
gemini --model hunyuan-lite --file document.pdf "Extract key points from this document"
```

## Performance Tips

1. **Choose the right model:**
   - Use Hunyuan Lite for simple, quick tasks
   - Use Hunyuan Turbo for complex reasoning
   - Use Hunyuan Vision for multimodal tasks

2. **Optimize context:**
   - Hunyuan supports 256K tokens, but shorter contexts are faster
   - Use summarization for very long documents

3. **Adjust parameters:**
   - Lower temperature (0.3-0.5) for factual responses
   - Higher temperature (0.7-0.9) for creative tasks

## Getting Help

- [Tencent Cloud Documentation](https://cloud.tencent.com/document/product/1729)
- [Hunyuan API Reference](https://cloud.tencent.com/document/product/1729/111007)
- [Gemini CLI Issues](https://github.com/google-gemini/gemini-cli/issues)

## Related Documentation

- [Configuration](../get-started/configuration.md)
- [Model Selection](../cli/models.md)
- [Environment Variables](../get-started/environment-variables.md)
