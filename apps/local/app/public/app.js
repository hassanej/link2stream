"use strict";

const state = { files: [], jobs: [], selected: new Set() };
const $ = (sel) => document.querySelector(sel);

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "?";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
  return `${(bytes / 1024 ** exp).toFixed(1)} ${units[exp]}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }
  return data;
}

/* ---------------- files ---------------- */

async function refreshFiles() {
  try {
    const { files } = await api("/files");
    state.files = files;
    renderFiles();
  } catch (error) {
    $("#files").textContent = error.message;
  }
}

function renderFiles() {
  const container = $("#files");

  if (state.files.length === 0) {
    container.innerHTML = '<p class="muted">Drop downloaded files into input/ and click Rescan.</p>';
    return;
  }

  container.innerHTML = state.files
    .map((file) => {
      const checked = state.selected.has(file.name) ? "checked" : "";
      return `<div class="file-row">
        <input type="checkbox" class="file-check" data-name="${escapeHtml(file.name).replace(/"/g, "&quot;")}" ${checked} />
        <span class="name">${escapeHtml(file.name)}</span>
        <span class="muted">${formatBytes(file.sizeBytes)}</span>
      </div>`;
    })
    .join("");
}

function updateSelectionUi() {
  const profile = document.querySelector('input[name="profile"]:checked')?.value;
  $("#process").disabled = state.selected.size === 0 || !profile;
  $("#selection").textContent =
    state.selected.size > 0
      ? `${state.selected.size} file(s) selected`
      : "";
}

/* ---------------- jobs ---------------- */

async function refreshJobs() {
  try {
    const { jobs } = await api("/jobs");
    state.jobs = jobs;
    renderJobs();
  } catch {
    // transient
  }
}

function jobInner(job) {
  const name = escapeHtml(job.inputName);
  const inSize = formatBytes(job.inputSizeBytes);
  const outSize = job.outputSizeBytes != null ? formatBytes(job.outputSizeBytes) : "?";

  const encodeBar = `<div class="bar"><div style="width:${job.encodeProgress}%"></div></div>`;
  const uploadBar = `<div class="bar"><div style="width:${job.uploadProgress}%"></div></div>`;

  let detail = "";

  if (job.status === "Encoding") detail = `Encoding ${job.encodeProgress}%`;
  else if (job.status === "Uploading") detail = `Upload ${job.uploadProgress}%`;
  else if (job.status === "Complete") detail = `${inSize} → ${outSize}`;
  else if (job.status === "Failed") detail = `<span class="error-text">${escapeHtml(job.error || "Failed")}</span>`;

  const link =
    job.familyLink != null
      ? `<button class="small copy" data-link="${escapeHtml(job.familyLink).replace(/"/g, "&quot;")}">Copy Family Link</button>`
      : "";

  const retry =
    job.status === "Failed"
      ? `<button class="small secondary retry" data-id="${job.id}">Retry</button>`
      : "";

  const bars = job.status === "Encoding" ? encodeBar : job.status === "Uploading" ? uploadBar : "";

  return `<div class="job-row">
    <span class="status ${job.status}">${job.status}</span>
    <span class="name">${name} <span class="muted">(${escapeHtml(job.profile)})</span></span>
    ${bars}
    <span class="muted">${detail}</span>
    ${retry}
    ${link}
  </div>`;
}

function renderJobs() {
  const container = $("#jobs");

  if (state.jobs.length === 0) {
    container.innerHTML = '<p class="muted">No jobs yet.</p>';
    return;
  }

  container.innerHTML = state.jobs.map(jobInner).join("");
}

/* ---------------- actions ---------------- */

$("#rescan").addEventListener("click", refreshFiles);

$("#process").addEventListener("click", async () => {
  const profile = document.querySelector('input[name="profile"]:checked')?.value;

  if (!profile || state.selected.size === 0) return;

  try {
    await api("/jobs", {
      method: "POST",
      body: JSON.stringify({
        files: [...state.selected],
        profile,
      }),
    });

    state.files.forEach((file) => state.selected.delete(file.name));
    refreshFiles();
    refreshJobs();
  } catch (error) {
    alert(error.message);
  }
});

document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.classList?.contains("file-check")) {
    if (el.checked) state.selected.add(el.dataset.name);
    else state.selected.delete(el.dataset.name);
  }
  updateSelectionUi();
});

document.addEventListener("click", (event) => {
  const el = event.target.closest("button");
  if (!el) return;

  if (el.classList.contains("copy")) {
    navigator.clipboard.writeText(el.dataset.link);
    el.textContent = "Copied!";
    setTimeout(() => (el.textContent = "Copy Family Link"), 1500);
  } else if (el.classList.contains("retry")) {
    fetch(`/api/jobs/${el.dataset.id}/retry`, { method: "POST" })
      .then((r) => r.json().then((d) => (!r.ok ? alert(d?.error?.message || "Retry failed") : refreshJobs())))
      .catch((e) => alert(String(e)));
  }
});

async function boot() {
  try {
    const [cfg, health] = await Promise.all([api("/config"), api("/health")]);
    $("#env-line").textContent = `${cfg.familyBaseUrl} · ffmpeg ${health.ffmpeg.available ? "OK" : "MISSING"} · VideoToolbox ${health.ffmpeg.videoToolbox ? "available" : "NOT available"}`;
  } catch {
    // non-fatal
  }

  refreshFiles();
  refreshJobs();
  setInterval(refreshJobs, 1500);
  setInterval(refreshFiles, 5000);
}

boot();
