import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import "./TrafficSources.css";

const TrafficSources = () => {
  const [trafficSources, setTrafficSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");

  useEffect(() => {
    fetchTrafficSources();
  }, [dateRange]);

  const fetchTrafficSources = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      const response = await apiClient.get("/api/analytics/traffic-sources", {
        params,
      });

      if (response.data.success) {
        setTrafficSources(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching traffic sources:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Calculate totals
  const totalSessions = trafficSources.reduce(
    (sum, source) => sum + (source.sessions || 0),
    0
  );
  const totalUsers = trafficSources.reduce(
    (sum, source) => sum + (source.users || 0),
    0
  );

  if (loading && trafficSources.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading traffic sources...</p>
      </div>
    );
  }

  if (error && trafficSources.length === 0) {
    return (
      <div className="traffic-sources-page">
        <div className="page-header">
          <h1>Traffic Sources</h1>
        </div>
        <div className="card">
          <div className="error-message">
            <h3>⚠️ Error Loading Traffic Sources</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="traffic-sources-page">
      <div className="page-header">
        <div>
          <h1>Traffic Sources</h1>
          <p>Analyze where your website traffic comes from</p>
        </div>
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
            <option value="365daysAgo">Last Year</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      {trafficSources.length > 0 && (
        <div className="summary-stats">
          <div className="summary-card">
            <div className="summary-label">Total Sources</div>
            <div className="summary-value">{trafficSources.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Sessions</div>
            <div className="summary-value">{formatNumber(totalSessions)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total Users</div>
            <div className="summary-value">{formatNumber(totalUsers)}</div>
          </div>
        </div>
      )}

      {/* Traffic Sources Table */}
      <div className="card">
        <h2>Traffic Sources</h2>
        <div className="data-table">
          {trafficSources.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Medium</th>
                  <th>Sessions</th>
                  <th>Users</th>
                  <th>Sessions %</th>
                </tr>
              </thead>
              <tbody>
                {trafficSources.map((source, index) => {
                  const sessionsPercent =
                    totalSessions > 0
                      ? ((source.sessions / totalSessions) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr key={index}>
                      <td>
                        <div className="source-with-favicon">
                          <img
                            src={`https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${source.source}&size=32`}
                            alt=""
                            className="source-favicon"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <span>{source.source}</span>
                        </div>
                      </td>
                      <td>
                        <span className="medium-badge">{source.medium}</span>
                      </td>
                      <td className="number-cell">
                        {formatNumber(source.sessions)}
                      </td>
                      <td className="number-cell">
                        {formatNumber(source.users)}
                      </td>
                      <td className="number-cell">
                        <div className="percentage-cell">
                          <span>{sessionsPercent}%</span>
                          <div className="percentage-bar">
                            <div
                              className="percentage-fill"
                              style={{ width: `${sessionsPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No traffic source data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrafficSources;

