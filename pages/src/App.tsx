import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import './styles/app.css'

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV
    ? ''
    : 'https://link2stream-api.link2stream.workers.dev')

type Role = 'admin' | 'family'

type User = {
  id: number
  username: string
  role: Role
}

type FileItem = {
  key: string
  name: string
  size: number
  uploaded: string
}

type FilesResponse = {
  files: FileItem[]
  totalBytes: number
  count: number
  error?: string
  message?: string
}

const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** unitIndex
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1

  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

function formatUploaded(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function App() {
  const [session, setSession] = useState<User | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [totalBytes, setTotalBytes] = useState(0)
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      try {
        const response = await fetch(`${API_BASE}/api/session`, {
          credentials: 'include',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json() as {
          authenticated: boolean
          user?: User
        }

        if (!cancelled && data.authenticated && data.user) {
          setSession(data.user)
        }
      } catch (error) {
        console.error('Failed to check session:', error)
      } finally {
        if (!cancelled) {
          setSessionLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      cancelled = true
    }
  }, [])

  const loadFiles = useCallback(async () => {
    if (!session) {
      setFiles([])
      setTotalBytes(0)
      return
    }

    setFilesLoading(true)
    setFilesError('')

    try {
      const response = await fetch(`${API_BASE}/api/files`, {
        credentials: 'include',
      })
      const data = await response.json() as FilesResponse

      if (!response.ok) {
        if (response.status === 401) {
          setSession(null)
          setFiles([])
          setTotalBytes(0)
          return
        }

        throw new Error(data.error ?? data.message ?? 'Unable to load files.')
      }

      setFiles(Array.isArray(data.files) ? data.files : [])
      setTotalBytes(
        Number.isFinite(data.totalBytes) ? data.totalBytes : 0,
      )
    } catch (error) {
      console.error('Failed to load files:', error)
      setFilesError(
        error instanceof Error
          ? error.message
          : 'Unable to load files.',
      )
    } finally {
      setFilesLoading(false)
    }
  }, [session])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return files
    }

    return files.filter((file) =>
      file.name.toLowerCase().includes(query),
    )
  }, [files, search])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (loginLoading) {
      return
    }

    setLoginError('')
    setLoginLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const data = await response.json() as {
        user?: User
        error?: string
      }

      if (!response.ok || !data.user) {
        setLoginError(data.error ?? 'Incorrect username or password.')
        return
      }

      setSession(data.user)
      setPassword('')
    } catch (error) {
      console.error('Login failed:', error)
      setLoginError('Unable to connect to the login service.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleSignOut() {
    if (logoutLoading) {
      return
    }

    setLogoutLoading(true)

    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setSession(null)
      setUsername('')
      setPassword('')
      setSearch('')
      setFiles([])
      setTotalBytes(0)
      setFilesError('')
      setLogoutLoading(false)
    }
  }

  if (sessionLoading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-heading">
            <h1>Link2Stream</h1>
            <p>Checking your session...</p>
          </div>
        </section>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="login-heading">
            <h1>Link2Stream</h1>
            <p>Sign in to view available files.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Username
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                disabled={loginLoading}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loginLoading}
                required
              />
            </label>

            {loginError && (
              <p className="login-error">{loginError}</p>
            )}

            <button
              className="primary-button login-button"
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  const isAdmin = session.role === 'admin'
  const storagePercent = Math.min(
    100,
    (totalBytes / STORAGE_LIMIT_BYTES) * 100,
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Link2Stream</h1>
          <span className="signed-in-user">
            Signed in as {session.username}
          </span>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={handleSignOut}
          disabled={logoutLoading}
        >
          {logoutLoading ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      <main className="content">
        <section className="storage-bar">
          <span>Storage</span>
          <strong>
            {formatBytes(totalBytes)} / {formatBytes(STORAGE_LIMIT_BYTES)}
          </strong>
          <progress
            aria-label="Storage used"
            max={100}
            value={storagePercent}
          />
        </section>

        <section className="library-section">
          <div className="section-heading">
            <div>
              <h2>Available files</h2>
              <span className="signed-in-user">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            <input
              className="search-input"
              type="search"
              placeholder="Search files"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={filesLoading}
            />
          </div>

          <div className="file-list">
            {filesLoading ? (
              <div className="empty-state">Loading files...</div>
            ) : filesError ? (
              <div className="empty-state">
                <p>{filesError}</p>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void loadFiles()}
                >
                  Try again
                </button>
              </div>
            ) : filteredFiles.length > 0 ? (
              filteredFiles.map((file) => (
                <article className="file-card" key={file.key}>
                  <div className="file-icon">?</div>

                  <div className="file-details">
                    <strong>{file.name}</strong>
                    <span>
                      {formatBytes(file.size)} · {formatUploaded(file.uploaded)}
                    </span>
                  </div>

                  <div className="file-actions">
                    <button className="secondary-button" type="button">
                      Copy Link
                    </button>

                    <button className="primary-button" type="button">
                      Download
                    </button>

                    {isAdmin && (
                      <button className="danger-button" type="button">
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                {files.length === 0
                  ? 'No files are available.'
                  : 'No files match your search.'}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
