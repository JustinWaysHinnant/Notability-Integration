# Notability Access for Codex

[![CI](https://github.com/JustinWaysHinnant/Notability-Integration/actions/workflows/ci.yml/badge.svg)](https://github.com/JustinWaysHinnant/Notability-Integration/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Notability Access is a local, read-only bridge between Codex and a folder of Notability exports. It lets Codex list, search, and read notes without requesting or storing your Notability credentials.

## Features

- Restricts access to one explicitly configured backup folder.
- Lists exported notes by title, format, size, and modification time.
- Searches filenames and text extracted from TXT, Markdown, RTF, and HTML exports.
- Returns local links for PDF, Note, ZIP, image, and audio exports.
- Rejects absolute paths and path traversal outside the configured folder.
- Stores only the configured folder path on the local computer.

The integration does not modify the original Notability library. Editing a backup file does not sync changes back to Notability.

## Requirements

- Codex desktop or CLI with plugin support.
- Node.js 18 or later available as `node`.
- A locally synced folder containing Notability exports.

## Install

Add this repository as a Codex marketplace and install the plugin:

```powershell
codex plugin marketplace add JustinWaysHinnant/Notability-Integration
codex plugin add notability-access@notability-integration
```

Restart Codex or start a new task after installation.

## Populate the integration folder

Notability currently limits third-party Auto-Backup to **iOS**. The Windows and newer Mac desktop apps do not show that setting.

### Windows, desktop Mac, and web

Export notes manually as PDFs and save them in a folder that syncs to this computer. The Windows and Mac desktop apps support PDF export, including handwriting, typed notes, images, and math.

For a typical OneDrive installation, use:

```text
%USERPROFILE%\OneDrive\Notability
```

In a note, open its options menu, select **Export as PDF**, and choose that folder. See Notability's [desktop documentation](https://support.gingerlabs.com/en-us/articles/16634098-notability-for-windows-and-mac) and [PDF export announcement](https://blog.notability.com/post/one-notebook-for-every-meeting-on-your-calendar).

### iPhone or iPad

You can enable **Settings → Connected Services → Auto-Backup/Third-Party Backup**, select OneDrive, and use the `Notability` destination. Choose PDF for visual fidelity, RTF for searchable typed text, or PDF + Recording when audio matters. See [Notability's Auto-Backup guide](https://support.gingerlabs.com/hc/en-us/articles/206061467-Auto-Backup-Third-Party-Backup-Guide).

Notability's [plan comparison](https://notability.com/pricing/compare) identifies third-party backup as an iOS-only feature.

## Connect the backup folder

Start a new Codex task and say:

> Configure Notability Access to use `C:\path\to\your\synced\Notability`.

Codex asks for approval before storing the folder path. The setting is saved locally at:

```text
%LOCALAPPDATA%\Codex\notability-access\config.json
```

You can alternatively define `NOTABILITY_BACKUP_DIR` in the Codex environment. The folder may contain manual exports or files synced from iOS Auto-Backup.

## Example prompts

- “Show my ten most recently changed Notability notes.”
- “Search my Notability notes for project kickoff.”
- “Summarize `Meetings\Weekly review.rtf`.”
- “List all exported recordings modified this week.”

## Available tools

| Tool | Purpose |
| --- | --- |
| `configure_backup` | Validate and store the selected backup directory. |
| `status` | Report configuration status and indexed file counts. |
| `list_notes` | Browse exports with optional filename and format filters. |
| `search_notes` | Search filenames and supported text exports. |
| `read_note` | Extract supported text or return a local file link. |

## Supported formats

| Format | Filename search | Text extraction | Local file link |
| --- | ---: | ---: | ---: |
| TXT, Markdown, RTF, HTML | Yes | Yes | Yes |
| PDF, Note, ZIP | Yes | No | Yes |
| M4A, MP3, WAV | Yes | No | Yes |
| PNG, JPG, JPEG | Yes | No | Yes |

## Development

```powershell
npm test
```

The test suite validates the marketplace and plugin manifests, checks JavaScript syntax, starts the MCP server, exercises its tools, and verifies path confinement.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [SUPPORT.md](SUPPORT.md) before opening an issue or pull request.

## License

[MIT](LICENSE)
