import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IoCloseCircleOutline } from "react-icons/io5";
import { getDeviceDetectionReport, detectDeviceModel } from "../utils/deviceDetection";
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
      // Use screen resolution from visitor data if available
      const primarySession = visitor.sessions?.[0] || {};
      const device = primarySession.device || {};
      const screenResolution = device.screenResolution;
      
      // If we have screen resolution from GA4, use it for detection
      if (screenResolution && screenResolution !== "N/A") {
        const characteristics = {
          screenResolution: screenResolution,
          deviceCategory: device.deviceCategory,
          operatingSystem: device.osVersion,
          browser: device.browserVersion,
        };
        const detection = detectDeviceModel(characteristics);
        setDeviceDetection({
          characteristics,
          detection,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Fall back to client-side detection
        const report = getDeviceDetectionReport();
        setDeviceDetection(report);
      }
    } catch (error) {
      console.warn("Device detection failed:", error);
      setDeviceDetection({ error: "Detection unavailable" });
    }
  }, [visitor]);

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

  const formatTime = (hourStr) => {
    if (!hourStr && hourStr !== 0) return "N/A";
    const hourNum = parseInt(hourStr);
    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) return "N/A";
    
    const period = hourNum >= 12 ? "PM" : "AM";
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:00 ${period}`;
  };

  // Convert state name to 2-letter abbreviation
  const getStateAbbreviation = (stateName) => {
    if (!stateName || stateName === "N/A" || stateName === "(not set)") return null;
    
    const stateMap = {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
      "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
      "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
      "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
      "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
      "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
      "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
      "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
      "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
      "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
      "District of Columbia": "DC"
    };
    
    // Check exact match first
    if (stateMap[stateName]) {
      return stateMap[stateName];
    }
    
    // Check if it's already an abbreviation (2 letters)
    if (stateName.length === 2 && /^[A-Z]{2}$/.test(stateName)) {
      return stateName;
    }
    
    // Try case-insensitive match
    const stateNameLower = stateName.toLowerCase();
    for (const [fullName, abbr] of Object.entries(stateMap)) {
      if (fullName.toLowerCase() === stateNameLower) {
        return abbr;
      }
    }
    
    return null;
  };

  const formatLocation = (city, region, country) => {
    // For non-US locations, only show country
    if (country && country !== "N/A" && country !== "United States") {
      return country;
    }
    
    // For US locations, show city, state abbreviation, country
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

  // Get location and time for header from clicked row data
  // Use visitor object properties directly (passed from row click)
  const city = visitor.city || location.city;
  const region = visitor.region || location.region;
  const country = visitor.country || location.country;
  const hour = visitor.hour || primarySession.hour;
  
  const locationStr = formatLocation(city, region, country);
  const timeStr = formatTime(hour);

  console.log("Primary session:", primarySession);

  return createPortal(
    <div className="visitor-details-panel">
      <div className="panel-overlay" onClick={onClose}></div>
      <div className="panel-content">
        <div className="panel-header">
          <div className="header-left">
            <h2 className="visitor-header-title">
              {locationStr} | {timeStr}
            </h2>
          </div>
          <div className="header-right">
            <div className="header-tags">
              <span className="header-tag">
                Pages ({formatNumber(visitor.pageViews || visitor.summary?.totalPageViews || 0)})
              </span>
              <span className="header-tag">
                {formatDuration(
                  visitor.totalDuration || 
                  primarySession.session?.totalDuration || 
                  primarySession.session?.userEngagementDuration ||
                  visitor.summary?.totalDuration || 
                  0
                )}
              </span>
            </div>
            <button onClick={onClose} className="close-btn">
              <IoCloseCircleOutline size={24} />
            </button>
          </div>
        </div>

        <div className="panel-body">
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
                <span className="info-value">{device.screenResolution || "N/A"}</span>
              </span>
              <span className="info-item-inline">
                <span className="info-value">
                  {(() => {
                    let brand = device.brand && device.brand !== "N/A" && device.brand !== "N/A (Desktop)" ? device.brand : null;
                    const model = device.model && device.model !== "N/A" && device.model !== "N/A (Desktop)" ? device.model : null;
                    
                    // If we have a detected model, use it
                    const detectedModel = deviceDetection?.detection?.detectedModel && deviceDetection.detection.detectedModel !== "Unknown" 
                      ? deviceDetection.detection.detectedModel 
                      : null;
                    
                    // If detected model is an iPhone, fall back to "Apple" for brand
                    if (detectedModel && detectedModel.toLowerCase().includes("iphone")) {
                      if (!brand || brand === "N/A") {
                        brand = "Apple";
                      }
                    }
                    
                    // If detected model is an iPad, fall back to "Apple" for brand
                    if (detectedModel && detectedModel.toLowerCase().includes("ipad")) {
                      if (!brand || brand === "N/A") {
                        brand = "Apple";
                      }
                    }
                    
                    // If we have OS info suggesting desktop, identify it
                    const os = device.os || device.osVersion || "";
                    const isDesktop = os.toLowerCase().includes("windows") || 
                                     os.toLowerCase().includes("mac") || 
                                     os.toLowerCase().includes("linux") ||
                                     os.toLowerCase().includes("chrome os");
                    
                    // If we have OS info suggesting iPad
                    const isIPad = os.toLowerCase().includes("ipados") || 
                                  (detectedModel && detectedModel.toLowerCase().includes("ipad"));
                    
                    const deviceParts = [];
                    if (brand) deviceParts.push(brand);
                    if (model) deviceParts.push(model);
                    let deviceValue = deviceParts.length > 0 ? deviceParts.join(" ") : (brand || null);
                    
                    // If no device info but we know it's desktop
                    if (!deviceValue && isDesktop) {
                      deviceValue = "Desktop";
                    }
                    
                    // If no device info but we know it's iPad
                    if (!deviceValue && isIPad) {
                      deviceValue = "iPad";
                    }
                    
                    if (!deviceValue) {
                      deviceValue = "N/A";
                    }
                    
                    if (detectedModel) {
                      return `${deviceValue} | ${detectedModel}`;
                    }
                    return deviceValue;
                  })()}
                </span>
              </span>
              <span className="info-item-inline">
                <span className="info-value">
                  {device.os || device.osVersion || "N/A"} | {device.browser || device.browserVersion || "N/A"}
                </span>
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
                              {pv.timeOnPage && pv.timeOnPage > 0 ? formatDuration(pv.timeOnPage) : "N/A"}
                            </span>
                          </td>
                          <td className="number-cell">
                            {pv.scrollPercentage !== null && pv.scrollPercentage !== undefined && pv.scrollPercentage > 0 ? `${pv.scrollPercentage}%` : "N/A"}
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

