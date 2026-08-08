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

**One click (macOS):** double-click `start.command` — it checks
Node/ffmpeg, installs dependencies on first run, creates `.env`,
starts the server, and opens http://127.0.0.1:3100 in your browser.
(If macOS blocks it: right-click > Open, or run `bash start.command`.)

**Terminal:**

    cd link2stream-local
    bash start.sh        # same launcher
    # or manually:
    cp .env.example .env   # set R2_* values
    npm install
    npm run dev            # http://127.0.0.1:3100

Requires ffmpeg with VideoToolbox (`ffmpeg -encoders | grep videotoolbox`).

Drop media files (.mkv .mp4 .m4v .mov .avi .webm) into `input/`,
select them in the UI, pick a profile, press Process.

Processing does NOT upload automatically: the job ends at "Ready",
where you can Open the result in your default player (e.g. IINA)
and only then press Upload. Jobs can be retried or deleted at any
time; running jobs cannot be deleted.

## Download just this folder

GitHub has no single-folder zip, but the whole repo is tiny
(code only), so a regular clone is fine:

    git clone --depth 1 https://github.com/hassanej/link2stream.git
    cd link2stream/link2stream-local

Or sparse-checkout only this folder:

    git clone --depth 1 --filter=blob:none --sparse \
        https://github.com/hassanej/link2stream.git
    cd link2stream
    git sparse-checkout set link2stream-local

## R2 / family-link integration

- R2 S3 client/config follows the project's shared conventions
  (app/shared/r2config.ts: R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
  R2_SECRET_ACCESS_KEY, `*.r2.cloudflarestorage.com`).
- Bucket is fixed: `family-share`.
- Credentials can be pasted in the UI (R2 settings card); they are
  saved to .env (chmod 600) server-side and never returned.
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
