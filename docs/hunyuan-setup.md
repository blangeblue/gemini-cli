# Hunyuan Model Support

Gemini CLI now supports Tencent's Hunyuan (混元) AI models in addition to Google's Gemini models.

## Available Hunyuan Models

- `hunyuan-pro`: High-performance model for complex tasks
- `hunyuan-standard`: Balanced model for general use
- `hunyuan-lite`: Fast, efficient model for simple tasks

## Configuration

### Environment Variables

Set the Hunyuan API key:

```bash
export HUNYUAN_API_KEY=your_hunyuan_api_key_here
```

### Model Selection

Configure the model in your settings or via command line:

```bash
# Use specific Hunyuan model
gemini --model hunyuan-pro "Your question here"

# Use Hunyuan lite for simple tasks
gemini --model hunyuan-lite "List files in current directory"
```

### Settings Configuration

Update your `~/.gemini/settings.json`:

```json
{
  "model": {
    "name": "hunyuan-pro"
  }
}
```

## Model Router Support

When using the experimental model router (`useModelRouter: true`), the classifier will intelligently route requests within the same model family:

- **Hunyuan family**: Simple tasks → `hunyuan-lite`, Complex tasks → `hunyuan-pro`
- **Gemini family**: Simple tasks → `gemini-2.5-flash`, Complex tasks → `gemini-2.5-pro`

## Fallback Behavior

In fallback mode:

- `hunyuan-pro` → `hunyuan-standard`
- `hunyuan-lite` → remains `hunyuan-lite` (honored for cost efficiency)
- `hunyuan-standard` → remains `hunyuan-standard`

## Features

- ✅ Full thinking mode support
- ✅ Model routing and classification
- ✅ Fallback mode support
- ✅ Telemetry and metrics
- ✅ All existing CLI features work seamlessly

## Authentication

Hunyuan models use the `USE_HUNYUAN` authentication type. Ensure your API key is properly configured and has access to the requested models.
