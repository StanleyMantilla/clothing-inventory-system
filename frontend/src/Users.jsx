import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_URL = "http://localhost:5000";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
};

// Convert MongoDB IDs and regular IDs into comparable strings.
function getUserId(user) {
  return String(user?._id ?? user?.id ?? "");
}

// Safely read JSON responses from the backend.
async function readResponse(response, fallbackMessage) {
  let data = {};

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.message || fallbackMessage);
  }

  return data;
}

function Users() {
  const { token, user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processingUserId, setProcessingUserId] = useState("");

  const [form, setForm] = useState(INITIAL_FORM);

  const currentUserId = getUserId(user);

  // Load all user accounts from the backend.
  const loadUsers = useCallback(async () => {
    if (!token || user?.role !== "admin") {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readResponse(
        response,
        "Failed to load user accounts."
      );

      const userList = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
          ? data.users
          : [];

      setUsers(userList);
    } catch (err) {
      setError(err.message || "Unable to load user accounts.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  // Load users when the authentication session becomes available.
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Update the staff creation form.
  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Open or close the staff creation form.
  function toggleForm() {
    setShowForm((previous) => !previous);
    setForm(INITIAL_FORM);
    setError("");
    setSuccess("");
  }

  // Create a new staff account.
  async function handleCreateStaff(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name) {
      setError("Please enter the staff member's full name.");
      return;
    }

    if (!email) {
      setError("Please enter an email address.");
      return;
    }

    if (password.length < 12) {
      setError("The password must contain at least 12 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      await readResponse(
        response,
        "Failed to create the staff account."
      );

      setSuccess("Staff account created successfully!");
      setForm(INITIAL_FORM);
      setShowForm(false);

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to create the staff account.");
    } finally {
      setSubmitting(false);
    }
  }

  // Change a user's role.
  async function handleRoleChange(selectedUser, newRole) {
    const selectedUserId = getUserId(selectedUser);

    setError("");
    setSuccess("");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (!selectedUserId) {
      setError("Unable to identify the selected user.");
      return;
    }

    if (selectedUserId === currentUserId) {
      setError("You cannot change your own role.");
      return;
    }

    if (!["admin", "staff"].includes(newRole)) {
      setError("Invalid user role.");
      return;
    }

    if (selectedUser.role === newRole) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${selectedUser.name}'s role to ${newRole.toUpperCase()}?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingUserId(selectedUserId);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/users/${encodeURIComponent(
          selectedUserId
        )}/role`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      await readResponse(response, "Failed to update the user's role.");

      setSuccess(`${selectedUser.name}'s role was updated successfully.`);

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to update the user's role.");
      await loadUsers();
    } finally {
      setProcessingUserId("");
    }
  }

  // Delete a user account.
  async function handleDeleteUser(selectedUser) {
    const selectedUserId = getUserId(selectedUser);

    setError("");
    setSuccess("");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (!selectedUserId) {
      setError("Unable to identify the selected user.");
      return;
    }

    if (selectedUserId === currentUserId) {
      setError("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete the account for ${selectedUser.name} (${selectedUser.email})?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setProcessingUserId(selectedUserId);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/users/${encodeURIComponent(
          selectedUserId
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await readResponse(response, "Failed to delete the user account.");

      setSuccess(`${selectedUser.name}'s account was deleted successfully.`);

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to delete the user account.");
    } finally {
      setProcessingUserId("");
    }
  }

  // Restrict this page to administrators.
  if (user?.role !== "admin") {
    return (
      <section className="panel">
        <h2>Access Denied</h2>
        <p>Only administrators can manage user accounts.</p>
      </section>
    );
  }

  const totalAdmins = users.filter(
    (item) => item.role === "admin"
  ).length;

  const totalStaff = users.filter(
    (item) => item.role === "staff"
  ).length;

  return (
    <div className="users-page">
      {/* Page heading */}
      <header className="users-heading">
        <div>
          <p className="users-eyebrow"></p>
          <h1>ACCOUNT ADMINISTRATION</h1>
          <p>Manage administrator and staff accounts.</p>
        </div>

        <span className="users-account-count">
          {users.length} {users.length === 1 ? "account" : "accounts"}
        </span>
      </header>

      {/* Summary cards */}
      <section className="users-summary">
        <article className="users-summary-card users-summary-total">
          <span>Total Accounts</span>
          <strong>{users.length}</strong>
          <p>Registered system users</p>
        </article>

        <article className="users-summary-card users-summary-admin">
          <span>Administrators</span>
          <strong>{totalAdmins}</strong>
          <p>Users with admin access</p>
        </article>

        <article className="users-summary-card users-summary-staff">
          <span>Staff Members</span>
          <strong>{totalStaff}</strong>
          <p>Users with staff access</p>
        </article>
      </section>

      {/* User accounts panel */}
      <section className="panel users-panel">
        <div className="panel-header users-panel-header">
          <div>
            <h2>User Accounts</h2>
            <p>View and manage your system users.</p>
          </div>

          <button
            type="button"
            className="users-primary-button"
            onClick={toggleForm}
            disabled={submitting}
          >
            {showForm ? "Cancel" : "+ Add Staff"}
          </button>
        </div>

        {/* Feedback messages */}
        {error && (
          <div className="users-message users-error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="users-message users-success" role="status">
            {success}
          </div>
        )}

        {/* Create staff form */}
        {showForm && (
          <form className="users-form" onSubmit={handleCreateStaff}>
            <div className="users-form-heading">
              <div>
                <h3>Create Staff Account</h3>
                <p>Add a new staff member to ClothStock.</p>
              </div>
            </div>

            <div className="users-form-grid">
              <label>
                Full Name
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Email Address
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>

              <label className="users-password-field">
                Password
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleInputChange}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />

                <small>
                  Use a unique password with at least 12 characters.
                </small>
              </label>
            </div>

            <div className="users-form-actions">
              <button
                type="button"
                className="users-secondary-button"
                onClick={toggleForm}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="users-primary-button"
                disabled={submitting}
              >
                {submitting ? "Creating Account..." : "Create Staff Account"}
              </button>
            </div>
          </form>
        )}

        {/* Accounts table */}
        <div className="users-table-heading">
          <h3>Registered Users</h3>
          <span>
            {loading ? "Loading..." : `${users.length} total`}
          </span>
        </div>

        {loading ? (
          <div className="users-loading">
            <span className="users-loading-indicator" />
            Loading user accounts...
          </div>
        ) : (
          <div className="table-wrapper users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>EMAIL ADDRESS</th>
                  <th>ROLE</th>
                  <th>DATE CREATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {users.map((item) => {
                  const userId = getUserId(item);
                  const isCurrentUser =
                    currentUserId !== "" && userId === currentUserId;
                  const isProcessing = processingUserId === userId;

                  return (
                    <tr key={userId || item.email}>
                      <td>
                        <div className="users-name-cell">
                          <div className="users-avatar">
                            {(item.name || "U")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="users-name-details">
                            <strong>{item.name || "Unnamed User"}</strong>

                            {isCurrentUser && (
                              <small className="users-you-label">
                                You
                              </small>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>{item.email || "—"}</td>

                      <td>
                        <span
                          className={`users-role-badge ${
                            item.role === "admin" ? "admin" : "staff"
                          }`}
                        >
                          {item.role === "admin" ? "Admin" : "Staff"}
                        </span>
                      </td>

                      <td>
                        {item.createdAt &&
                        !Number.isNaN(new Date(item.createdAt).getTime())
                          ? new Date(item.createdAt).toLocaleDateString(
                              "en-PH",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : "—"}
                      </td>

                      <td>
                        {isCurrentUser ? (
                          <span className="users-current-label">
                            Current account
                          </span>
                        ) : (
                          <div className="users-actions">
                            <select
                              aria-label={`Change role for ${item.name}`}
                              value={item.role}
                              disabled={isProcessing}
                              onChange={(event) =>
                                handleRoleChange(item, event.target.value)
                              }
                            >
                              <option value="staff">Staff</option>
                              <option value="admin">Admin</option>
                            </select>

                            <button
                              type="button"
                              className="users-delete-button"
                              disabled={isProcessing}
                              onClick={() => handleDeleteUser(item)}
                            >
                              {isProcessing ? "Please wait..." : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      No user accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      
      </section>

    </div>
  );
}

export default Users;
