# Using Alternative Model Providers

Gemini CLI supports using alternative AI model providers that offer OpenAI-compatible APIs. This guide shows how to configure popular alternative providers like Qwen and DeepSeek.

## Overview

By configuring a custom API base URL and providing the appropriate API key, you can use Gemini CLI with models from various providers. This feature leverages the fact that many AI providers now offer OpenAI-compatible APIs.

## Qwen (Alibaba Cloud)

Qwen models from Alibaba Cloud are powerful language models with strong performance in Chinese and English.

### Configuration

Add the following to your `~/.gemini/settings.json`:

```json
{
  "model": {
    "name": "qwen-max",
    "apiBaseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  }
}
```

### Available Models

- **`qwen-max`** - Most capable model with best performance
- **`qwen-plus`** - Balanced performance and speed
- **`qwen-turbo`** - Fast and efficient for most tasks

### Getting Your API Key

1. Sign up at [DashScope](https://dashscope.aliyuncs.com/)
2. Navigate to API Keys section
3. Create a new API key
4. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your-qwen-api-key"
   ```

### Example Usage

```bash
# Set your API key
export GEMINI_API_KEY="sk-xxxxxxxxxxxxx"

# Start Gemini CLI
gemini

# The CLI will now use Qwen models
> Explain quantum computing in simple terms
```

## DeepSeek

DeepSeek provides powerful models optimized for coding and reasoning tasks.

### Configuration

Add the following to your `~/.gemini/settings.json`:

```json
{
  "model": {
    "name": "deepseek-chat",
    "apiBaseUrl": "https://api.deepseek.com/v1"
  }
}
```

For coding tasks, you can use the specialized coder model:

```json
{
  "model": {
    "name": "deepseek-coder",
    "apiBaseUrl": "https://api.deepseek.com/v1"
  }
}
```

### Available Models

- **`deepseek-chat`** - General purpose conversational model
- **`deepseek-coder`** - Specialized for coding and technical tasks

### Getting Your API Key

1. Sign up at [DeepSeek Platform](https://platform.deepseek.com/)
2. Navigate to API Keys
3. Create a new API key
4. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your-deepseek-api-key"
   ```

### Example Usage

```bash
# Set your API key
export GEMINI_API_KEY="sk-xxxxxxxxxxxxx"

# Start Gemini CLI
gemini

# The CLI will now use DeepSeek models
> Write a Python function to sort a list using quicksort
```

## Project-Specific Configuration

You can also configure alternative models on a per-project basis by creating a `.gemini/settings.json` file in your project root:

```json
{
  "model": {
    "name": "qwen-max",
    "apiBaseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  }
}
```

When you run `gemini` from within that project directory, it will automatically use the configured model.

## Switching Between Providers

You can easily switch between different providers by:

1. **Using different settings files**: User-level (`~/.gemini/settings.json`) vs. project-level (`.gemini/settings.json`)
2. **Using the `-m` flag**: Override the model at runtime
   ```bash
   gemini -m gemini-2.5-pro  # Use Gemini
   ```
3. **Commenting out settings**: Temporarily disable custom configuration

## Limitations and Notes

- **API Compatibility**: While these providers offer OpenAI-compatible APIs, not all features may work identically to Gemini models
- **Function Calling**: Tool use and function calling support varies by provider
- **Rate Limits**: Check your provider's rate limits and quotas
- **Error Handling**: Some error messages may differ from those of Gemini models
- **Features**: Advanced features like grounding with Google Search may not be available with alternative providers

## Troubleshooting

### Authentication Errors

If you see authentication errors:

- Verify your API key is correct
- Check that the API key is properly set in the environment variable
- Ensure you have sufficient quota with the provider

### Connection Errors

If you see connection errors:

- Verify the `apiBaseUrl` is correct for your provider
- Check your internet connection
- Some providers may require VPN access depending on your location

### Model Not Found

If you see "model not found" errors:

- Verify the model name is correct for your provider
- Check the provider's documentation for available models
- Ensure your API key has access to the requested model

## Additional Resources

- [Qwen Documentation](https://help.aliyun.com/zh/dashscope/)
- [DeepSeek Documentation](https://platform.deepseek.com/docs)
- [Gemini CLI Configuration Guide](../get-started/configuration.md)
