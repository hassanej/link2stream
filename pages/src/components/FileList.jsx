import { useEffect, useState } from "react";
import {
  listFiles,
  downloadFile,
  copyPublicLink,
  deleteFile,
  deleteFiles,
} from "../api";
import { formatBytes, formatDate } from "../utils";



const notify = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(12px)";
    setTimeout(() => toast.remove(), 250);
  }, 2500);
};


export default function FileList({ user, onStorageChange }) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setLoading(true);
      setError("");

      const result = await listFiles();

      setFiles(result.files || []);
      setSelected([]);

      onStorageChange?.(
        (result.files || []).reduce(
          (sum, file) => sum + Number(file.size || 0),
          0
        )
      );

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const allSelected =
    files.length > 0 &&
    selected.length === files.length;

  function toggleAll() {
    if (allSelected) {
      setSelected([]);
    } else {
      setSelected(files.map(f => f.key));
    }
  }

  function toggleFile(key) {
    setSelected(current =>
      current.includes(key)
        ? current.filter(x => x !== key)
        : [...current, key]
    );
  }


  async function handleCopy(file) {
    try {
      await copyPublicLink(file.key);
      notify("Public link copied.");
    } catch (e) {
      notify(e.message);
    }
  }

  function handleDownload(file) {
    downloadFile(file.key);
  }

  async function handleDelete(file) {
    if (!confirm(`Delete "${file.name}"?`)) {
      return;
    }

    try {
      await deleteFile(file.key);
            const result = await listFiles();
      setFiles(result.files);

      onStorageChange?.(
        result.files.reduce(
          (sum, file) => sum + Number(file.size || 0),
          0
        )
      );

      notify("File deleted.");
    } catch (e) {
      notify(e.message);
    }
  }


  async function handleDeleteSelected() {
    if (!selected.length) return;

    if (!confirm(`Delete ${selected.length} selected file(s)?`)) {
      return;
    }

    try {
      for (const key of selected) {
        await deleteFile(key);
      }

      setSelected([]);
            const result = await listFiles();
      setFiles(result.files);

      onStorageChange?.(
        result.files.reduce(
          (sum, file) => sum + Number(file.size || 0),
          0
        )
      );

      notify("Selected files deleted.");
    } catch (e) {
      notify(e.message);
    }
  }


  return (
    <section className="panel">

      <div className="panel-toolbar">
        <div className="toolbar-left">
          {/* Upload disabled */}

          <button
            className="secondary-button"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="toolbar-right">
          <span className="selection-count">
            {selected.length} selected
          </span>


          {user?.role === "admin" && (
            <button
              className="secondary-button"
              disabled={!selected.length}
              onClick={handleDeleteSelected}
            >
              Delete Selected
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="table-wrapper">
        <table className="data-table">

          <thead>
            <tr>
              {user?.role === "admin" && <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                />
              </th>}

              <th>Name</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>

            {!loading && files.length === 0 && (
              <tr>
                <td
                  className="empty-state"
                  colSpan="5"
                >
                  No files uploaded
                </td>
              </tr>
            )}

            {files.map(file => {

              const checked =
                selected.includes(file.key);

              return (
                <tr
                  key={file.key}
                  className={
                    checked ? "selected-row" : ""
                  }
                >
                  {user?.role === "admin" && <td className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        toggleFile(file.key)
                      }
                    />
                  </td>}

                  <td>
                    <div className="file-name"><span>{file.name}</span>
                    </div>
                  </td>

                  <td>
                    {formatBytes(file.size)}
                  </td>

                  <td>
                    {formatDate(file.uploaded)}
                  </td>

                  <td>
                    <button
                      className="text-button"
                      onClick={() => handleDownload(file)}
                    >
                      Download
                    </button>

                    <button
                      className="text-button"
                      onClick={() => handleCopy(file)}
                    >
                      Copy
                    </button>

                    {user?.role === "admin" && (
                      <button
                        className="text-button danger-text"
                        onClick={() => handleDelete(file)}
                      >
                        Delete
                      </button>
                    )}
                  </td>

                </tr>
              );

            })}

          </tbody>

        </table>
      </div>

    </section>
  );
}
