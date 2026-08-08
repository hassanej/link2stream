/**
 * Development helper: register an existing file from
 * storage/downloads as a media item without downloading.
 * Usage: npx tsx scripts/seed-media.ts "<absolute file path>" [movie|series] [url]
 */
import { mediaService } from "../backend/inventory/index.js";

const [filePath, kindArg, urlArg] = process.argv.slice(2);

if (!filePath) {
    console.error(
        'Usage: npx tsx scripts/seed-media.ts "<file path>" [movie|series] [url]'
    );
    process.exit(1);
}

const kind = kindArg === "series" ? "series" : "movie";

const item = await mediaService.registerDownloaded({
    kind,
    sourceUrl: urlArg ?? "manual://seed",
    filePath
});

console.log(`Registered ${item.id} -> ${item.fileName}`);
