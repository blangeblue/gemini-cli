# Using DeepSeek Models with Gemini CLI

This guide shows how to use DeepSeek AI models with Gemini CLI.

## Prerequisites

- Gemini CLI installed
- DeepSeek API account ([sign up here](https://platform.deepseek.com/))

## Setup

1. **Get your DeepSeek API key**

   Visit [DeepSeek Platform](https://platform.deepseek.com/) and create an API key.

2. **Configure environment variables**

   ```bash
   export DEEPSEEK_API_KEY="your-deepseek-api-key-here"
   export DEEPSEEK_BASE_URL="https://api.deepseek.com"
   ```

   To make these persistent, add them to your shell configuration file:

   ```bash
   # For bash users (~/.bashrc or ~/.bash_profile)
   echo 'export DEEPSEEK_API_KEY="your-deepseek-api-key-here"' >> ~/.bashrc
   echo 'export DEEPSEEK_BASE_URL="https://api.deepseek.com"' >> ~/.bashrc
   source ~/.bashrc

   # For zsh users (~/.zshrc)
   echo 'export DEEPSEEK_API_KEY="your-deepseek-api-key-here"' >> ~/.zshrc
   echo 'export DEEPSEEK_BASE_URL="https://api.deepseek.com"' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Launch Gemini CLI with a DeepSeek model**

   ```bash
   # Interactive mode
   gemini -m deepseek-chat

   # Non-interactive mode
   gemini -p "Explain quantum computing" -m deepseek-chat
   ```

## Available DeepSeek Models

DeepSeek provides several models:

- `deepseek-chat` - General purpose chat model
- `deepseek-coder` - Specialized for coding tasks
- `deepseek-reasoner` - Enhanced reasoning capabilities

Check the [DeepSeek documentation](https://platform.deepseek.com/docs) for the latest available models.

## Example Usage

### Interactive Chat

```bash
gemini -m deepseek-chat
```

Then interact normally:

```
> What is the fastest sorting algorithm?
> Write a Python implementation of quicksort
```

### Code Analysis

```bash
cd /path/to/your/project
gemini -m deepseek-coder
> Analyze this codebase and suggest improvements
```

### Non-Interactive Script

```bash
gemini -m deepseek-chat -p "Summarize the main features of Python 3.12" --output-format json
```

## Using Other OpenAI-Compatible APIs

You can also use any OpenAI-compatible API:

```bash
export GEMINI_API_KEY="your-api-key"
export GEMINI_API_BASE_URL="https://your-custom-api.com/v1"

gemini -m your-model-name
```

## Troubleshooting

### Authentication Error

If you see authentication errors:

1. Verify your API key is correct
2. Check that the API key is properly exported:
   ```bash
   echo $DEEPSEEK_API_KEY
   ```
3. Ensure there are no extra spaces in your environment variables

### Model Not Found

If the model is not found:

1. Check the model name matches exactly (case-sensitive)
2. Verify your DeepSeek account has access to the model
3. Check [DeepSeek's model list](https://platform.deepseek.com/docs)

### Connection Issues

If you experience connection issues:

1. Verify the base URL is correct: `https://api.deepseek.com`
2. Check your internet connection
3. Ensure you're not behind a firewall blocking the API

## Notes

- DeepSeek models have their own pricing and rate limits
- Some Gemini CLI features may behave differently with non-Gemini models
- Check DeepSeek's documentation for model-specific capabilities and limitations

## Additional Resources

- [DeepSeek Platform](https://platform.deepseek.com/)
- [DeepSeek API Documentation](https://platform.deepseek.com/docs)
- [Gemini CLI Authentication Guide](../get-started/authentication.md)
