import { useCallback, useEffect, useState } from "react";
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  updateDisplayName,
} from "../api";

const EMPTY_FORM = {
  username: "",
  displayName: "",
  password: "",
};



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


export default function UserManager({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [editingNameId, setEditingNameId] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [passwordUserId, setPasswordUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const refreshUsers = useCallback(async () => {
    setError("");

    try {
      const result = await listUsers();
      setUsers(result.users || []);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();

    const username = form.username.trim();
    const name = form.displayName.trim();
    const password = form.password;

    if (!username || !name || !password) {
      setError("Username, display name, and password are required.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      await createUser({
        username,
        displayName: name,
        password,
      });

      setForm(EMPTY_FORM);
      await refreshUsers();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setWorking(false);
    }
  }

  function startNameEdit(user) {
    setEditingNameId(user.id);
    setDisplayName(user.displayName);
    setPasswordUserId(null);
    setNewPassword("");
    setError("");
  }

  async function saveDisplayName(userId) {
    const value = displayName.trim();

    if (!value) {
      setError("Display name cannot be empty.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      await updateDisplayName(userId, value);
      setEditingNameId(null);
      setDisplayName("");
      await refreshUsers();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setWorking(false);
    }
  }

  function startPasswordReset(userId) {
    setPasswordUserId(userId);
    setNewPassword("");
    setEditingNameId(null);
    setDisplayName("");
    setError("");
  }

  async function savePassword(userId) {
    if (!newPassword) {
      setError("Enter a new password.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      await resetUserPassword(userId, newPassword);
      setPasswordUserId(null);
      setNewPassword("");
      notify("Password changed.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(user) {
    if (user.id === currentUser?.id) {
      setError("You cannot delete your own account.");
      return;
    }

    const confirmed = confirm(
      `Delete account "${user.username}{currentUser?.username === user.username && <span className="you-label">You</span>}"?`
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setError("");

    try {
      await deleteUser(user.id);
      await refreshUsers();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="panel">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Add user</h2>
            <p>Create a normal user account.</p>
          </div>
        </div>

        <form onSubmit={handleCreate}>
          <div className="create-user-form">
            <label className="field">
              Username
              <input
                name="username"
                value={form.username}
                onChange={updateForm}
                autoComplete="off"
                disabled={working}
              />
            </label>

            <label className="field">
              Display name
              <input
                name="displayName"
                value={form.displayName}
                onChange={updateForm}
                autoComplete="off"
                disabled={working}
              />
            </label>

            <label className="field">
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateForm}
                autoComplete="new-password"
                disabled={working}
              />
            </label>
          </div>

          <button
            className="primary-button create-button"
            type="submit"
            disabled={working}
          >
            {working ? "Working..." : "Create user"}
          </button>
        </form>
      </section>

      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Accounts</h2>
            <p>Manage display names, passwords, and users.</p>
          </div>

          <button
            className="secondary-button compact"
            type="button"
            onClick={refreshUsers}
            disabled={working}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Display name</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                    </td>

                    <td>
                      {editingNameId === user.id ? (
                        <div className="inline-editor password-editor">
                          <input
                            value={displayName}
                            onChange={(event) =>
                              setDisplayName(event.target.value)
                            }
                            disabled={working}
                            autoFocus
                          />

                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              saveDisplayName(user.id)
                            }
                            disabled={working}
                          >
                            Save
                          </button>

                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setEditingNameId(null);
                              setDisplayName("");
                            }}
                            disabled={working}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        user.displayName
                      )}
                    </td>

                    <td><span className={`role-badge ${user.role}`}>{user.role}</span></td>

                    <td>
                      <div className="row-actions">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => startNameEdit(user)}
                          disabled={working}
                        >
                          Change name
                        </button>

                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            startPasswordReset(user.id)
                          }
                          disabled={working}
                        >
                          Change password
                        </button>

                        <button
                          className="text-button"
                          type="button"
                          onClick={() => handleDelete(user)}
                          disabled={
                            working ||
                            user.id === currentUser?.id
                          }
                          title={
                            user.id === currentUser?.id
                              ? "You cannot delete your own account"
                              : "Delete account"
                          }
                        >
                          Delete
                        </button>
                      </div>

                      {passwordUserId === user.id && (
                        <div className="inline-editor">
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(event) =>
                              setNewPassword(event.target.value)
                            }
                            disabled={working}
                            autoComplete="new-password"
                            autoFocus
                          />

                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              savePassword(user.id)
                            }
                            disabled={working}
                          >
                            Save password
                          </button>

                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setPasswordUserId(null);
                              setNewPassword("");
                            }}
                            disabled={working}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
