# Contributing

Thanks for helping improve Notability Access.

## Development setup

1. Install Node.js 18 or later.
2. Fork and clone the repository.
3. Create a focused branch.
4. Run `npm test` before opening a pull request.

The project has no runtime npm dependencies. The MCP server uses Node.js built-in modules only.

## Design constraints

- Keep note access read-only unless a proposal clearly documents user consent, recovery, and safety behavior.
- Confine filesystem operations to the configured backup folder.
- Never request or store Notability passwords, cookies, or cloud tokens.
- Avoid logging note contents or absolute local paths unnecessarily.
- Preserve cross-platform behavior on Windows, macOS, and Linux.
- Add tests for new tools, formats, and security boundaries.

## Pull requests

Keep changes small and explain the privacy impact. Do not submit real notes, recordings, credentials, account identifiers, or screenshots containing personal data.

By contributing, you agree that your contributions are licensed under the MIT License.
