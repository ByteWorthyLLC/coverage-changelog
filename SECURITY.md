# Security

## Supported Versions

Until v1.0.0 is released, security fixes target the default branch only.

## Reporting a Vulnerability

Report vulnerabilities privately to:

```text
security@byteworthy.io
```

If that address is unavailable, open a GitHub security advisory on this repository.

## Privacy and Business Associate Status

Coverage Changelog is a static, build-time tool that consumes only the public CMS Coverage API and emits public artifacts. It does not receive, process, store, or transmit patient data, payer credentials, or private claims data.

ByteWorthy LLC is not a Business Associate for organizations that fork, deploy, host, or modify this software. If a deployment introduces patient data, payer integrations, or non-public sources, that organization owns its own HIPAA, state privacy, security, and Business Associate analysis.

## Security Boundaries

- No backend by default. All artifacts are static files emitted at build time.
- No accounts, authentication, telemetry, or analytics.
- No PHI, payer credentials, or paid API keys.
- The build script consumes only the documented public CMS Coverage API surfaces listed in `README.md`.
- HTML and RSS outputs are produced via `he`-based entity encoding to avoid injection from upstream data.
