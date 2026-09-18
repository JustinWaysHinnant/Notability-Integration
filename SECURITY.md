# Security Policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/JustinWaysHinnant/Notability-Integration/security/advisories/new). Do not open a public issue for a vulnerability that may expose local files, note contents, or credentials.

Include a minimal reproduction using synthetic note data. Avoid attaching real Notability exports.

## Security model

- The server is local and does not send note contents over the network.
- The user selects one backup directory.
- Note paths are resolved and checked against the real configured root.
- Reading uses a size limit for extracted text.
- Configuration stores only the selected directory path.
- The integration never asks for a Notability password or session token.

Notability exports remain subject to the permissions and security of the chosen local sync provider and filesystem.
