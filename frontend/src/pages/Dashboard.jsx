import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import "./Dashboard.css";

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [trafficSources, setTrafficSources] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      // Fetch all analytics data in parallel
      const [overviewRes, pagesRes, sourcesRes, trendRes] = await Promise.all([
        apiClient.get("/api/analytics/overview", { params }),
        apiClient.get("/api/analytics/top-pages", {
          params: { ...params, limit: 10 },
        }),
        apiClient.get("/api/analytics/traffic-sources", { params }),
        apiClient.get("/api/analytics/daily-trend", { params }),
      ]);

      if (overviewRes.data.success) {
        setAnalytics(overviewRes.data.data);
      }
      if (pagesRes.data.success) {
        setTopPages(pagesRes.data.data);
      }
      if (sourcesRes.data.success) {
        setTrafficSources(sourcesRes.data.data);
      }
      if (trendRes.data.success) {
        setDailyTrend(trendRes.data.data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return "0";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${month}/${day}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h1>KPI Dashboard</h1>
          <p>Google Analytics for cleanboxsnacks.com</p>
        </div>
        <div className="card">
          <div className="error-message">
            <h3>⚠️ Analytics Setup Required</h3>
            <p>{error}</p>
            <p className="text-muted">
              Please configure Google Analytics credentials in your .env file:
              <br />
              - GA_PROPERTY_ID (your GA4 property ID)
              <br />- GA_KEY_FILE_PATH (path to service account JSON file)
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>KPI Dashboard</h1>
          <p>Google Analytics for cleanboxsnacks.com</p>
        </div>
        <div className="date-range-selector">
          <label htmlFor="date-range">Time Period:</label>
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

      {/* Overview Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#dbeafe" }}>
            <span style={{ color: "#3b82f6" }}>👥</span>
          </div>
          <div className="stat-content">
            <h3>Active Users</h3>
            <p className="stat-number">
              {formatNumber(analytics?.activeUsers)}
            </p>
            <span className="stat-label">Total visitors</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#d1fae5" }}>
            <span style={{ color: "#10b981" }}>📊</span>
          </div>
          <div className="stat-content">
            <h3>Sessions</h3>
            <p className="stat-number">{formatNumber(analytics?.sessions)}</p>
            <span className="stat-label">Total sessions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#fef3c7" }}>
            <span style={{ color: "#f59e0b" }}>📄</span>
          </div>
          <div className="stat-content">
            <h3>Page Views</h3>
            <p className="stat-number">{formatNumber(analytics?.pageViews)}</p>
            <span className="stat-label">Total views</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e0e7ff" }}>
            <span style={{ color: "#6366f1" }}>⏱️</span>
          </div>
          <div className="stat-content">
            <h3>Avg. Duration</h3>
            <p className="stat-number">
              {formatDuration(analytics?.avgSessionDuration)}
            </p>
            <span className="stat-label">Session duration</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#fce7f3" }}>
            <span style={{ color: "#ec4899" }}>📈</span>
          </div>
          <div className="stat-content">
            <h3>Bounce Rate</h3>
            <p className="stat-number">{analytics?.bounceRate?.toFixed(1)}%</p>
            <span className="stat-label">Visitor bounce</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#dcfce7" }}>
            <span style={{ color: "#16a34a" }}>🎯</span>
          </div>
          <div className="stat-content">
            <h3>Conversions</h3>
            <p className="stat-number">
              {formatNumber(analytics?.conversions)}
            </p>
            <span className="stat-label">Total conversions</span>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Daily Trend */}
        <div className="card trend-card">
          <div className="trend-header">
            <h2>Daily Trend</h2>
            {dailyTrend.length > 0 && (
              <div className="today-box">
                <span className="today-label">Today</span>
                <span className="today-value">
                  {formatNumber(dailyTrend[dailyTrend.length - 1]?.users || 0)}
                </span>
                <span className="today-subtitle">visitors</span>
              </div>
            )}
          </div>
          <div className="trend-chart">
            {dailyTrend.length > 0 ? (
              <div className="trend-chart-container">
                {/* Y-axis labels */}
                <div className="y-axis">
                  {(() => {
                    const maxUsers = Math.max(
                      ...dailyTrend.map((d) => d.users),
                      100
                    );
                    const minUsers = 0;
                    const range = maxUsers - minUsers;
                    const steps = 5;
                    const stepValue = Math.ceil(range / steps);
                    return Array.from({ length: steps + 1 }, (_, i) => {
                      const value = minUsers + stepValue * (steps - i);
                      return (
                        <div key={i} className="y-axis-label">
                          {formatNumber(value)}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Chart area with grid lines */}
                <div className="chart-area">
                  {/* Grid lines */}
                  <div className="grid-lines">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="grid-line"></div>
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="trend-bars">
                    {dailyTrend.slice(-30).map((day, index) => {
                      const maxUsers = Math.max(
                        ...dailyTrend.map((d) => d.users),
                        100
                      );
                      return (
                        <div
                          key={index}
                          className="trend-bar-container"
                          onMouseEnter={() => setHoveredBar(index)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <div
                            className="trend-bar"
                            style={{
                              height: `${(day.users / maxUsers) * 100}%`,
                            }}
                          >
                            {hoveredBar === index && (
                              <div className="bar-tooltip">
                                <div className="tooltip-date">
                                  {formatDate(day.date)}
                                </div>
                                <div className="tooltip-value">
                                  {formatNumber(day.users)} users
                                </div>
                              </div>
                            )}
                          </div>
                          {index % 5 === 0 && (
                            <span className="trend-label">
                              {formatDate(day.date)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted">No trend data available</p>
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="card">
          <h2>Top Pages</h2>
          <div className="data-table">
            {topPages.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Views</th>
                    <th>Avg. Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {topPages.map((page, index) => (
                    <tr key={index}>
                      <td>
                        <div className="page-info">
                          <span className="page-path">{page.path}</span>
                          {page.title && page.title !== "(not set)" && (
                            <span className="page-title">{page.title}</span>
                          )}
                        </div>
                      </td>
                      <td className="number-cell">
                        {formatNumber(page.views)}
                      </td>
                      <td className="number-cell">
                        {formatDuration(page.avgDuration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">No page data available</p>
            )}
          </div>
        </div>

        {/* Traffic Sources */}
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
                  </tr>
                </thead>
                <tbody>
                  {trafficSources.map((source, index) => (
                    <tr key={index}>
                      <td>{source.source}</td>
                      <td>{source.medium}</td>
                      <td className="number-cell">
                        {formatNumber(source.sessions)}
                      </td>
                      <td className="number-cell">
                        {formatNumber(source.users)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">No traffic source data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
