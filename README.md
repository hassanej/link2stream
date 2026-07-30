# Link2Stream

Link2Stream is a modular media management platform.

## Repository Structure

    apps/
    ??? web/         Cloudflare Pages frontend
    ??? worker/      Cloudflare Worker backend
    ??? uploader/    VPS media processing pipeline (planned)

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

### apps/uploader

Planned VPS application responsible for:

- Downloading media
- Metadata extraction
- Renaming
- Encoding
- Preview streaming
- Uploading to R2

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
