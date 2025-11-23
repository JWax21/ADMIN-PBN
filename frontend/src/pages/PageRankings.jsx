import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import { IoIosArrowUp } from "react-icons/io";
import "./PageRankings.css";

const PageRankings = () => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("clicks");
  const [sortOrder, setSortOrder] = useState("desc");
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    fetchRankings();
  }, [dateRange]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest(".custom-dropdown")) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openDropdown]);

  const fetchRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/search-console/page-rankings", {
        params: { startDate: dateRange, endDate: "today", limit: 1000 },
      });
      if (response.data.success) {
        setRankings(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching page rankings:", err);
      setError(
        err.response?.data?.error ||
          "Error Loading Page Rankings. Check console for details."
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num && num !== 0) return "N/A";
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatCTR = (ctr) => {
    if (!ctr && ctr !== 0) return "N/A";
    return `${(ctr * 100).toFixed(2)}%`;
  };

  const formatPosition = (pos) => {
    if (!pos && pos !== 0) return "N/A";
    return pos.toFixed(1);
  };

  // Categorize page by URL pattern (same logic as PageIndex)
  const categorizePage = (url) => {
    if (!url) return "other";
    
    const lowerUrl = url.toLowerCase();
    
    // Clean path for analysis (remove leading/trailing slashes)
    const cleanPath = url.replace(/^https?:\/\/(www\.)?[^\/]+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
    const pathSegments = cleanPath.split("/").filter(s => s);
    const slashCount = pathSegments.length - 1; // Number of slashes (segments - 1)
    const isRootPage = !cleanPath || cleanPath === "" || url.endsWith("/") || url.match(/^https?:\/\/(www\.)?[^\/]+\/?$/);

    // Determine type based on URL patterns (check in order of specificity)
    if (lowerUrl.includes("/ingredient-checker")) {
      return "ingredient-checker";
    } else if (lowerUrl.includes("/compare-bars") || lowerUrl.includes("/browse")) {
      return "tool";
    } else if (lowerUrl.includes("/partners") || 
               lowerUrl.includes("/contact") || 
               lowerUrl.includes("/help-center") ||
               lowerUrl.includes("/privacy-policy") ||
               lowerUrl.includes("/terms-of-service")) {
      return "about";
    } else if (lowerUrl.includes("/reviews")) {
      return "reviews";
    } else if (lowerUrl.includes("/rankings")) {
      return "rankings";
    } else if (lowerUrl.includes("/directory")) {
      return "directory";
    } else if (isRootPage || (slashCount === 0 && cleanPath)) {
      // Root page or pages with only 1 segment are Landing pages
      return "landing";
    }
    
    return "other";
  };

  const categories = [
    "all",
    "tool",
    "ingredient-checker",
    "about",
    "reviews",
    "rankings",
    "directory",
    "landing",
    "other",
  ];

  const filteredRankings = rankings
    .filter((ranking) => {
      // Search filter
      const queryMatch = ranking.query
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const pageMatch = ranking.page
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const searchMatch = queryMatch || pageMatch;
      
      // Category filter
      const category = categorizePage(ranking.page);
      const categoryMatch = selectedCategory === "all" || category === selectedCategory;
      
      return searchMatch && categoryMatch;
    })
    .sort((a, b) => {
      let aVal, bVal;
      
      if (sortBy === "position") {
        aVal = a.position || 0;
        bVal = b.position || 0;
        // For position, lower is better, so reverse the logic
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      } else if (sortBy === "clicks") {
        aVal = a.clicks || 0;
        bVal = b.clicks || 0;
      } else if (sortBy === "impressions") {
        aVal = a.impressions || 0;
        bVal = b.impressions || 0;
      } else {
        return 0;
      }
      
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

  if (loading && rankings.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading page rankings...</p>
      </div>
    );
  }

  if (error && rankings.length === 0) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchRankings} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-rankings-page">
      <div className="controls-section">
        <div className="control-group">
          <label>Date Range:</label>
          <div className="custom-dropdown">
            <div
              className="custom-dropdown-trigger"
              onClick={() =>
                setOpenDropdown(openDropdown === "dateRange" ? null : "dateRange")
              }
            >
              <span>
                {dateRange === "7daysAgo"
                  ? "Last 7 Days"
                  : dateRange === "30daysAgo"
                  ? "Last 30 Days"
                  : dateRange === "90daysAgo"
                  ? "Last 90 Days"
                  : "Last Year"}
              </span>
              <IoIosArrowUp
                className={`dropdown-arrow ${
                  openDropdown === "dateRange" ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {openDropdown === "dateRange" && (
              <div className="custom-dropdown-menu">
                {[
                  { value: "7daysAgo", label: "Last 7 Days" },
                  { value: "30daysAgo", label: "Last 30 Days" },
                  { value: "90daysAgo", label: "Last 90 Days" },
                  { value: "365daysAgo", label: "Last Year" },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`custom-dropdown-item ${
                      dateRange === option.value ? "selected" : ""
                    }`}
                    onClick={() => {
                      setDateRange(option.value);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <label>Page Type:</label>
          <div className="custom-dropdown">
            <div
              className="custom-dropdown-trigger"
              onClick={() =>
                setOpenDropdown(
                  openDropdown === "category" ? null : "category"
                )
              }
            >
              <span>
                {selectedCategory.charAt(0).toUpperCase() +
                  selectedCategory.slice(1).replace(/-/g, " ")}
              </span>
              <IoIosArrowUp
                className={`dropdown-arrow ${
                  openDropdown === "category" ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {openDropdown === "category" && (
              <div className="custom-dropdown-menu">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className={`custom-dropdown-item ${
                      selectedCategory === cat ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <label>Sort By:</label>
          <div className="custom-dropdown">
            <div
              className="custom-dropdown-trigger"
              onClick={() =>
                setOpenDropdown(openDropdown === "sortBy" ? null : "sortBy")
              }
            >
              <span>
                {sortBy === "clicks"
                  ? "Clicks"
                  : sortBy === "impressions"
                  ? "Impressions"
                  : "Position"}
              </span>
              <IoIosArrowUp
                className={`dropdown-arrow ${
                  openDropdown === "sortBy" ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {openDropdown === "sortBy" && (
              <div className="custom-dropdown-menu">
                {[
                  { value: "clicks", label: "Clicks" },
                  { value: "impressions", label: "Impressions" },
                  { value: "position", label: "Position" },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`custom-dropdown-item ${
                      sortBy === option.value ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSortBy(option.value);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <label>Order:</label>
          <div className="custom-dropdown">
            <div
              className="custom-dropdown-trigger"
              onClick={() =>
                setOpenDropdown(openDropdown === "sortOrder" ? null : "sortOrder")
              }
            >
              <span>{sortOrder === "desc" ? "Descending" : "Ascending"}</span>
              <IoIosArrowUp
                className={`dropdown-arrow ${
                  openDropdown === "sortOrder" ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {openDropdown === "sortOrder" && (
              <div className="custom-dropdown-menu">
                {[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`custom-dropdown-item ${
                      sortOrder === option.value ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSortOrder(option.value);
                      setOpenDropdown(null);
                    }}
                  >
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="control-group">
          <label>Search:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queries or pages..."
            className="control-input"
          />
        </div>
      </div>

      <div className="card">
        <div className="rankings-table-container">
          <table className="rankings-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Page</th>
                <th>Position</th>
                <th>Clicks</th>
                <th>Impressions</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {filteredRankings.length > 0 ? (
                filteredRankings.map((ranking, index) => (
                  <tr key={index}>
                    <td className="query-cell">{ranking.query}</td>
                    <td className="page-cell">{ranking.page}</td>
                    <td className="number-cell position-cell">
                      <span
                        className={`position-badge ${
                          ranking.position <= 3
                            ? "position-top"
                            : ranking.position <= 10
                            ? "position-good"
                            : ranking.position <= 20
                            ? "position-ok"
                            : "position-low"
                        }`}
                      >
                        {formatPosition(ranking.position)}
                      </span>
                    </td>
                    <td className="number-cell">{formatNumber(ranking.clicks)}</td>
                    <td className="number-cell">
                      {formatNumber(ranking.impressions)}
                    </td>
                    <td className="number-cell">{formatCTR(ranking.ctr)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="no-data">
                    No rankings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PageRankings;

