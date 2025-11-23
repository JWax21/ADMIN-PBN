import React, { useState, useEffect } from "react";
import apiClient from "../api/axios";
import { IoIosCheckmarkCircle, IoIosArrowUp } from "react-icons/io";
import "./PageIndex.css";

const PageIndex = () => {
  const [pages, setPages] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [indexedFilter, setIndexedFilter] = useState("all");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "position",
    direction: "asc",
  });

  useEffect(() => {
    fetchPages();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest(".custom-dropdown")) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const fetchPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/search-console/page-index", {
        params: { limit: 1000 },
      });
      if (response.data.success) {
        setPages(response.data.data.pages || response.data.data);
        setStats(response.data.data.stats || null);
      }
    } catch (err) {
      console.error("Error fetching page index:", err);
      setError(
        err.response?.data?.error ||
          "Error Loading Page Index. Check console for details."
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

  const formatDuration = (seconds) => {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const formatUrl = (url) => {
    if (!url) return "N/A";
    // Extract path after .com
    const match = url.match(/\.com(.*)/);
    if (match && match[1]) {
      return match[1] || "/";
    }
    return url;
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

  const filteredPages = pages.filter((page) => {
    const categoryMatch =
      selectedCategory === "all" || page.category === selectedCategory;
    const indexedMatch =
      indexedFilter === "all" ||
      (indexedFilter === "indexed" && page.indexed) ||
      (indexedFilter === "not-indexed" && !page.indexed);
    return categoryMatch && indexedMatch;
  });

  // Sort filtered pages
  const sortedPages = [...filteredPages].sort((a, b) => {
    if (sortConfig.key === "position") {
      const aVal = a.position || 0;
      const bVal = b.position || 0;

      // Treat 0 as lowest priority (sort to bottom for ASC, top for DESC)
      if (aVal === 0 && bVal === 0) return 0;
      if (aVal === 0) return 1; // a goes to bottom
      if (bVal === 0) return -1; // b goes to bottom

      return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  // Filter pages by selected category for stats calculation
  const categoryFilteredPages =
    selectedCategory === "all"
      ? pages
      : pages.filter((p) => p.category === selectedCategory);

  const categoryCounts = categories.reduce((acc, cat) => {
    if (cat === "all") {
      acc[cat] = pages.length;
    } else {
      acc[cat] = pages.filter((p) => p.category === cat).length;
    }
    return acc;
  }, {});

  // Calculate stats based on selected category
  const categoryStats = {
    totalPages: categoryFilteredPages.length,
    indexedCount: categoryFilteredPages.filter((p) => p.indexed).length,
    notIndexedCount: categoryFilteredPages.filter((p) => !p.indexed).length,
  };
  categoryStats.notIndexedPercent =
    categoryStats.totalPages > 0
      ? (
          (categoryStats.notIndexedCount / categoryStats.totalPages) *
          100
        ).toFixed(2)
      : "0.00";

  // Calculate average position for the selected category
  const indexedPagesInCategory = categoryFilteredPages.filter(
    (p) => p.indexed && p.position > 0
  );
  categoryStats.avgPosition =
    indexedPagesInCategory.length > 0
      ? (
          indexedPagesInCategory.reduce(
            (sum, p) => sum + (p.position || 0),
            0
          ) / indexedPagesInCategory.length
        ).toFixed(1)
      : "N/A";

  const indexedCount = pages.filter((p) => p.indexed).length;
  const notIndexedCount = pages.filter((p) => !p.indexed).length;

  if (loading && pages.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading page index...</p>
      </div>
    );
  }

  if (error && pages.length === 0) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchPages} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-index-page">
      <div className="filters-section">
        <div className="filter-card-wrapper">
          <label className="filter-label">Category</label>
          <div className="custom-dropdown">
            <div
              className="custom-dropdown-trigger"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>
                {selectedCategory.charAt(0).toUpperCase() +
                  selectedCategory.slice(1)}
              </span>
              <span className="dropdown-count">
                {formatNumber(categoryCounts[selectedCategory])}
              </span>
              <IoIosArrowUp
                className={`dropdown-arrow ${
                  isDropdownOpen ? "arrow-open" : "arrow-closed"
                }`}
              />
            </div>
            {isDropdownOpen && (
              <div className="custom-dropdown-menu">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    className={`custom-dropdown-item ${
                      selectedCategory === cat ? "selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span className="dropdown-count">
                      {formatNumber(categoryCounts[cat])}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {stats && (
          <div className="index-stats-inline">
            <div className="stat-box">
              <div className="stat-label">
                Total Pages{" "}
                {selectedCategory !== "all"
                  ? `(${selectedCategory})`
                  : "(Sitemap)"}
              </div>
              <div className="stat-value">
                {formatNumber(categoryStats.totalPages)}
              </div>
            </div>
            {selectedCategory !== "all" && (
              <div className="stat-box">
                <div className="stat-label">Avg Position</div>
                <div className="stat-value">{categoryStats.avgPosition}</div>
              </div>
            )}
            <div
              className={`stat-box clickable ${
                indexedFilter === "indexed" ? "active" : ""
              }`}
              onClick={() =>
                setIndexedFilter(
                  indexedFilter === "indexed" ? "all" : "indexed"
                )
              }
            >
              <div className="stat-label">Indexed</div>
              <div className="stat-value indexed">
                {formatNumber(categoryStats.indexedCount)}
              </div>
            </div>
            <div
              className={`stat-box clickable ${
                indexedFilter === "not-indexed" ? "active" : ""
              }`}
              onClick={() =>
                setIndexedFilter(
                  indexedFilter === "not-indexed" ? "all" : "not-indexed"
                )
              }
            >
              <div className="stat-label">Not Indexed</div>
              <div className="stat-value not-indexed">
                {formatNumber(categoryStats.notIndexedCount)}
              </div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Not Indexed %</div>
              <div className="stat-value not-indexed-percent">
                {categoryStats.notIndexedPercent}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="pages-table-container">
          <table className="pages-table">
            <thead>
              <tr>
                <th>Index</th>
                <th>AVG</th>
                <th>URL</th>
                <th>Category</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {sortedPages.length > 0 ? (
                sortedPages.map((page, index) => (
                  <tr key={index}>
                    <td className="index-cell">
                      <IoIosCheckmarkCircle
                        className={`index-icon ${
                          page.indexed ? "indexed" : "not-indexed"
                        }`}
                      />
                    </td>
                    <td className="number-cell center-cell">
                      {formatPosition(page.position)}
                    </td>
                    <td className="url-cell">{formatUrl(page.url)}</td>
                    <td>
                      <span
                        className={`category-badge category-${page.category}`}
                      >
                        {page.category}
                      </span>
                    </td>
                    <td className="number-cell center-cell">
                      {formatNumber(page.impressions)}
                    </td>
                    <td className="number-cell center-cell">
                      {formatNumber(page.clicks)}
                    </td>
                    <td className="number-cell center-cell">
                      {formatCTR(page.ctr)}
                    </td>
                    <td className="number-cell center-cell">
                      {page.avgDuration
                        ? formatDuration(page.avgDuration)
                        : "N/A"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-data">
                    No pages found
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

export default PageIndex;
