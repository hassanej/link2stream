# Link2Stream Local

Local macOS (Apple Silicon) utility: compress downloaded media into
family-streaming sizes and upload directly to Cloudflare R2.

Workflow:

    manual download (Real-Debrid etc.)
        -> input/
        -> this app (choose profile per selection)
        -> output/   (generated encoding)
        -> upload Mac -> R2 (no VPS involved)
        -> existing Link2Stream family link

## Output profiles (exactly two)

| Profile | Resolution rule | Video target |
|---|---|---|
| Smaller 1080p | cap at 1080p, never upscale | ~3 Mbps h264 (VideoToolbox) |
| 720p | cap at 720p, never upscale | ~2 Mbps h264 (VideoToolbox) |

## Run

    cd apps/local
    cp .env.example .env   # set R2_* values
    npm install
    npm run dev            # http://127.0.0.1:3100

Requires ffmpeg with VideoToolbox (`ffmpeg -encoders | grep videotoolbox`).

Drop media files (.mkv .mp4 .m4v .mov .avi .webm) into `input/`,
select them in the UI, pick a profile, Process + Upload.

## R2 / family-link integration

- R2 S3 client/config follows the project's shared conventions
  (app/shared/r2config.ts: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
  R2_SECRET_ACCESS_KEY / R2_BUCKET, `*.r2.cloudflarestorage.com`).
- Object keys follow apps/worker's upload convention
  (`<epochMs>-<uuid>.mp4` + originalName/uploadedBy metadata).
- Family links follow apps/worker's public streaming convention:
  `<worker-origin>/public/files/<key>` — no new link system.

## Safety rules (enforced in code)

1. input/ files are never deleted, moved, renamed or overwritten.
2. A generated output/ file is deleted only after the R2 upload is
   confirmed (HeadObject).
3. Failed encodes/uploads retain all files; failed jobs can be
   retried (a completed encode is reused; partial encodes are not).
4. Jobs interrupted by an app stop are marked Failed (interrupted)
   on next start.
5. R2 secrets stay server-side. Media never leaves the Mac except
   to R2.
