import React, { useState, useEffect, useRef } from "react";
import apiClient from "../api/axios";
import VisitorDetailsPanel from "../components/VisitorDetailsPanel";
import { detectDeviceModel } from "../utils/deviceDetection";
import { IoIosArrowUp } from "react-icons/io";
import { HiDownload } from "react-icons/hi";
import * as XLSX from "xlsx";
import "./Visitors.css";

const Visitors = () => {
  const [visitors, setVisitors] = useState([]);
  const [dailyTrends, setDailyTrends] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [dateRange, setDateRange] = useState("7daysAgo");
  const [hoveredBar, setHoveredBar] = useState(null);
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  useEffect(() => {
    fetchVisitors();
    fetchDailyTrends();
    fetchMetrics();
    setCurrentPage(1); // Reset to first page when date range changes
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

  const fetchVisitors = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
        limit: 10000, // Increased limit to support export of all visitors
      };

      const response = await apiClient.get("/api/visitors", { params });

      if (response.data.success) {
        setVisitors(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching visitors:", error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyTrends = async () => {
    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      const response = await apiClient.get("/api/visitors/daily-trends", { params });

      if (response.data.success) {
        setDailyTrends(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching daily trends:", error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      const response = await apiClient.get("/api/analytics/sessions", { params });

      if (response.data.success) {
        setMetrics(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };


  const handleRowClick = async (visitor) => {
    try {
      console.log("Row clicked, visitor:", visitor);
      const params = {
        startDate: dateRange,
        endDate: "today",
      };

      console.log("Fetching visitor details for ID:", visitor.id);
      const response = await apiClient.get(`/api/visitors/${encodeURIComponent(visitor.id)}`, {
        params,
      });

      console.log("Visitor details response:", response.data);
      if (response.data.success) {
        const visitorDetails = response.data.data;
        // Pass location, time, and metrics from clicked row to visitor details
        visitorDetails.city = visitor.city;
        visitorDetails.region = visitor.region;
        visitorDetails.country = visitor.country;
        visitorDetails.hour = visitor.hour;
        visitorDetails.totalDuration = visitor.totalDuration;
        visitorDetails.pageViews = visitor.pageViews;
        setSelectedVisitor(visitorDetails);
        setIsPanelOpen(true);
        
        // Update the visitor in the list with the actual landing page if it was empty
        if (visitorDetails.actualLandingPage && !visitor.landingPage) {
          setVisitors(prevVisitors => 
            prevVisitors.map(v => 
              v.id === visitor.id 
                ? { ...v, landingPage: visitorDetails.actualLandingPage }
                : v
            )
          );
        }
        
        console.log("Panel should be open, isPanelOpen:", true, "selectedVisitor:", visitorDetails);
      } else {
        console.error("Response not successful:", response.data);
      }
    } catch (error) {
      console.error("Error fetching visitor details:", error);
      console.error("Error details:", error.response?.data);
      setError(error.response?.data?.error || error.message);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Convert state name to 2-letter abbreviation
  const getStateAbbreviation = (stateName) => {
    if (!stateName || stateName === "N/A" || stateName === "(not set)") return "";
    
    const stateMap = {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
      "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
      "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
      "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
      "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
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
    // For non-US locations, only show country
    if (country && country !== "N/A" && country !== "United States") {
      return country;
    }
    
    // For US locations, show city, state, country
    const parts = [];
    
    if (city && city !== "N/A" && city !== "(not set)") {
      parts.push(city);
    }
    
    if (region && region !== "N/A" && region !== "(not set)") {
      const stateAbbr = getStateAbbreviation(region);
      if (stateAbbr) parts.push(stateAbbr);
    }
    
    if (country && country !== "N/A") {
      const countryDisplay = country === "United States" ? "US" : country;
      parts.push(countryDisplay);
    }
    
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const formatTime = (hour) => {
    if (!hour && hour !== 0) return "N/A";
    const hourNum = parseInt(hour);
    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) return "N/A";
    
    const period = hourNum >= 12 ? "PM" : "AM";
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:00 ${period}`;
  };

  const getPageType = (url) => {
    if (!url || url === "(not set)" || url === "N/A") return { type: "N/A", remainingSlug: "N/A" };
    
    // Normalize the URL
    const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
    
    if (normalizedUrl === "/") {
      return { type: "Landing", remainingSlug: "/" };
    } else if (normalizedUrl.startsWith("/articles/rankings/")) {
      const remaining = normalizedUrl.replace("/articles/rankings", "");
      return { type: "Rankings", remainingSlug: remaining || "/" };
    } else if (normalizedUrl.startsWith("/articles/bars/reviews/")) {
      const remaining = normalizedUrl.replace("/articles/bars/reviews", "");
      return { type: "Reviews", remainingSlug: remaining || "/" };
    }
    
    // Default: return the first meaningful part or "Other"
    const parts = normalizedUrl.split("/").filter(p => p);
    if (parts.length > 0) {
      // Capitalize first letter
      const type = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const remaining = parts.length > 1 ? "/" + parts.slice(1).join("/") : "/";
      return { type, remainingSlug: remaining };
    }
    
    return { type: "Other", remainingSlug: normalizedUrl };
  };

  const getSourceIcon = (source) => {
    if (!source || source === "N/A") return null;
    
    const sourceLower = source.toLowerCase();
    
    // Special case for direct traffic - use our logo
    if (sourceLower === "direct" || sourceLower === "(direct)") {
      return "/logo.png";
    }
    
    // Map of sources to favicon URLs
    const sourceMap = {
      "google": "https://www.google.com/favicon.ico",
      "bing": "https://www.bing.com/favicon.ico",
      "yahoo": "https://www.yahoo.com/favicon.ico",
      "duckduckgo": "https://duckduckgo.com/favicon.ico",
      "facebook": "https://www.facebook.com/favicon.ico",
      "twitter": "https://twitter.com/favicon.ico",
      "linkedin": "https://www.linkedin.com/favicon.ico",
      "reddit": "https://www.reddit.com/favicon.ico",
      "youtube": "https://www.youtube.com/favicon.ico",
      "instagram": "https://www.instagram.com/favicon.ico",
      "pinterest": "https://www.pinterest.com/favicon.ico",
      "tiktok": "https://www.tiktok.com/favicon.ico",
      "chatgpt.com": "https://chat.openai.com/favicon.ico",
      "openai.com": "https://openai.com/favicon.ico",
    };
    
    // Check for exact match first
    if (sourceMap[sourceLower]) {
      return sourceMap[sourceLower];
    }
    
    // Check if source contains any of the mapped domains
    for (const [key, url] of Object.entries(sourceMap)) {
      if (sourceLower.includes(key)) {
        return url;
      }
    }
    
    return null;
  };

  const formatSlug = (slug) => {
    if (!slug || slug === "N/A" || slug === "/") return "N/A";
    
    // Remove leading slash and split by "/"
    const parts = slug.replace(/^\/+/, "").split("/").filter(p => p);
    
    if (parts.length === 0) return "N/A";
    
    // Format each part: replace - and _ with spaces, then convert to sentence case
    const formatPart = (part) => {
      // Replace hyphens and underscores with spaces
      let formatted = part.replace(/[-_]/g, " ");
      // Convert to sentence case (capitalize first letter of each word)
      return formatted
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    };
    
    const formattedParts = parts.map(formatPart);
    
    if (formattedParts.length === 1) return formattedParts[0];
    
    // Return first two parts separated by " | "
    return `${formattedParts[0]} | ${formattedParts[1]}`;
  };

  const formatDeviceInfo = (deviceCategory, deviceBrand, deviceModel, operatingSystem, browser) => {
    const parts = [];
    
    // Type (mobile or desktop)
    const type = deviceCategory ? deviceCategory.charAt(0).toUpperCase() + deviceCategory.slice(1) : "N/A";
    parts.push(type);
    
    // Device type - try to estimate using device detection table
    let deviceType = "N/A";
    
    try {
      // Use device detection to estimate device model
      const estimatedDevice = detectDeviceModel({
        deviceCategory: deviceCategory?.toLowerCase(),
        operatingSystem: operatingSystem,
        browser: browser,
        // If we have brand/model from GA4, use it as a hint
        deviceBrand: deviceBrand && deviceBrand !== "N/A" && deviceBrand !== "N/A (Desktop)" ? deviceBrand : undefined,
        deviceModel: deviceModel && deviceModel !== "N/A" && deviceModel !== "N/A (Desktop)" ? deviceModel : undefined,
      });
      
      // Use detected model if confidence is reasonable
      if (estimatedDevice.detectedModel && estimatedDevice.detectedModel !== "Unknown") {
        deviceType = estimatedDevice.detectedModel;
      } else if (deviceBrand && deviceBrand !== "N/A" && deviceBrand !== "N/A (Desktop)") {
        // Fallback to GA4 brand/model if detection didn't work
        if (deviceModel && deviceModel !== "N/A" && deviceModel !== "N/A (Desktop)") {
          deviceType = `${deviceBrand} ${deviceModel}`;
        } else {
          deviceType = deviceBrand;
        }
      }
    } catch (error) {
      console.warn("Device detection error:", error);
      // Fallback to GA4 brand/model
      if (deviceBrand && deviceBrand !== "N/A" && deviceBrand !== "N/A (Desktop)") {
        if (deviceModel && deviceModel !== "N/A" && deviceModel !== "N/A (Desktop)") {
          deviceType = `${deviceBrand} ${deviceModel}`;
        } else {
          deviceType = deviceBrand;
        }
      }
    }
    
    parts.push(deviceType);
    
    // OS
    parts.push(operatingSystem || "N/A");
    
    // Browser
    parts.push(browser || "N/A");
    
    return parts.join(" | ");
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const getDayOfWeek = (dateStr) => {
    if (!dateStr || dateStr.length !== 8) return "";
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    return days[date.getDay()];
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    // Format YYYYMMDD to readable date (without year)
    if (dateStr.length === 8) {
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${month}/${day}`;
    }
    return dateStr;
  };

  // Pagination logic
  const totalPages = Math.ceil(visitors.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVisitors = visitors.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of table
      const tableContainer = document.querySelector('.visitors-table-container');
      if (tableContainer) {
        tableContainer.scrollTop = 0;
      }
    }
  };

  // Export to XLSX
  const exportToXLSX = () => {
    // Prepare data for export
    const exportData = visitors.map((visitor) => {
      const pageType = getPageType(visitor.landingPage || "");
      const slug = formatSlug(pageType.remainingSlug);
      
      return {
        Source: visitor.sessionSource || "N/A",
        User: visitor.newVsReturning === "new" ? "New" : visitor.newVsReturning === "returning" ? "Return" : "N/A",
        Date: formatDate(visitor.date),
        Time: formatTime(visitor.hour),
        Location: formatLocation(visitor.city, visitor.region, visitor.country),
        "First Page Type": pageType.type,
        "First Page Slug": slug,
        Pages: visitor.pageViews || 0,
        Duration: formatDuration(visitor.totalDuration || 0),
        City: visitor.city || "N/A",
        Region: visitor.region || "N/A",
        Country: visitor.country || "N/A",
        Browser: visitor.browser || "N/A",
        "Device Category": visitor.deviceCategory || "N/A",
        "Device Brand": visitor.deviceBrand || "N/A",
        "Device Model": visitor.deviceModel || "N/A",
        "Operating System": visitor.operatingSystem || "N/A",
      };
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visitors");

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Source
      { wch: 10 }, // User
      { wch: 12 }, // Date
      { wch: 12 }, // Time
      { wch: 30 }, // Location
      { wch: 15 }, // First Page Type
      { wch: 40 }, // First Page Slug
      { wch: 8 },  // Pages
      { wch: 12 }, // Duration
      { wch: 20 }, // City
      { wch: 20 }, // Region
      { wch: 15 }, // Country
      { wch: 15 }, // Browser
      { wch: 15 }, // Device Category
      { wch: 15 }, // Device Brand
      { wch: 20 }, // Device Model
      { wch: 20 }, // Operating System
    ];
    ws["!cols"] = colWidths;

    // Generate filename with date range
    const dateRangeLabel = dateRange === "7daysAgo" ? "7D" : dateRange === "30daysAgo" ? "30D" : dateRange === "90daysAgo" ? "90D" : "365D";
    const filename = `visitors_${dateRangeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
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

  if (loading && visitors.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading visitors...</p>
      </div>
    );
  }

  if (error && visitors.length === 0) {
    return (
      <div className="visitors-page">
        <div className="card">
          <div className="error-message">
            <h3>⚠️ Error Loading Visitors</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="visitors-page">
      <div className="visitors-header-controls">
        <div className="period-control-group">
          <label>Period:</label>
          <div className="custom-dropdown" ref={periodDropdownRef}>
            <div
              className="custom-dropdown-trigger"
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
                className={`dropdown-arrow ${
                  isPeriodDropdownOpen ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {isPeriodDropdownOpen && (
              <div className="custom-dropdown-menu">
                <div
                  className={`custom-dropdown-item ${
                    dateRange === "7daysAgo" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("7daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>7D</span>
                </div>
                <div
                  className={`custom-dropdown-item ${
                    dateRange === "30daysAgo" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("30daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>30D</span>
                </div>
                <div
                  className={`custom-dropdown-item ${
                    dateRange === "90daysAgo" ? "selected" : ""
                  }`}
                  onClick={() => {
                    setDateRange("90daysAgo");
                    setIsPeriodDropdownOpen(false);
                  }}
                >
                  <span>90D</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {metrics && (
          <div className="visitors-metrics">
            {dailyTrends.length > 0 && metrics.today && (
              <div className="visitor-metric-card">
                <div className="visitor-metric-label">Today</div>
                <div className="visitor-metric-value">
                  <span className="metric-unique">{formatNumber(metrics.today.activeUsers || 0)}</span>
                  <span className="metric-separator">|</span>
                  <span className="metric-engaged">{formatNumber(metrics.today.engagedUsers || 0)}</span>
                </div>
              </div>
            )}
            <div className="visitor-metric-card">
              <div className="visitor-metric-label">
                {dateRange === "7daysAgo"
                  ? "Week"
                  : dateRange === "30daysAgo"
                  ? "Month"
                  : dateRange === "90daysAgo"
                  ? "3 Month"
                  : "Total Unique Visitors"}
              </div>
              <div className="visitor-metric-value">
                <span className="metric-unique">{formatNumber(metrics.activeUsers)}</span>
                <span className="metric-separator">|</span>
                <span className="metric-engaged">{formatNumber(metrics.engagedUsers || 0)}</span>
              </div>
            </div>
            <div className="visitor-metric-card">
              <div className="visitor-metric-label">Engagement Rate</div>
              <div className="visitor-metric-value">
                {metrics.engagementRate ? metrics.engagementRate.toFixed(1) : "N/A"}%
              </div>
            </div>
            <div className="visitor-metric-card">
              <div className="visitor-metric-label">Bounce Rate</div>
              <div className="visitor-metric-value">
                {metrics.bounceRate ? metrics.bounceRate.toFixed(1) : "N/A"}%
              </div>
            </div>
            <div className="visitor-metric-card">
              <div className="visitor-metric-label">Average Duration</div>
              <div className="visitor-metric-value">
                {formatDuration(metrics.averageSessionDuration)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Daily Trends Chart */}
      <div className="card trend-card">
        <div className="trend-chart">
          {dailyTrends.length > 0 ? (
            <div className="trend-chart-container">
              {/* Y-axis labels */}
              <div className="y-axis">
                {(() => {
                  const maxTotal = 500;
                  const minTotal = 0;
                  const range = maxTotal - minTotal;
                  const steps = 5;
                  const stepValue = Math.ceil(range / steps);
                  return Array.from({ length: steps + 1 }, (_, i) => {
                    const value = minTotal + stepValue * (steps - i);
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

                {/* Stacked Bars */}
                <div className="trend-bars">
                  {(() => {
                    const maxTotal = 500;
                    return dailyTrends.slice(-30).map((day, index) => {
                      // Total bar height as percentage of container
                      const totalBarHeight = (day.total / maxTotal) * 100;
                      // Segment heights as percentages of the bar (not container)
                      const dayTotal = day.total;
                      const returningHeight = dayTotal > 0 ? (day.returning / dayTotal) * 100 : 0;
                      const newHeight = dayTotal > 0 ? (day.new / dayTotal) * 100 : 0;
                      return (
                        <div
                          key={index}
                          className="trend-bar-container"
                          onMouseEnter={() => setHoveredBar(index)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          <div
                            className="trend-bar-stacked"
                            style={{
                              height: `${totalBarHeight}%`,
                            }}
                          >
                            {/* Returning visitors (bottom segment) */}
                            {day.returning > 0 && (
                              <div
                                className="trend-bar-segment returning"
                                style={{
                                  height: `${returningHeight}%`,
                                  minHeight: "2px",
                                }}
                              ></div>
                            )}
                            {/* New visitors (top segment) */}
                            {day.new > 0 && (
                              <div
                                className="trend-bar-segment new"
                                style={{
                                  height: `${newHeight}%`,
                                  minHeight: "2px",
                                }}
                              ></div>
                            )}
                            {hoveredBar === index && (
                              <div className="bar-tooltip">
                                <div className="tooltip-header">
                                  <div className="tooltip-day-name">
                                    {getDayOfWeek(day.date)}
                                  </div>
                                  <div className="tooltip-date">
                                    {formatDate(day.date)}
                                  </div>
                                </div>
                                <div className="tooltip-divider"></div>
                                <div className="tooltip-value tooltip-new">
                                  <span className="tooltip-label">New</span>
                                  <span className="tooltip-number">{formatNumber(day.new)}</span>
                                </div>
                                <div className="tooltip-value tooltip-returning">
                                  <span className="tooltip-label">Returning</span>
                                  <span className="tooltip-number">{formatNumber(day.returning)}</span>
                                </div>
                                <div className="tooltip-value total">
                                  <span className="tooltip-label">Total</span>
                                  <span className="tooltip-number">{formatNumber(day.total)}</span>
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
                    });
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data">No data available</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="visitors-table-header">
          <div className="visitors-table-title">
            <h2>Visitors</h2>
            <span className="visitors-count">({formatNumber(visitors.length)} total)</span>
          </div>
          <button className="export-button" onClick={exportToXLSX}>
            <HiDownload />
          </button>
        </div>
        <div className="visitors-table-container">
          <table className="visitors-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>User</th>
                <th>Date</th>
                <th>Location</th>
                <th>First Page</th>
                <th></th>
                <th>Pages</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {currentVisitors.length > 0 ? (
                currentVisitors.map((visitor, index) => (
                  <tr
                    key={index}
                    onClick={() => handleRowClick(visitor)}
                    className={`visitor-row ${isToday(visitor.date) ? 'today-row' : ''}`}
                  >
                    <td>
                      <div className="source-info">
                        {(() => {
                          const source = visitor.sessionSource || "N/A";
                          // Show empty string for "(not set)"
                          if (source === "(not set)") {
                            return <span className="source"> </span>;
                          }
                          const iconUrl = getSourceIcon(source);
                          return iconUrl ? (
                            <span className="source-with-icon">
                              <img src={iconUrl} alt={source} className="source-icon" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }} />
                              <span className="source-text" style={{ display: 'none' }}>{source}</span>
                            </span>
                          ) : (
                            <span className="source">{source}</span>
                          );
                        })()}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`visitor-type ${
                          visitor.newVsReturning === "new"
                            ? "visitor-type-new"
                            : "visitor-type-returning"
                        }`}
                      >
                        {visitor.newVsReturning === "new" ? "New" : visitor.newVsReturning === "returning" ? "Return" : "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className="date-value">{formatDate(visitor.date)}</span><span className="separator">|</span> {formatTime(visitor.hour)}
                    </td>
                    <td>
                      {formatLocation(visitor.city, visitor.region, visitor.country)}
                    </td>
                    <td>
                      <div className="first-page-info">
                        {visitor.landingPage && visitor.landingPage !== "(not set)" ? (
                          (() => {
                            const pageType = getPageType(visitor.landingPage).type;
                            const isTag = pageType === "Rankings" || pageType === "Reviews" || pageType === "Landing";
                            return isTag ? (
                              <span className={`page-type-tag ${pageType.toLowerCase()}-tag`}>{pageType}</span>
                            ) : (
                              <span className="first-page-type">{pageType}</span>
                            );
                          })()
                        ) : (
                          <span className="first-page-type">N/A</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="first-page-info">
                        {visitor.landingPage && visitor.landingPage !== "(not set)" ? (
                          (() => {
                            const slug = getPageType(visitor.landingPage).remainingSlug;
                            const formatted = formatSlug(slug);
                            const parts = formatted.split(" | ");
                            return parts.length === 2 ? (
                              <span className="first-page-url"><span className="slug-value-1">{parts[0]}</span><span className="separator">|</span>{parts[1]}</span>
                            ) : (
                              <span className="first-page-url"><span className="slug-value-1">{formatted}</span></span>
                            );
                          })()
                        ) : (
                          <span className="first-page-url">N/A</span>
                        )}
                      </div>
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
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-data">
                    No visitors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {visitors.length > itemsPerPage && (
          <div className="pagination-controls">
            <button
              className="pagination-button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <div className="pagination-info">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <span className="pagination-count">
                Showing {startIndex + 1}-{Math.min(endIndex, visitors.length)} of {formatNumber(visitors.length)}
              </span>
            </div>
            <button
              className="pagination-button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {isPanelOpen && selectedVisitor && (
        <VisitorDetailsPanel
          visitor={selectedVisitor}
          dateRange={dateRange}
          onClose={() => {
            console.log("Closing panel");
            setIsPanelOpen(false);
            setSelectedVisitor(null);
          }}
        />
      )}
    </div>
  );
};

export default Visitors;

