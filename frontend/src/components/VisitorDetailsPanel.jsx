import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IoCloseCircleOutline } from "react-icons/io5";
import { getDeviceDetectionReport } from "../utils/deviceDetection";
import "./VisitorDetailsPanel.css";

const VisitorDetailsPanel = ({ visitor, onClose }) => {
  const [deviceDetection, setDeviceDetection] = useState(null);

  // Prevent body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Run device detection when panel opens
  useEffect(() => {
    try {
      const report = getDeviceDetectionReport();
      setDeviceDetection(report);
    } catch (error) {
      console.warn("Device detection failed:", error);
      setDeviceDetection({ error: "Detection unavailable" });
    }
  }, []);

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

  const formatDateTime = (dateStr, hourStr) => {
    if (!dateStr) return "N/A";
    const date = formatDate(dateStr);
    const hour = hourStr ? `${hourStr}:00` : "";
    return hour ? `${date} ${hour}` : date;
  };

  // Parse page path to extract type and page name
  const parsePagePath = (path) => {
    if (!path) return { type: "Other", page: "N/A" };

    const lowerPath = path.toLowerCase();
    let type = "Other";
    let pagePath = "";
    let toolName = "";

    // Clean path for analysis (remove leading/trailing slashes)
    const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
    const pathSegments = cleanPath.split("/").filter(s => s);
    const slashCount = pathSegments.length - 1; // Number of slashes (segments - 1)
    const isRootPage = !cleanPath || cleanPath === "" || path === "/";

    // Determine type based on URL patterns (check in order of specificity)
    if (lowerPath.includes("/ingredient-checker")) {
      type = "Ingredient Checker";
      const index = lowerPath.indexOf("/ingredient-checker");
      pagePath = path.substring(index + "/ingredient-checker".length);
      toolName = "Ingredient Checker";
    } else if (lowerPath.includes("/compare-bars")) {
      type = "Tool";
      const index = lowerPath.indexOf("/compare-bars");
      pagePath = path.substring(index + "/compare-bars".length);
      toolName = "Compare Bars";
    } else if (lowerPath.includes("/browse")) {
      type = "Tool";
      const index = lowerPath.indexOf("/browse");
      pagePath = path.substring(index + "/browse".length);
      toolName = "Browse";
    } else if (lowerPath.includes("/partners") || 
               lowerPath.includes("/contact") || 
               lowerPath.includes("/help-center") ||
               lowerPath.includes("/privacy-policy") ||
               lowerPath.includes("/terms-of-service")) {
      type = "About";
      // Extract the about page name
      if (lowerPath.includes("/partners")) {
        const index = lowerPath.indexOf("/partners");
        pagePath = path.substring(index + "/partners".length);
        toolName = "Partners";
      } else if (lowerPath.includes("/contact")) {
        const index = lowerPath.indexOf("/contact");
        pagePath = path.substring(index + "/contact".length);
        toolName = "Contact";
      } else if (lowerPath.includes("/help-center")) {
        const index = lowerPath.indexOf("/help-center");
        pagePath = path.substring(index + "/help-center".length);
        toolName = "Help Center";
      } else if (lowerPath.includes("/privacy-policy")) {
        const index = lowerPath.indexOf("/privacy-policy");
        pagePath = path.substring(index + "/privacy-policy".length);
        toolName = "Privacy Policy";
      } else if (lowerPath.includes("/terms-of-service")) {
        const index = lowerPath.indexOf("/terms-of-service");
        pagePath = path.substring(index + "/terms-of-service".length);
        toolName = "Terms of Service";
      }
    } else if (lowerPath.includes("/reviews")) {
      type = "Reviews";
      const index = lowerPath.indexOf("/reviews");
      pagePath = path.substring(index + "/reviews".length);
    } else if (lowerPath.includes("/rankings")) {
      type = "Rankings";
      const index = lowerPath.indexOf("/rankings");
      pagePath = path.substring(index + "/rankings".length);
    } else if (lowerPath.includes("/directory")) {
      type = "Directory";
      const index = lowerPath.indexOf("/directory");
      pagePath = path.substring(index + "/directory".length);
    } else if (isRootPage || (slashCount === 0 && cleanPath)) {
      // Root page or pages with only 1 segment (no slashes, or just one segment) are Landing pages
      // But exclude if it's already categorized above
      type = "Landing";
      pagePath = "";
    }

    // Clean up the page path
    pagePath = pagePath.replace(/^\/+/, ""); // Remove leading slashes
    pagePath = pagePath.replace(/\/+$/, ""); // Remove trailing slashes
    
    // Format page name
    let pageName = "";
    if (pagePath) {
      // If there's content after the type identifier, format it
      pageName = pagePath
        .split("/")
        .map(segment => 
          segment
            .split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
        )
        .join(" / ");
    } else {
      // If no page path after type, use tool name or format the root path
      if (type === "Tool" && toolName) {
        pageName = toolName;
      } else if (type === "Ingredient Checker" && toolName) {
        pageName = toolName;
      } else if (type === "About" && toolName) {
        pageName = toolName;
      } else if (type === "Landing") {
        // Format the landing page name
        if (isRootPage) {
          pageName = "Home";
        } else {
          pageName = cleanPath
            .split("/")[0]
            .split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
        }
      } else if (type !== "Other") {
        pageName = type;
      } else {
        // For other pages, try to format the root path
        if (cleanPath) {
          pageName = cleanPath
            .split("/")[0]
            .split("-")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
        } else {
          pageName = "Home";
        }
      }
    }

    return { type, page: pageName || "Home" };
  };

  console.log("VisitorDetailsPanel rendering, visitor:", visitor);

  if (!visitor) {
    console.log("No visitor data, returning null");
    return null;
  }

  const primarySession = visitor.sessions?.[0] || {};
  const device = primarySession.device || {};
  const location = primarySession.location || {};
  const source = primarySession.source || {};
  const network = primarySession.network || {};

  console.log("Primary session:", primarySession);

  return createPortal(
    <div className="visitor-details-panel">
      <div className="panel-overlay" onClick={onClose}></div>
      <div className="panel-content">
        <div className="panel-header">
          <div className="header-left">
            <h2>Visitor Details</h2>
            <span className="client-id-badge">
              {visitor.visitorId?.substring(0, 20)}...
            </span>
          </div>
          <button onClick={onClose} className="close-btn">
            <IoCloseCircleOutline size={24} />
          </button>
        </div>

        <div className="panel-body">
          {/* Summary Section */}
          <section className="detail-section">
            <h3>Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Sessions</span>
                <span className="summary-value">
                  {formatNumber(visitor.summary?.totalSessions || 0)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Page Views</span>
                <span className="summary-value">
                  {formatNumber(visitor.summary?.totalPageViews || 0)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Events</span>
                <span className="summary-value">
                  {formatNumber(visitor.summary?.totalEvents || 0)}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Avg. Session Duration</span>
                <span className="summary-value">
                  {formatDuration(visitor.summary?.avgSessionDuration || 0)}
                </span>
              </div>
            </div>
          </section>

          {/* Network */}
          <section className="detail-section">
            <div className="info-line">
              <span className="section-title">Network</span>
              <span className="info-item-inline">
                <span className="info-label">Network Domain</span>
                <span className="info-value">{primarySession.network?.domain || "N/A (Deprecated in GA4)"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Network Provider (ISP)</span>
                <span className="info-value">{primarySession.network?.provider || "N/A (Deprecated in GA4)"}</span>
              </span>
            </div>
          </section>

          {/* Device + Technology */}
          <section className="detail-section">
            <div className="info-line">
              <span className="section-title">Device + Technology</span>
              <span className="info-item-inline">
                <span className="info-label">Screen</span>
                <span className="info-value">{device.screenResolution || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Device</span>
                <span className="info-value">
                  {(() => {
                    const brand = device.brand && device.brand !== "N/A" && device.brand !== "N/A (Desktop)" ? device.brand : null;
                    const model = device.model && device.model !== "N/A" && device.model !== "N/A (Desktop)" ? device.model : null;
                    const parts = [];
                    if (brand) parts.push(brand);
                    if (model) parts.push(model);
                    return parts.length > 0 ? parts.join(", ") : "N/A";
                  })()}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Detected Model</span>
                <span className="info-value">
                  {deviceDetection?.detection?.detectedModel ? (
                    <>
                      {deviceDetection.detection.detectedModel}
                      {deviceDetection.detection.confidence && deviceDetection.detection.confidence < 100 && (
                        <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: "0.25rem" }}>
                          ({deviceDetection.detection.confidence}% confidence)
                        </span>
                      )}
                    </>
                  ) : (
                    "N/A (Requires client-side tracking)"
                  )}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Browser</span>
                <span className="info-value">{device.browserVersion || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">OS</span>
                <span className="info-value">{device.osVersion || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">App Version</span>
                <span className="info-value">{device.appVersion || "N/A (Web only)"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Limited Ad Tracking</span>
                <span className="info-value">{device.isLimitedAdTracking || "N/A"}</span>
              </span>
            </div>
          </section>

          {/* Location */}
          <section className="detail-section">
            <div className="info-line">
              <span className="section-title">Location</span>
              <span className="info-item-inline">
                <span className="info-label">Location</span>
                <span className="info-value">
                  {(() => {
                    const city = location.city && location.city !== "N/A" && location.city !== "(not set)" ? location.city : "";
                    const region = location.region && location.region !== "N/A" && location.region !== "(not set)" ? location.region : "";
                    const country = location.country && location.country !== "N/A" ? location.country : "";
                    
                    const parts = [];
                    if (city) parts.push(city);
                    if (region) parts.push(region);
                    if (country) parts.push(country);
                    
                    return parts.length > 0 ? parts.join(", ") : "N/A";
                  })()}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Metro Area (DMA)</span>
                <span className="info-value">{location.metro && location.metro !== "N/A" ? location.metro : "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Latitude / Longitude</span>
                <span className="info-value">
                  {location.latitude && location.longitude && location.latitude !== "N/A" && location.longitude !== "N/A"
                    ? `${location.latitude}, ${location.longitude}`
                    : "N/A (Not available in GA4)"}
                </span>
              </span>
            </div>
          </section>

          {/* Source / Attribution Data */}
          <section className="detail-section">
            <div className="info-line">
              <span className="section-title">Source / Attribution Data</span>
              <span className="info-item-inline">
                <span className="info-label">Source</span>
                <span className="info-value">{source.source || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Medium</span>
                <span className="info-value">{source.medium || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Campaign</span>
                <span className="info-value">{source.campaign || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Channel</span>
                <span className="info-value">{source.channel || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Landing Page</span>
                <span className="info-value">
                  {source.landingPage || "N/A"}
                </span>
              </span>
            </div>
          </section>

          {/* Session Information */}
          <section className="detail-section">
            <div className="info-line">
              <span className="section-title">Session Information</span>
              <span className="info-item-inline">
                <span className="info-label">Visitor Type</span>
                <span className="info-value">
                  {primarySession.newVsReturning === "new" ? "New Visitor" : primarySession.newVsReturning === "returning" ? "Returning Visitor" : "N/A"}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Engaged Session</span>
                <span className="info-value">
                  {primarySession.session?.engaged ? "Yes" : "No"}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Total Sessions</span>
                <span className="info-value">
                  {formatNumber(primarySession.session?.sessions || 0)}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Page Views</span>
                <span className="info-value">
                  {formatNumber(primarySession.session?.pageViews || 0)}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Avg. Session Duration</span>
                <span className="info-value">
                  {formatDuration(primarySession.session?.avgDuration || 0)}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Bounce Rate</span>
                <span className="info-value">
                  {primarySession.session?.bounceRate?.toFixed(1) || 0}%
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-label">Event Count</span>
                <span className="info-value">
                  {formatNumber(primarySession.session?.eventCount || 0)}
                </span>
              </span>
            </div>
          </section>

          {/* Pageviews - Each Page Visit */}
          {visitor.pageviews && visitor.pageviews.length > 0 && (
            <section className="detail-section">
              <h3>Pages Visited</h3>
              <div className="table-container">
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th style={{ width: "15%" }}>Type</th>
                      <th style={{ width: "25%" }}>Page</th>
                      <th style={{ width: "15%" }}>Date & Time</th>
                      <th style={{ width: "12%" }}>Time on Page</th>
                      <th style={{ width: "10%" }}>Scroll %</th>
                      <th style={{ width: "8%" }}>Clicks</th>
                      <th style={{ width: "10%" }}>Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitor.pageviews.map((pv, index) => {
                      const { type, page } = parsePagePath(pv.path);
                      return (
                        <tr key={index}>
                          <td className="page-type">{type}</td>
                          <td className="page-name">{page}</td>
                          <td>{formatDateTime(pv.date, pv.hour)}</td>
                          <td className="time-cell">
                            <span className="time-value">
                              {formatDuration(pv.timeOnPage || 0)}
                            </span>
                          </td>
                          <td className="number-cell">
                            {pv.scrollPercentage > 0 ? `${pv.scrollPercentage}%` : "N/A"}
                          </td>
                          <td className="number-cell">
                            {formatNumber(pv.clicks || 0)}
                          </td>
                          <td className="number-cell">
                            {pv.events && pv.events.length > 0 ? (
                              <span className="events-count" title={pv.events.map(e => `${e.name} (${e.count})`).join(", ")}>
                                {pv.events.length} ({formatNumber(pv.eventCount || 0)})
                              </span>
                            ) : (
                              formatNumber(pv.eventCount || 0)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Events */}
          {visitor.events && visitor.events.length > 0 && (
            <section className="detail-section">
              <h3>Events ({visitor.events.length})</h3>
              <div className="table-container">
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>Event Name</th>
                      <th>Date</th>
                      <th>Page</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitor.events.map((event, index) => (
                      <tr key={index}>
                        <td className="event-name">{event.name}</td>
                        <td>{formatDate(event.date)}</td>
                        <td className="page-path">{event.pagePath || "N/A"}</td>
                        <td className="number-cell">
                          {formatNumber(event.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default VisitorDetailsPanel;

