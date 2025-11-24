import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import GeographyHeatmap from "../components/GeographyHeatmap";
import "./AudienceProfile.css";

const AudienceProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [activeTab, setActiveTab] = useState("geography");

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/analytics/audience", {
        params: {
          startDate: dateRange,
          endDate: "today",
        },
      });

      setProfile(response.data.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load audience profile");
      console.error("Error fetching audience profile:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="audience-profile-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading audience profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="audience-profile-page">
        <div className="error-container">
          <p>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audience-profile-page">
      <div className="page-header">
        <div className="date-range-selector">
          <label htmlFor="date-range">Period:</label>
          <select
            id="date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-select"
          >
            <option value="7daysAgo">Last 7 Days</option>
            <option value="30daysAgo">Last 30 Days</option>
            <option value="90daysAgo">Last 90 Days</option>
          </select>
        </div>
      </div>

      {profile && (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-label">Total Users</div>
              <div className="summary-value">
                {profile.totals?.users?.toLocaleString() || 0}
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Total Sessions</div>
              <div className="summary-value">
                {profile.totals?.sessions?.toLocaleString() || 0}
              </div>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === "geography" ? "active" : ""}`}
              onClick={() => setActiveTab("geography")}
            >
              Geography
            </button>
            <button
              className={`tab ${activeTab === "device" ? "active" : ""}`}
              onClick={() => setActiveTab("device")}
            >
              Device
            </button>
            <button
              className={`tab ${activeTab === "visitor" ? "active" : ""}`}
              onClick={() => setActiveTab("visitor")}
            >
              Visitor Type
            </button>
            {profile.demographics && (
              <button
                className={`tab ${activeTab === "demographics" ? "active" : ""}`}
                onClick={() => setActiveTab("demographics")}
              >
                Demographics
              </button>
            )}
          </div>

          {activeTab === "geography" && (
            <>
              <div className="card">
                <h2>Geographic Heatmap</h2>
                <GeographyHeatmap geographicData={profile.geographic} />
              </div>
              <div className="card">
                <h2>Geographic Breakdown</h2>
                <div className="table-container">
                  <table className="audience-table">
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th>Region</th>
                        <th>Users</th>
                        <th>Sessions</th>
                        <th>Page Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.geographic?.map((geo, index) => (
                        <tr key={index}>
                          <td>{geo.country}</td>
                          <td>{geo.region}</td>
                          <td>{geo.users?.toLocaleString()}</td>
                          <td>{geo.sessions?.toLocaleString()}</td>
                          <td>{geo.pageViews?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === "device" && (
            <div className="card">
              <h2>Device Breakdown</h2>
              <div className="table-container">
                <table className="audience-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Users</th>
                      <th>% of Users</th>
                      <th>Sessions</th>
                      <th>% of Sessions</th>
                      <th>Page Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.device?.map((device, index) => (
                      <tr key={index}>
                        <td>{device.device}</td>
                        <td>{device.users?.toLocaleString()}</td>
                        <td>{device.userPercentage}%</td>
                        <td>{device.sessions?.toLocaleString()}</td>
                        <td>{device.sessionPercentage}%</td>
                        <td>{device.pageViews?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "visitor" && (
            <div className="card">
              <h2>New vs Returning Visitors</h2>
              <div className="table-container">
                <table className="audience-table">
                  <thead>
                    <tr>
                      <th>Visitor Type</th>
                      <th>Users</th>
                      <th>Sessions</th>
                      <th>Page Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.visitorType?.map((visitor, index) => (
                      <tr key={index}>
                        <td>{visitor.type}</td>
                        <td>{visitor.users?.toLocaleString()}</td>
                        <td>{visitor.sessions?.toLocaleString()}</td>
                        <td>{visitor.pageViews?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "demographics" && profile.demographics && (
            <div className="demographics-section">
              {profile.demographics.age && Object.keys(profile.demographics.age).length > 0 && (
                <div className="card">
                  <h2>Age Distribution</h2>
                  <div className="table-container">
                    <table className="audience-table">
                      <thead>
                        <tr>
                          <th>Age Group</th>
                          <th>Users</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(profile.demographics.age)
                          .sort((a, b) => b[1] - a[1])
                          .map(([age, users], index) => (
                            <tr key={index}>
                              <td>{age}</td>
                              <td>{users?.toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {profile.demographics.gender && Object.keys(profile.demographics.gender).length > 0 && (
                <div className="card">
                  <h2>Gender Distribution</h2>
                  <div className="table-container">
                    <table className="audience-table">
                      <thead>
                        <tr>
                          <th>Gender</th>
                          <th>Users</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(profile.demographics.gender)
                          .sort((a, b) => b[1] - a[1])
                          .map(([gender, users], index) => (
                            <tr key={index}>
                              <td>{gender}</td>
                              <td>{users?.toLocaleString()}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AudienceProfile;

