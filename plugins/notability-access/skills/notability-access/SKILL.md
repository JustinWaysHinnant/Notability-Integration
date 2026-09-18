---
name: notability-access
description: Search, read, summarize, and organize content from a configured Notability Auto-Backup or export folder. Use when the user asks about their Notability notes or asks to connect a Notability backup folder.
---

# Notability Access

Use the `notability_access` MCP tools for the user's exported Notability library.

## First-time setup

1. Ask for the local path of the folder synced from Notability Auto-Backup.
2. Call `configure_backup` with that absolute folder path. The tool validates that the folder exists and stores only the path.
3. Call `status` to verify the connection.

Do not ask for a Notability password, session cookie, or cloud token.

## Reading notes

- Use `list_notes` to browse titles, paths, formats, sizes, and modification times.
- Use `search_notes` for filename and extracted-text search. PDF, Note, audio, and image files are searchable by filename only.
- Use `read_note` for a specific relative path. Text, Markdown, HTML, and RTF exports return extracted text. Other formats return a local file link for the appropriate document, PDF, image, or audio workflow.
- Treat the configured backup as read-only. Never imply that editing an exported file changes the original Notability note.

## Live Notability editing

When the user explicitly wants to change the live Notability library, use Notability Web in a user-authenticated browser tab if browser control is available. Have the user sign in themselves. Confirm the exact note before destructive actions such as deleting or replacing content.

## Export guidance

Recommend PDF for visual fidelity, RTF for editable typed text, or PDF + Recording when audio matters. Explain that Auto-Backup is one-way and may retain exported copies after notes are deleted in Notability.
