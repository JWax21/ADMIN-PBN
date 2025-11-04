import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import "./Users.css";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get("/api/users");
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      setError("Failed to fetch users. Make sure your backend is running.");
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) {
      return;
    }

    try {
      const response = await apiClient.delete(`/api/users/${id}`);
      if (response.data.success) {
        setUsers(users.filter((user) => user.id !== id));
      }
    } catch (error) {
      alert("Failed to delete user");
      console.error("Error deleting user:", error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Manage your application users</p>
        </div>
        <button className="btn btn-primary">+ Add User</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {users.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="empty-icon">👥</span>
            <h3>No users yet</h3>
            <p>
              Get started by adding your first user or connecting your Supabase
              database.
            </p>
            <button className="btn btn-primary">Add First User</button>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name || "N/A"}</td>
                  <td>{user.email || "N/A"}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.status === "active"
                          ? "badge-success"
                          : "badge-secondary"
                      }`}
                    >
                      {user.status || "inactive"}
                    </span>
                  </td>
                  <td>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon" title="Edit">
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={() => handleDelete(user.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Users;
