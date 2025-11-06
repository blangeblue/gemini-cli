# Session History Tool (`save_session_history`)

This document describes the `save_session_history` tool for the Gemini CLI, which extends the long-term memory functionality beyond basic facts to include conversation session summaries.

## Description

Use `save_session_history` to save important conversation context and session summaries to long-term memory. This tool is designed to preserve valuable conversations, insights, or project context that should be remembered across different CLI sessions.

### Arguments

`save_session_history` takes the following arguments:

- `sessionSummary` (string, required): A concise summary of the important conversation or session context to save. Should capture key insights, decisions, or context that would be valuable in future sessions.
- `category` (string, optional): Category to organize the session history (e.g., "development", "configuration", "learning", "debugging"). Defaults to "general".
- `timestamp` (string, optional): Timestamp for the session. If not provided, current timestamp will be used.

## How to use `save_session_history` with the Gemini CLI

The tool saves session summaries to a special `session-history.md` file located in the user's home directory (`~/.gemini/session-history.md`). The entries are organized chronologically with the most recent entries first, and include category tags for better organization.

Usage:

```
save_session_history(sessionSummary="Your session summary here.", category="development")
```

### `save_session_history` examples

Save a development session summary:

```
save_session_history(sessionSummary="Implemented user authentication feature using JWT tokens. Key files modified: auth.js, user.model.js, routes/auth.js. Next steps: add password reset functionality.", category="development")
```

Save a debugging session summary:

```
save_session_history(sessionSummary="Fixed memory leak in data processing pipeline. Issue was caused by unclosed database connections in batch processor. Applied connection pooling and proper cleanup.", category="debugging")
```

Save a learning session summary:

```
save_session_history(sessionSummary="Learned about React useCallback hook optimization. Key insight: useCallback prevents unnecessary re-renders when passing callbacks to child components. Use with dependency array.", category="learning")
```

## Memory Commands Integration

The enhanced `/memory` command now includes session history management:

### `/memory session save <summary>`

Saves a session summary to long-term memory.

### `/memory session list [limit]`

Lists recent session history entries (default: 10 entries).

### `/memory session categories`

Shows all available session history categories.

### `/memory session search <category>`

Searches session history by category.

## File Format

Session history is stored in Markdown format with the following structure:

```markdown
# Session History

This file contains summaries of important conversations and session context for long-term memory.

## 2025-01-16T10:30:00.000Z [development]

Implemented user authentication feature using JWT tokens. Key files modified: auth.js, user.model.js, routes/auth.js. Next steps: add password reset functionality.

## 2025-01-16T09:15:00.000Z [debugging]

Fixed memory leak in data processing pipeline. Issue was caused by unclosed database connections in batch processor. Applied connection pooling and proper cleanup.
```

## Important notes

- **Best practices:** Use this tool for session summaries, project insights, and important context that should persist across sessions. Don't use it for detailed conversation transcripts.
- **Organization:** Use meaningful categories to organize your session history for easy retrieval.
- **File location:** The session history file is stored separately from the main memory file to keep different types of information organized.
- **Manual editing:** The session history file is a plain text Markdown file, so you can view and edit it manually if needed.

## Relationship to Memory Tool

The `save_session_history` tool complements the existing `save_memory` tool:

- **`save_memory`**: For specific facts, preferences, and discrete pieces of information
- **`save_session_history`**: For conversation summaries, session context, and project insights

Both tools contribute to the long-term memory system and help provide context in future sessions.
