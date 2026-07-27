import { useState } from "react";
import { login } from "../api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await login(username, password);
      onLogin(result.user);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f7fb",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 420,
          background: "#fff",
          borderRadius: 20,
          padding: 36,
          boxShadow: "0 12px 40px rgba(0,0,0,.12)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            margin: "0 0 32px",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          Link2Stream
        </h1>

        <form onSubmit={handleLogin}>
          <label style={{ fontWeight: 600 }}>Username</label>

          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            style={{
              width: "100%",
              height: 48,
              marginTop: 8,
              marginBottom: 20,
              padding: "0 14px",
              border: "1px solid #d1d5db",
              borderRadius: 10,
              boxSizing: "border-box",
              fontSize: 15,
            }}
          />

          <label style={{ fontWeight: 600 }}>Password</label>

          <div style={{ position: "relative", marginTop: 8 }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: "100%",
                height: 48,
                padding: "0 44px 0 14px",
                border: "1px solid #d1d5db",
                borderRadius: 10,
                boxSizing: "border-box",
                fontSize: 15,
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 18,
              }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 48,
              marginTop: 28,
              border: "none",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

          {message && (
            <div
              style={{
                marginTop: 16,
                color: "#dc2626",
                textAlign: "center",
                fontSize: 14,
              }}
            >
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
