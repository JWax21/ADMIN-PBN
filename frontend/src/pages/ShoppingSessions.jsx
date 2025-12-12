import React, { useState, useEffect, useRef } from "react";
import apiClient from "../api/axios";
import { IoIosArrowUp } from "react-icons/io";
import "./ShoppingSessions.css";

const ShoppingSessions = () => {
  const [shoppingData, setShoppingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [activeTab, setActiveTab] = useState("events");
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);

  useEffect(() => {
    fetchShoppingSessions();
  }, [dateRange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isPeriodDropdownOpen &&
        periodDropdownRef.current &&
        !periodDropdownRef.current.contains(event.target)
      ) {
        setIsPeriodDropdownOpen(false);
      }
    };

    if (isPeriodDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPeriodDropdownOpen]);

  const fetchShoppingSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      const response = await apiClient.get("/api/analytics/shopping-sessions", {
        params,
      });

      if (response.data.success) {
        setShoppingData(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching shopping sessions:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString.replace(/-/g, "/"));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading && !shoppingData) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading shopping sessions...</p>
      </div>
    );
  }

  if (error && !shoppingData) {
    return (
      <div className="shopping-sessions-page">
        <div className="shopping-sessions-card">
          <div className="shopping-sessions-error-message">
            <h3>⚠️ Error Loading Shopping Sessions</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const summary = shoppingData?.summary || {};
  const events = shoppingData?.events || [];

  return (
    <div className="shopping-sessions-page">
      <div className="shopping-sessions-header-controls">
        <div className="shopping-sessions-period-control-group">
          <label>Period:</label>
          <div className="shopping-sessions-custom-dropdown" ref={periodDropdownRef}>
            <div
              className="shopping-sessions-custom-dropdown-trigger"
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
            >
              <span>
                {dateRange === "7daysAgo"
                  ? "7D"
                  : dateRange === "30daysAgo"
                  ? "30D"
                  : dateRange === "90daysAgo"
                  ? "90D"
                  : "365D"}
              </span>
              <IoIosArrowUp
                className={`shopping-sessions-dropdown-arrow ${
                  isPeriodDropdownOpen ? "shopping-sessions-arrow-open" : "shopping-sessions-arrow-closed"
                }`}
              />
            </div>
            {isPeriodDropdownOpen && (
              <div className="shopping-sessions-custom-dropdown-menu">
                <div
                  className={`shopping-sessions-custom-dropdown-item ${
                    dateRange === "7daysAgo" ? "shopping-sessions-selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("7daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>7D</span>
                </div>
                <div
                  className={`shopping-sessions-custom-dropdown-item ${
                    dateRange === "30daysAgo" ? "shopping-sessions-selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("30daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>30D</span>
                </div>
                <div
                  className={`shopping-sessions-custom-dropdown-item ${
                    dateRange === "90daysAgo" ? "shopping-sessions-selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("90daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>90D</span>
                </div>
                <div
                  className={`shopping-sessions-custom-dropdown-item ${
                    dateRange === "365daysAgo" ? "shopping-sessions-selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("365daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>365D</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {shoppingData && (
          <div className="shopping-sessions-summary-stats">
            <div className="shopping-summary-card">
              <div className="shopping-summary-label">Total Clicks</div>
              <div className="shopping-summary-value">{formatNumber(summary.totalEvents)}</div>
            </div>
            <div className="shopping-summary-card">
              <div className="shopping-summary-label">Unique Users</div>
              <div className="shopping-summary-value">{formatNumber(summary.totalUsers)}</div>
            </div>
            <div className="shopping-summary-card">
              <div className="shopping-summary-label">Sessions</div>
              <div className="shopping-summary-value">{formatNumber(summary.totalSessions)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      {shoppingData && (
        <div className="shopping-sessions-tabs">
          <button
            className={`shopping-sessions-tab ${activeTab === "events" ? "shopping-sessions-active" : ""}`}
            onClick={() => setActiveTab("events")}
          >
            All Events
          </button>
          <button
            className={`shopping-sessions-tab ${activeTab === "brands" ? "shopping-sessions-active" : ""}`}
            onClick={() => setActiveTab("brands")}
          >
            By Brand
          </button>
          <button
            className={`shopping-sessions-tab ${activeTab === "flavors" ? "shopping-sessions-active" : ""}`}
            onClick={() => setActiveTab("flavors")}
          >
            By Flavor
          </button>
          <button
            className={`shopping-sessions-tab ${activeTab === "countries" ? "shopping-sessions-active" : ""}`}
            onClick={() => setActiveTab("countries")}
          >
            By Country
          </button>
          <button
            className={`shopping-sessions-tab ${activeTab === "devices" ? "shopping-sessions-active" : ""}`}
            onClick={() => setActiveTab("devices")}
          >
            By Device
          </button>
        </div>
      )}

      {/* Content */}
      {shoppingData && (
        <div className="shopping-sessions-content">
          {activeTab === "events" && (
            <div className="shopping-sessions-table-container">
              <table className="shopping-sessions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Brand</th>
                    <th>Flavor</th>
                    <th>Page</th>
                    <th>Country</th>
                    <th>Device</th>
                    <th>Source</th>
                    <th>Clicks</th>
                    <th>Users</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="shopping-sessions-empty">
                        No shopping events found for this period
                      </td>
                    </tr>
                  ) : (
                    events.map((event, index) => (
                      <tr key={index}>
                        <td>{formatDate(event.date)}</td>
                        <td>{event.brandName}</td>
                        <td>{event.flavorName}</td>
                        <td className="shopping-sessions-page-cell">
                          <div className="shopping-sessions-page-title">{event.pageTitle || "N/A"}</div>
                          <div className="shopping-sessions-page-path">{event.pagePath || "N/A"}</div>
                        </td>
                        <td>{event.country}</td>
                        <td>{event.deviceCategory}</td>
                        <td>{event.sessionSource || "N/A"}</td>
                        <td>{formatNumber(event.eventCount)}</td>
                        <td>{formatNumber(event.activeUsers)}</td>
                        <td>{formatNumber(event.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "brands" && (
            <div className="shopping-sessions-table-container">
              <table className="shopping-sessions-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Clicks</th>
                    <th>Users</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byBrand?.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="shopping-sessions-empty">
                        No brand data available
                      </td>
                    </tr>
                  ) : (
                    summary.byBrand?.map((item, index) => (
                      <tr key={index}>
                        <td>{item.brandName}</td>
                        <td>{formatNumber(item.eventCount)}</td>
                        <td>{formatNumber(item.users)}</td>
                        <td>{formatNumber(item.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "flavors" && (
            <div className="shopping-sessions-table-container">
              <table className="shopping-sessions-table">
                <thead>
                  <tr>
                    <th>Brand</th>
                    <th>Flavor</th>
                    <th>Clicks</th>
                    <th>Users</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byFlavor?.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="shopping-sessions-empty">
                        No flavor data available
                      </td>
                    </tr>
                  ) : (
                    summary.byFlavor?.map((item, index) => (
                      <tr key={index}>
                        <td>{item.brandName}</td>
                        <td>{item.flavorName}</td>
                        <td>{formatNumber(item.eventCount)}</td>
                        <td>{formatNumber(item.users)}</td>
                        <td>{formatNumber(item.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "countries" && (
            <div className="shopping-sessions-table-container">
              <table className="shopping-sessions-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Clicks</th>
                    <th>Users</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byCountry?.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="shopping-sessions-empty">
                        No country data available
                      </td>
                    </tr>
                  ) : (
                    summary.byCountry?.map((item, index) => (
                      <tr key={index}>
                        <td>{item.country}</td>
                        <td>{formatNumber(item.eventCount)}</td>
                        <td>{formatNumber(item.users)}</td>
                        <td>{formatNumber(item.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "devices" && (
            <div className="shopping-sessions-table-container">
              <table className="shopping-sessions-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Clicks</th>
                    <th>Users</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byDevice?.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="shopping-sessions-empty">
                        No device data available
                      </td>
                    </tr>
                  ) : (
                    summary.byDevice?.map((item, index) => (
                      <tr key={index}>
                        <td>{item.deviceCategory}</td>
                        <td>{formatNumber(item.eventCount)}</td>
                        <td>{formatNumber(item.users)}</td>
                        <td>{formatNumber(item.sessions)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShoppingSessions;

