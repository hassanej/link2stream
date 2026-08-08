# Link2Stream

Link2Stream is a private family media platform.

## Current architecture

    manual media download (e.g. Real-Debrid)
        -> link2stream-local (Mac): compress + upload
        -> Cloudflare R2 bucket (family-share)
        -> apps/worker API (auth, files, public streaming links)
        -> apps/web (Cloudflare Pages): family watches/downloads

The VPS pipeline (apps/uploader) has been removed; all processing
happens locally on Apple Silicon via link2stream-local.

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
- User management (admin)
- File browser (list, download, delete, copy public link)
- Storage usage overview

Note: uploads happen via link2stream-local or the worker API
directly; the web UI has no upload form today.

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
