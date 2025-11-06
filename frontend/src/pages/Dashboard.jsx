import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import { VscGraphLine } from "react-icons/vsc";
import { PiKeyReturnFill } from "react-icons/pi";
import { MdOutlineFindInPage } from "react-icons/md";
import { LuAlarmClock } from "react-icons/lu";
import { IoMdExit } from "react-icons/io";
import { AiFillDollarCircle } from "react-icons/ai";
import "./Dashboard.css";

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [topPages, setTopPages] = useState([]);
  const [trafficSources, setTrafficSources] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("7daysAgo");
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

  // Benchmarking data (industry standards)
  const benchmarks = {
    bounceRate: {
      percentile25: 26.0,
      median: 41.0,
      percentile75: 55.0,
      inverse: true, // Lower is better
    },
    avgSessionDuration: {
      percentile25: 45,
      median: 90,
      percentile75: 180,
      inverse: false, // Higher is better
    },
    // Sessions per user benchmark
    sessionsPerUser: {
      percentile25: 1.2,
      median: 1.5,
      percentile75: 2.1,
      inverse: false,
    },
    // Pages per session benchmark
    pagesPerSession: {
      percentile25: 2.0,
      median: 3.0,
      percentile75: 4.5,
      inverse: false,
    },
  };

  const getPerformanceColor = (value, benchmark) => {
    if (!value || !benchmark) return "#ffffff";

    const { percentile25, median, percentile75, inverse } = benchmark;

    if (inverse) {
      // For metrics where lower is better (e.g., bounce rate)
      if (value <= percentile25) return "#dcfce7"; // Green
      if (value <= median) return "#fef9c3"; // Yellow
      return "#fee2e2"; // Red
    } else {
      // For metrics where higher is better
      if (value >= percentile75) return "#dcfce7"; // Green
      if (value >= median) return "#fef9c3"; // Yellow
      return "#fee2e2"; // Red
    }
  };

  const formatBenchmark = (value, isTime = false) => {
    if (isTime) return formatDuration(value);
    return typeof value === "number" ? value.toFixed(1) + "%" : value;
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

      {/* Overview Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e5e7eb" }}>
            <VscGraphLine style={{ color: "#374151", fontSize: "1.25rem" }} />
          </div>
          <div className="stat-content">
            <h3>Traffic</h3>
            <p className="stat-number">
              {formatNumber(analytics?.activeUsers)}
            </p>
            <div className="sub-metrics">
              <div className="sub-metric-item">
                <span className="sub-metric-label">Sessions:</span>
                <span className="sub-metric-value">
                  {formatNumber(analytics?.sessions)}
                </span>
              </div>
              <div className="sub-metric-item">
                <span className="sub-metric-label">Page Views:</span>
                <span className="sub-metric-value">
                  {formatNumber(analytics?.pageViews)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e5e7eb" }}>
            <PiKeyReturnFill
              style={{
                color: "#374151",
                fontSize: "1.25rem",
                transform: "scaleX(-1)",
              }}
            />
          </div>
          <div className="stat-content">
            <h3>Start</h3>
            <p className="stat-number">
              {(() => {
                const buildMyBoxPage = topPages.find((page) =>
                  page.path.includes("/build-my-box")
                );
                const buildMyBoxVisitors = buildMyBoxPage?.views || 0;
                const conversionRate = analytics?.activeUsers
                  ? (buildMyBoxVisitors / analytics.activeUsers) * 100
                  : 0;
                return conversionRate.toFixed(1) + "%";
              })()}
            </p>
            <div className="sub-metrics">
              <div className="sub-metric-item">
                <span className="sub-metric-label">Visitors:</span>
                <span className="sub-metric-value">
                  {(() => {
                    const buildMyBoxPage = topPages.find((page) =>
                      page.path.includes("/build-my-box")
                    );
                    return formatNumber(buildMyBoxPage?.views || 0);
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: getPerformanceColor(
              analytics?.avgSessionDuration,
              benchmarks.avgSessionDuration
            ),
          }}
        >
          <div className="stat-icon" style={{ backgroundColor: "#e5e7eb" }}>
            <LuAlarmClock style={{ color: "#374151", fontSize: "1.25rem" }} />
          </div>
          <div className="stat-content">
            <h3>Avg. Duration</h3>
            <p className="stat-number">
              {formatDuration(analytics?.avgSessionDuration)}
            </p>
            <div className="benchmark-data">
              <div className="benchmark-item">
                <span className="benchmark-label">75th:</span>
                <span className="benchmark-value">
                  {formatDuration(benchmarks.avgSessionDuration.percentile75)}
                </span>
              </div>
              <div className="benchmark-item">
                <span className="benchmark-label">Median:</span>
                <span className="benchmark-value">
                  {formatDuration(benchmarks.avgSessionDuration.median)}
                </span>
              </div>
              <div className="benchmark-item">
                <span className="benchmark-label">25th:</span>
                <span className="benchmark-value">
                  {formatDuration(benchmarks.avgSessionDuration.percentile25)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="stat-card"
          style={{
            backgroundColor: getPerformanceColor(
              analytics?.bounceRate,
              benchmarks.bounceRate
            ),
          }}
        >
          <div className="stat-icon" style={{ backgroundColor: "#e5e7eb" }}>
            <IoMdExit style={{ color: "#374151", fontSize: "1.25rem" }} />
          </div>
          <div className="stat-content">
            <h3>Bounce Rate</h3>
            <p className="stat-number">{analytics?.bounceRate?.toFixed(1)}%</p>
            <div className="benchmark-data">
              <div className="benchmark-item">
                <span className="benchmark-label">75th:</span>
                <span className="benchmark-value">
                  {benchmarks.bounceRate.percentile75.toFixed(1)}%
                </span>
              </div>
              <div className="benchmark-item">
                <span className="benchmark-label">Median:</span>
                <span className="benchmark-value">
                  {benchmarks.bounceRate.median.toFixed(1)}%
                </span>
              </div>
              <div className="benchmark-item">
                <span className="benchmark-label">25th:</span>
                <span className="benchmark-value">
                  {benchmarks.bounceRate.percentile25.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: "#e5e7eb" }}>
            <AiFillDollarCircle
              style={{ color: "#374151", fontSize: "1.25rem" }}
            />
          </div>
          <div className="stat-content">
            <h3>Conversions</h3>
            <p className="stat-number">
              {formatNumber(analytics?.conversions)}
            </p>
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
                <span className="today-text">
                  Visitors: {formatNumber(dailyTrend[dailyTrend.length - 1]?.users || 0)}
                </span>
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
