import { useEffect, useMemo, useState } from "react";
import Login from "./components/Login";
import FileList from "./components/FileList";
import UserManager from "./components/UserManager";
import { session, logout, listFiles } from "./api";
import { formatBytes } from "./utils";
import "./styles.css";

const STORAGE_LIMIT = 10 * 1024 ** 3;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState("files");
  const [usedStorage, setUsedStorage] = useState(0);

  useEffect(() => {
    session()
      .then((result) => {
        if (result.authenticated) {
          setUser(result.user);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;

    listFiles()
      .then((result) => {
        const total = (result.files || []).reduce(
          (sum, file) => sum + Number(file.size || 0),
          0
        );
        setUsedStorage(total);
      })
      .catch(() => {});
  }, [user]);

  const storagePercent = useMemo(
    () => Math.min((usedStorage / STORAGE_LIMIT) * 100, 100),
    [usedStorage]
  );

  async function handleLogout() {
    await logout();
    setUser(null);
    setActiveView("files");
  }

  if (loading) {
    return <div className="page-message">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">L2S</div>
            <div>
              <h1>Link2Stream</h1>
              <p>Private file sharing</p>
            </div>
          </div>

          <div className="account-menu">
            <div className="avatar">
              {user.displayName?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="account-copy">
              <strong>{user.displayName}</strong>
              <span>{user.role}</span>
            </div>
            <button className="secondary-button compact" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </div>

        <nav className="top-tabs" aria-label="Primary">
          <button
            className={activeView === "files" ? "top-tab active" : "top-tab"}
            onClick={() => setActiveView("files")}
          >
            Files
          </button>

          {user.role === "admin" && (
            <button
              className={activeView === "users" ? "top-tab active" : "top-tab"}
              onClick={() => setActiveView("users")}
            >
              Users
            </button>
          )}
        </nav>
      </header>

      <main className="content-main">
        <div className="page-heading">
          <div>
            <h2>{activeView === "files" ? "Files" : "User management"}</h2>
            <p>
              {activeView === "files"
                ? "Download files and create shareable links."
                : "Create accounts and manage access."}
            </p>
          </div>
        </div>

        {activeView === "files" && (
          <>
            <section className="storage-card">
              <div className="storage-header">
                <div>
                  <span className="eyebrow">Storage usage</span>
                  <strong>{formatBytes(usedStorage)} of {formatBytes(STORAGE_LIMIT)}</strong>
                </div>
                <span>{storagePercent.toFixed(1)}%</span>
              </div>

              <div className="storage-bar">
                <div
                  className="storage-bar-fill"
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
            </section>

            <FileList user={user} onStorageChange={setUsedStorage} />
          </>
        )}

        {activeView === "users" && user.role === "admin" && (
          <UserManager currentUser={user} />
        )}
      </main>
    </div>
  );
}
