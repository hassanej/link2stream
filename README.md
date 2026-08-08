# Link2Stream

Link2Stream is a modular media management platform.

## Repository Structure

apps/
|-- web/         Cloudflare Pages frontend
`-- worker/      Cloudflare Worker backend

link2stream-local/  Local Mac encode + R2 upload utility (standalone)

packages/        Shared libraries (future)
docs/            Documentation
scripts/         Utility scripts

## Applications

### apps/web

Frontend for:

- Login
- User management
- File browser
- Upload
- Download
- Public links

### apps/worker

Cloudflare Worker API providing:

- Authentication
- User management
- R2 file operations
- Upload handling
- Public links

### link2stream-local

Standalone local macOS (Apple Silicon) utility (repo-root folder,
no dependency on other apps):

- Scans a local input/ folder for downloaded media
- Compresses to two profiles (Smaller 1080p, 720p) with
  VideoToolbox hardware encoding
- Uploads results directly to R2
- Produces family links via the existing worker public
  streaming route

## Development

Each application is self-contained and has its own dependencies.

Install dependencies inside the application you are working on.

Example:

    cd apps/web
    npm install

    cd ../worker
    npm install

Do not commit:

- node_modules
- build artifacts
- caches
- secrets
