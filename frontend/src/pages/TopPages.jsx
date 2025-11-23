import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import { detectDeviceModel } from "../utils/deviceDetection";
import "./TopPages.css";

const TopPages = () => {
  const [topPages, setTopPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageVisitors, setPageVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [panelDateRange, setPanelDateRange] = useState("30daysAgo");

  useEffect(() => {
    fetchTopPages();
  }, [dateRange]);

  const fetchTopPages = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
        limit: 100,
      };

      const response = await apiClient.get("/api/analytics/top-pages", { params });

      if (response.data.success) {
        setTopPages(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching top pages:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePageClick = async (page) => {
    setSelectedPage(page);
    setIsPanelOpen(true);
    setPanelDateRange("30daysAgo");
    fetchPageVisitors(page.path, "30daysAgo");
  };

  const fetchPageVisitors = async (pagePath, dateRangeFilter) => {
    setVisitorsLoading(true);
    setPageVisitors([]);

    try {
      const params = {
        startDate: dateRangeFilter,
        endDate: "today",
        limit: 100,
      };

      const encodedPath = encodeURIComponent(pagePath);
      const response = await apiClient.get(`/api/visitors/by-page/${encodedPath}`, {
        params,
      });

      if (response.data.success) {
        setPageVisitors(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching page visitors:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setVisitorsLoading(false);
    }
  };

  const handlePanelDateRangeChange = (newRange) => {
    setPanelDateRange(newRange);
    if (selectedPage) {
      fetchPageVisitors(selectedPage.path, newRange);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0s";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  };

  const getStateAbbreviation = (stateName) => {
    const stateMap = {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
      "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
      "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
      "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
      "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
      "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
      "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
      "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
      "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
      "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
      "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
      "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
    };
    return stateMap[stateName] || stateName;
  };

  const formatLocation = (city, region, country) => {
    const parts = [];
    
    if (city && city !== "N/A" && city !== "(not set)") {
      parts.push(city);
    }
    if (region && region !== "N/A" && region !== "(not set)") {
      parts.push(getStateAbbreviation(region));
    }
    if (country && country !== "N/A") {
      parts.push(country === "United States" ? "US" : country);
    }
    
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const isToday = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return false;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;
    return dateStr === todayStr;
  };

  if (loading && topPages.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading top pages...</p>
      </div>
    );
  }

  if (error && topPages.length === 0) {
    return (
      <div className="top-pages-page">
        <div className="page-header">
          <h1>Top Pages</h1>
        </div>
        <div className="card">
          <div className="error-message">
            <h3>⚠️ Error Loading Top Pages</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="top-pages-page">
      <div className="page-header">
        <div>
          <h1>Top Pages</h1>
          <p>View top pages by page views and analyze their visitors</p>
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

      <div className="card">
        <div className="top-pages-table-container">
          <table className="top-pages-table">
            <thead>
              <tr>
                <th>Page Path</th>
                <th>Page Title</th>
                <th>Page Views</th>
                <th>Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {topPages.length > 0 ? (
                topPages.map((page, index) => (
                  <tr
                    key={index}
                    onClick={() => handlePageClick(page)}
                    className="page-row"
                  >
                    <td className="path-cell">{page.path}</td>
                    <td className="title-cell">{page.title || "N/A"}</td>
                    <td className="number-cell">{formatNumber(page.views)}</td>
                    <td className="number-cell">
                      {formatDuration(page.avgDuration)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="no-data">
                    No pages found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visitors Panel */}
      {isPanelOpen && selectedPage && (
        <div className="visitors-panel-overlay" onClick={() => setIsPanelOpen(false)}>
          <div className="visitors-panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <div className="panel-header-left">
                <h2>Visitors to: {selectedPage.path}</h2>
                <div className="total-visitors">
                  Total Visitors: {formatNumber(pageVisitors.length)}
                </div>
              </div>
              <div className="panel-header-right">
                <div className="date-range-selector">
                  <select
                    value={panelDateRange}
                    onChange={(e) => handlePanelDateRangeChange(e.target.value)}
                    className="date-range-select"
                  >
                    <option value="7daysAgo">7D</option>
                    <option value="30daysAgo">30D</option>
                    <option value="90daysAgo">90D</option>
                  </select>
                </div>
                <button
                  className="close-btn"
                  onClick={() => setIsPanelOpen(false)}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="panel-body">
              {visitorsLoading ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Loading visitors...</p>
                </div>
              ) : (
                <div className="visitors-table-container">
                  <table className="visitors-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Device</th>
                        <th>Location</th>
                        <th>Source</th>
                        <th>Sessions</th>
                        <th>Page Views</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageVisitors.length > 0 ? (
                        pageVisitors.map((visitor, index) => {
                          // Device detection
                          const deviceInfo = detectDeviceModel(
                            visitor.operatingSystem,
                            visitor.browser,
                            visitor.deviceCategory
                          );

                          return (
                            <tr
                              key={index}
                              className={`visitor-row ${isToday(visitor.date) ? 'today-row' : ''}`}
                            >
                              <td>{formatDate(visitor.date)}</td>
                              <td>
                                <span
                                  className={`visitor-type ${
                                    visitor.newVsReturning === "new"
                                      ? "visitor-type-new"
                                      : "visitor-type-returning"
                                  }`}
                                >
                                  {visitor.newVsReturning === "new" ? "New" : visitor.newVsReturning === "returning" ? "Returning" : "N/A"}
                                </span>
                              </td>
                              <td style={{ paddingRight: '1.5rem' }}>
                                <div className="device-info">
                                  <span className="device-category">
                                    {visitor.deviceCategory || "N/A"}
                                  </span>
                                  <span className="device-separator">|</span>
                                  <span className="device-details">
                                    {deviceInfo.model || "N/A"}
                                  </span>
                                  <span className="device-separator">|</span>
                                  <span className="device-details">
                                    {visitor.operatingSystem || "N/A"}
                                  </span>
                                  <span className="device-separator">|</span>
                                  <span className="device-details">
                                    {visitor.browser || "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td style={{ paddingLeft: '1rem' }}>
                                {formatLocation(visitor.city, visitor.region, visitor.country)}
                              </td>
                              <td>
                                {visitor.sessionSource && visitor.sessionSource !== "N/A" ? visitor.sessionSource : "N/A"}
                              </td>
                              <td className="number-cell">
                                {formatNumber(visitor.sessions)}
                              </td>
                              <td className="number-cell">
                                {formatNumber(visitor.pageViews)}
                              </td>
                              <td className="number-cell">
                                {(visitor.totalDuration || 0) <= 10 ? (
                                  <span className="duration-tag low-duration">
                                    {formatDuration(visitor.totalDuration || 0)}
                                  </span>
                                ) : (
                                  formatDuration(visitor.totalDuration || 0)
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" className="no-data">
                            No visitors found for this page
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopPages;

