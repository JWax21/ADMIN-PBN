import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import { VscGraphLine } from "react-icons/vsc";
import { MdOutlineFindInPage } from "react-icons/md";
import "./SearchPerformance.css";

const SearchPerformance = () => {
  const [searchPerformance, setSearchPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");

  useEffect(() => {
    fetchSearchPerformance();
  }, [dateRange]);

  const fetchSearchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      const response = await apiClient.get("/api/search-console/performance", { params });

      if (response?.data?.success) {
        setSearchPerformance(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching search performance:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    // Format YYYY-MM-DD to MM/DD
    if (dateStr.length === 10) {
      const parts = dateStr.split("-");
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  if (loading && !searchPerformance) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading search performance...</p>
      </div>
    );
  }

  if (error && !searchPerformance) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchSearchPerformance} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const dailyData = searchPerformance?.dailyData || [];
  // Get the last N days based on date range
  const daysToShow = dateRange === "7daysAgo" ? 7 : dateRange === "30daysAgo" ? 30 : 90;
  const recentData = dailyData.slice(-daysToShow);
  const maxClicks = Math.max(...recentData.map((d) => d.clicks || 0), 1);
  const maxImpressions = Math.max(...recentData.map((d) => d.impressions || 0), 1);
  const maxValue = Math.max(maxClicks, maxImpressions);
  const maxCTR = Math.max(...recentData.map((d) => (d.ctr || 0) * 100), 1);

  return (
    <div className="search-performance-page">

      {/* Summary Table */}
      {searchPerformance && dailyData.length > 0 && (
        <div className="card search-performance-table-card">
          <div className="performance-table-container">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {recentData.map((d, i) => (
                    <th key={i} className="date-header">
                      {formatDate(d.date)}
                    </th>
                  ))}
                  <th className="total-header">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="metric-label">AVG Position</td>
                  {recentData.map((d, i) => (
                    <td key={i} className="metric-value">
                      {d.position ? d.position.toFixed(1) : "N/A"}
                    </td>
                  ))}
                  <td className="metric-value total">
                    {recentData.length > 0
                      ? (
                          recentData.reduce((sum, d) => sum + (d.position || 0), 0) /
                          recentData.length
                        ).toFixed(1)
                      : "N/A"}
                  </td>
                </tr>
                <tr>
                  <td className="metric-label">Impressions</td>
                  {recentData.map((d, i) => (
                    <td key={i} className="metric-value">
                      {formatNumber(d.impressions)}
                    </td>
                  ))}
                  <td className="metric-value total">
                    {formatNumber(
                      recentData.reduce((sum, d) => sum + (d.impressions || 0), 0)
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="metric-label">Clicks</td>
                  {recentData.map((d, i) => (
                    <td key={i} className="metric-value">
                      {formatNumber(d.clicks)}
                    </td>
                  ))}
                  <td className="metric-value total">
                    {formatNumber(
                      recentData.reduce((sum, d) => sum + (d.clicks || 0), 0)
                    )}
                  </td>
                </tr>
                <tr className="ctr-row">
                  <td className="metric-label">CTR</td>
                  {recentData.map((d, i) => (
                    <td key={i} className="metric-value">
                      {((d.ctr || 0) * 100).toFixed(2)}%
                    </td>
                  ))}
                  <td className="metric-value total">
                    {recentData.length > 0
                      ? (
                          (recentData.reduce((sum, d) => sum + (d.ctr || 0), 0) /
                            recentData.length) *
                          100
                        ).toFixed(2)
                      : "0.00"}
                    %
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Line Chart */}
      {recentData.length > 0 && (
        <div className="card chart-card">
          <div className="line-chart-container">
            <div className="chart-date-range-selector">
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
            <div className="chart-wrapper">
              {/* Y-axis for clicks/impressions */}
              <div className="y-axis-left">
                {Array.from({ length: 6 }, (_, i) => {
                  const value = Math.ceil((maxValue / 5) * (5 - i));
                  return (
                    <div key={i} className="y-axis-label">
                      {formatNumber(value)}
                    </div>
                  );
                })}
              </div>

              {/* Chart area */}
              <div className="chart-area-line">
                {/* Grid lines */}
                <div className="grid-lines-line">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="grid-line"></div>
                  ))}
                </div>

                {/* Lines - Clicks and Impressions */}
                <svg className="line-chart-svg" viewBox="0 0 1000 280" preserveAspectRatio="none">
                  {/* Clicks line */}
                  <polyline
                    points={recentData
                      .map(
                        (d, i) =>
                          `${(i / Math.max(1, recentData.length - 1)) * 1000},${280 - (d.clicks / maxValue) * 280}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />
                  
                  {/* Impressions line */}
                  <polyline
                    points={recentData
                      .map(
                        (d, i) =>
                          `${(i / Math.max(1, recentData.length - 1)) * 1000},${280 - (d.impressions / maxValue) * 280}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                </svg>

                {/* CTR line overlay (scaled to right y-axis) */}
                <svg className="ctr-line-svg" viewBox="0 0 1000 280" preserveAspectRatio="none">
                  <polyline
                    points={recentData
                      .map(
                        (d, i) =>
                          `${(i / Math.max(1, recentData.length - 1)) * 1000},${280 - ((d.ctr * 100) / maxCTR) * 280}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeDasharray="6,4"
                  />
                </svg>

                {/* X-axis labels */}
                <div className="x-axis-labels">
                  {recentData.map((d, i) => {
                    const step = Math.max(1, Math.floor(recentData.length / 8));
                    if (i % step === 0 || i === recentData.length - 1) {
                      return (
                        <div key={i} className="x-axis-label">
                          {formatDate(d.date)}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Y-axis for CTR */}
              <div className="y-axis-right">
                {Array.from({ length: 6 }, (_, i) => {
                  const value = ((maxCTR / 5) * (5 - i)).toFixed(1);
                  return (
                    <div key={i} className="y-axis-label">
                      {value}%
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="chart-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#3b82f6" }}></div>
                <span>Clicks</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#10b981" }}></div>
                <span>Impressions</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: "#f59e0b" }}></div>
                <span>CTR (right axis)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPerformance;

