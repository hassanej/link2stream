"use strict";

const state = {
  media: [],
  jobs: [],
  r2: null, // { usedBytes, limitBytes, remainingBytes, files }
  selected: new Set(),
  precheck: null,
};

const $ = (sel) => document.querySelector(sel);

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "?";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(1)} ${units[exp]}`;
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.error?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

async function plainGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/* ---------------- Download ---------------- */

async function startDownload() {
  const url = $("#download-url").value.trim();
  const kind = $("#download-kind").value;

  if (!url) {
    $("#download-status").textContent = "Enter a URL first.";
    return;
  }

  $("#download-status").textContent = "Queued download...";

  try {
    await api("/media/download", {
      method: "POST",
      body: JSON.stringify({ url, kind }),
    });

    $("#download-url").value = "";
    $("#download-status").textContent = "Download queued.";
    refreshMedia();
  } catch (error) {
    $("#download-status").textContent = error.message;
  }
}

/* ---------------- Media library ---------------- */

async function refreshMedia() {
  // Don't clobber inputs while the user is editing a rename.
  const active = document.activeElement;
  if (active && $("#media-list").contains(active)) return;

  try {
    const data = await api("/media");
    state.media = data.items || [];
    renderMedia();
  } catch (error) {
    $("#media-list").innerHTML = `<p class="muted">${error.message}</p>`;
  }
}

function versionName(version) {
  return {
    original: "Original / Full 1080p",
    "1080p": "Downsized 1080p",
    "720p": "Downsized 720p",
  }[version] || version;
}

function renderMedia() {
  const container = $("#media-list");

  if (state.media.length === 0) {
    container.innerHTML = '<p class="muted">No media yet.</p>';
    return;
  }

  container.innerHTML = "";

  for (const item of state.media) {
    const div = document.createElement("div");
    div.className = "media-item";

    const versions = item.versions || {};
    const encodedKeys = Object.keys(versions).filter((v) => v !== "original");

    const previewLines = Object.entries(versions)
      .map(([version, info]) => {
        const isSelected =
          item.chosen === version
            ? ' <span class="badge">chosen</span>'
            : "";
        return `<div class="version-line">
          <label><input type="radio" name="choose-${item.id}" value="${version}"
            data-media="${item.id}" ${item.chosen === version ? "checked" : ""}/>
            ${versionName(version)} (${formatBytes(info.sizeBytes)})</label>${isSelected}
          <button class="small secondary copy-link" data-url="${info.previewUrl}">Copy preview link</button>
        </div>`;
      })
      .join("");

    const encodeButtons = ["1080p", "720p"]
      .filter((target) => !encodedKeys.includes(target))
      .map(
        (target) =>
          `<button class="small secondary encode-btn" data-media="${item.id}" data-target="${target}">Encode ${target}</button>`
      )
      .join(" ");

    const canRename = item.kind === "series";

    div.innerHTML = `
      <div class="row">
        <input type="checkbox" class="select-media" data-media="${item.id}"
          ${state.selected.has(item.id) ? "checked" : ""} ${item.chosen ? "" : "disabled"}
          title="Select for upload (choose a version first)" />
        ${
          canRename
            ? `<input class="rename-input" data-media="${item.id}" value="${escapeAttr(
                stripExt(item.fileName)
              )}" />`
            : `<span class="title">${escapeHtml(item.fileName)}</span>`
        }
        <span class="badge">${item.kind}</span>
        <span class="badge">${item.status}</span>
        ${item.uploadedAt ? '<span class="badge">uploaded</span>' : ""}
      </div>
      <div class="row">${encodeButtons}</div>
      ${previewLines}
      <div class="row">
        ${
          item.uploadedAt
            ? `<button class="small cleanup-keep" data-media="${item.id}">Keep VPS copy</button>
               <button class="small danger cleanup-delete" data-media="${item.id}">Delete VPS copy</button>`
            : `<button class="small danger delete-local" data-media="${item.id}">Delete local files</button>`
        }
        ${item.r2Url ? `<a class="muted" href="${escapeAttr(item.r2Url)}" target="_blank" rel="noreferrer">R2 link</a>` : ""}
      </div>
    `;

    container.appendChild(div);
  }
}

function stripExt(name) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

async function applyRenames() {
  const inputs = [...document.querySelectorAll(".rename-input")];
  const entries = inputs
    .map((input) => ({
      mediaId: input.dataset.media,
      newName: input.value.trim(),
    }))
    .filter((entry) => entry.newName);

  if (entries.length === 0) return;

  try {
    await api("/media/rename-batch", {
      method: "POST",
      body: JSON.stringify({ entries }),
    });
    refreshMedia();
  } catch (error) {
    alert(error.message);
  }
}

async function encode(mediaId, target) {
  try {
    await api(`/media/${mediaId}/encode`, {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  } catch (error) {
    alert(error.message);
  }
}

async function choose(mediaId, version) {
  try {
    await api(`/media/${mediaId}/choose`, {
      method: "POST",
      body: JSON.stringify({ version }),
    });
    refreshMedia();
  } catch (error) {
    alert(error.message);
  }
}

async function cleanup(mediaId, keep) {
  try {
    await api(`/media/${mediaId}/cleanup`, {
      method: "POST",
      body: JSON.stringify({ keep }),
    });
    refreshMedia();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteLocal(mediaId) {
  if (!confirm("Delete the local VPS files for this item?")) return;

  try {
    await api(`/media/${mediaId}/local`, { method: "DELETE" });
    refreshMedia();
  } catch (error) {
    alert(error.message);
  }
}

/* ---------------- R2 storage ---------------- */

async function refreshR2() {
  $("#r2-usage-text").textContent = "Loading...";

  try {
    state.r2 = await api("/r2/usage");
    renderR2();
    runPrecheck();
  } catch (error) {
    state.r2 = null;
    $("#r2-usage-text").textContent = error.message;
  }
}

function renderR2() {
  if (!state.r2) return;

  const { usedBytes, limitBytes, remainingBytes, files } = state.r2;

  $("#r2-usage-text").textContent = `${formatBytes(usedBytes)} used of ${formatBytes(
    limitBytes
  )} — ${formatBytes(remainingBytes)} remaining`;

  $("#r2-bar-fill").style.width = `${Math.min(
    (usedBytes / limitBytes) * 100,
    100
  )}%`;

  const filesDiv = $("#r2-files");

  if (!files || files.length === 0) {
    filesDiv.innerHTML = '<p class="muted">Bucket empty.</p>';
  } else {
    filesDiv.innerHTML = files
      .map(
        (file) => `<div class="r2-file">
          <span class="key">${escapeHtml(file.key)}</span>
          <span class="muted">${formatBytes(file.size)}</span>
          <button class="small danger r2-delete" data-key="${escapeAttr(file.key)}">Delete</button>
        </div>`
      )
      .join("");
  }
}

async function runPrecheck() {
  const selectionLabel = $("#r2-projection");
  const uploadBtn = $("#upload-btn");

  if (state.selected.size === 0) {
    selectionLabel.textContent = "";
    uploadBtn.disabled = true;
    state.precheck = null;
    return;
  }

  try {
    const report = await api("/r2/precheck", {
      method: "POST",
      body: JSON.stringify({ mediaIds: [...state.selected] }),
    });

    state.precheck = report;

    const blocked = report.entries.filter((entry) => !entry.fits);

    selectionLabel.innerHTML =
      `Selected: ${formatBytes(report.totalSelectedBytes)} — ` +
      `after upload: ${formatBytes(Math.max(report.remainingAfterBytes, 0))} remaining.` +
      (blocked.length
        ? ` <span class="fits-no">Does not fit: ${blocked
            .map((entry) => escapeHtml(entry.name))
            .join(", ")}</span>`
        : ' <span class="fits-yes">Fits within budget.</span>');

    uploadBtn.disabled = blocked.length > 0;
  } catch (error) {
    selectionLabel.textContent = error.message;
    uploadBtn.disabled = true;
  }
}

async function uploadSelected() {
  if (state.selected.size === 0) return;

  try {
    await api("/media/upload", {
      method: "POST",
      body: JSON.stringify({ mediaIds: [...state.selected] }),
    });
  } catch (error) {
    alert(error.message);
  }
}

async function deleteR2File(key) {
  if (!confirm(`Delete ${key} from R2?`)) return;

  try {
    await api(`/r2/files/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    refreshR2();
  } catch (error) {
    alert(error.message);
  }
}

/* ---------------- Jobs monitor ---------------- */

async function refreshJobs() {
  try {
    const jobs = await plainGet("/jobs");
    state.jobs = Array.isArray(jobs) ? jobs : [];
    renderJobs();
  } catch {
    // ignore transient errors
  }
}

function renderJobs() {
  const container = $("#jobs-list");

  const recent = state.jobs
    .slice()
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 8);

  if (recent.length === 0) {
    container.textContent = "No jobs yet.";
    return;
  }

  container.innerHTML = recent
    .map(
      (job) => `<div class="job-line">
        <span class="badge">${job.type}</span>
        <span class="badge">${job.status}</span>
        ${job.progress}% ${job.error ? `— <span class="fits-no">${escapeHtml(job.error.message)}</span>` : ""}
      </div>`
    )
    .join("");
}

/* ---------------- Events ---------------- */

$("#download-btn").addEventListener("click", startDownload);
$("#apply-renames").addEventListener("click", applyRenames);
$("#refresh-media").addEventListener("click", refreshMedia);
$("#refresh-r2").addEventListener("click", refreshR2);
$("#upload-btn").addEventListener("click", uploadSelected);

document.addEventListener("click", (event) => {
  const el = event.target.closest("button");
  if (!el) return;

  if (el.classList.contains("encode-btn")) encode(el.dataset.media, el.dataset.target);
  else if (el.classList.contains("copy-link")) {
    navigator.clipboard.writeText(el.dataset.url);
    el.textContent = "Copied!";
    setTimeout(() => (el.textContent = "Copy preview link"), 1500);
  } else if (el.classList.contains("cleanup-keep")) cleanup(el.dataset.media, true);
  else if (el.classList.contains("cleanup-delete")) cleanup(el.dataset.media, false);
  else if (el.classList.contains("delete-local")) deleteLocal(el.dataset.media);
  else if (el.classList.contains("r2-delete")) deleteR2File(el.dataset.key);
});

document.addEventListener("change", (event) => {
  const el = event.target;

  if (el.classList.contains("select-media")) {
    if (el.checked) state.selected.add(el.dataset.media);
    else state.selected.delete(el.dataset.media);
    runPrecheck();
  } else if (el.name && el.name.startsWith("choose-")) {
    choose(el.dataset.media, el.value);
  }
});

/* ---------------- Boot ---------------- */

refreshMedia();
refreshJobs();
setInterval(() => {
  refreshMedia();
  refreshJobs();
}, 3000);
