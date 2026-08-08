# Link2Stream Uploader

The Link2Stream Uploader is a standalone application responsible for downloading, processing, reviewing, and uploading media to Cloudflare R2.

This application is designed to run on a temporary VPS. The VPS is considered disposable; all persistent data belongs in Cloudflare R2 or the Link2Stream backend.

---

# Objectives

- Download media from multiple sources.
- Extract metadata before downloading when possible.
- Organize and rename media consistently.
- Encode media for storage efficiency.
- Allow preview before upload.
- Upload approved media to Cloudflare R2.
- Track local storage usage.
- Track remote R2 storage usage.
- Provide complete visibility into every operation.

---

# Core Principles

- Modular architecture.
- Small, focused files.
- One responsibility per module.
- Easy debugging.
- Easy logging.
- Easy AI-assisted development.
- Minimal hidden behavior.
- Configuration over hardcoding.

---

# Project Structure

```text
backend/
    api/
    config/
    downloads/
    encoding/
    inventory/
    jobs/
    limits/
    logging/
    metadata/
    naming/
    preview/
    queue/
    scheduler/
    storage/
    uploads/
    utils/

frontend/
    components/
    hooks/
    pages/
    services/
    styles/
    types/

shared/
    constants/
    types/
    utils/

scripts/
```

---

# Backend Responsibilities

- Download manager
- Encoding manager
- Queue manager
- Metadata extraction
- Naming engine
- Preview generation
- Upload manager
- Storage manager
- Scheduler
- Logging
- REST API

---

# Frontend Responsibilities

- Dashboard
- Queue monitor
- Download manager
- Encoding monitor
- Preview player
- Upload manager
- Storage overview
- Settings
- System logs

---

# Workflow

Download → Rename (series) → Select Original / Downsized 1080p / Downsized 720p → Encode → Preview (VLC/IINA) → Choose version → R2 storage check → Upload → VPS cleanup.

## Running

    cp .env.example .env   # fill in R2_* to enable uploads
    npm install
    npm run dev            # http://localhost:3000 (UI + API)

Requires `aria2c` and `ffmpeg` on the host.

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/media/download` | `{url, kind: movie\|series}` — aria2c download job |
| `POST /api/media/rename` / `POST /api/media/rename-batch` | Rename one / many items (series) |
| `POST /api/media/:id/encode` | `{target: 1080p\|720p}` — downsize via FFmpeg (never upscales, keeps aspect ratio) |
| `GET /media/:id/stream?version=original\|1080p\|720p` | Range-capable stream; open in VLC/IINA |
| `POST /api/media/:id/choose` | `{version: original\|1080p\|720p}` — only the chosen version uploads |
| `GET /api/r2/usage` | R2 used / remaining / 10 GiB budget + file list |
| `POST /api/r2/precheck` | Which selected items fit the remaining budget |
| `POST /api/media/upload` | `{mediaIds}` — uploads chosen versions, confirms via HEAD |
| `DELETE /api/r2/files/:key` | Delete a single R2 object |
| `POST /api/media/:id/cleanup` | `{keep: boolean}` — post-upload VPS keep/delete (guarded) |
| `DELETE /api/media/:id/local` | Manual VPS file deletion (blocked when chosen-but-not-uploaded) |
| `GET /jobs`, `GET /jobs/:id`, `GET /queue` | Job / queue monitoring |

## Guarantees

- A VPS file is never deleted until its R2 upload is confirmed (`HeadObject` after `PutObject`).
- Encoded outputs never exceed the source resolution and preserve aspect ratio.
- Media registry is persisted to `storage/metadata/media.json` and reloaded on boot.

---

# Development Rules

1. Keep files small.
2. Prefer composition over large classes.
3. Avoid circular dependencies.
4. Every module should be independently testable.
5. Every long-running operation reports progress.
6. Every important action is logged.
7. Secrets must never be committed.
8. Configuration belongs in environment variables.
9. GitHub is the source of truth.
10. This application is intended for administrators only.