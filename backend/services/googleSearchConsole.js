import { google } from "googleapis";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Google Search Console API
let searchConsoleClient = null;

/**
 * Initialize the Google Search Console API client
 * Uses the same service account credentials as Google Analytics
 */
export const initializeSearchConsole = () => {
  try {
    const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL;
    const GA_SERVICE_ACCOUNT_BASE64 = process.env.GA_SERVICE_ACCOUNT_BASE64;
    const GA_KEY_FILE = process.env.GA_KEY_FILE_PATH;

    if (!SITE_URL) {
      console.warn("⚠️  SEARCH_CONSOLE_SITE_URL not set in environment variables");
      return null;
    }

    // Get credentials from either base64 env var (production) or file (local dev)
    // Reuse the same credentials as Google Analytics
    let credentials;
    
    if (GA_SERVICE_ACCOUNT_BASE64) {
      // Production: decode base64 environment variable
      console.log("📦 Loading Search Console credentials from base64 environment variable");
      const decoded = Buffer.from(GA_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
      credentials = JSON.parse(decoded);
    } else if (GA_KEY_FILE) {
      // Local development: read from file
      console.log("📁 Loading Search Console credentials from file");
      const keyFilePath = join(__dirname, "..", GA_KEY_FILE);
      credentials = JSON.parse(readFileSync(keyFilePath, "utf8"));
    } else {
      console.warn("⚠️  Neither GA_SERVICE_ACCOUNT_BASE64 nor GA_KEY_FILE_PATH set in environment variables");
      return null;
    }

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });

    searchConsoleClient = google.searchconsole({
      version: "v1",
      auth,
    });

    console.log("✅ Google Search Console API initialized successfully");
    return searchConsoleClient;
  } catch (error) {
    console.error("❌ Error initializing Google Search Console:", error.message);
    return null;
  }
};

/**
 * Get search performance data (clicks, impressions, CTR, position)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getSearchPerformance = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    // Convert date format from "30daysAgo" to actual date
    const endDateFormatted = endDate === "today" 
      ? new Date().toISOString().split("T")[0]
      : formatDate(endDate);
    
    const startDateFormatted = formatDate(startDate);

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        dimensions: ["date"],
        rowLimit: 10000,
      },
    });

    const rows = response.data.rows || [];
    
    return {
      totalClicks: rows.reduce((sum, row) => sum + (row.clicks || 0), 0),
      totalImpressions: rows.reduce((sum, row) => sum + (row.impressions || 0), 0),
      averageCTR: rows.length > 0
        ? rows.reduce((sum, row) => sum + (row.ctr || 0), 0) / rows.length
        : 0,
      averagePosition: rows.length > 0
        ? rows.reduce((sum, row) => sum + (row.position || 0), 0) / rows.length
        : 0,
      dailyData: rows.map((row) => ({
        date: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })),
    };
  } catch (error) {
    console.error("Error fetching search performance:", error);
    throw error;
  }
};

/**
 * Get top search queries
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getTopQueries = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 10
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    const endDateFormatted = endDate === "today" 
      ? new Date().toISOString().split("T")[0]
      : formatDate(endDate);
    
    const startDateFormatted = formatDate(startDate);

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        dimensions: ["query"],
        rowLimit: limit,
        orderBys: [
          {
            dimension: "CLICKS",
            sortOrder: "DESCENDING",
          },
        ],
      },
    });

    return (
      response.data.rows?.map((row) => ({
        query: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching top queries:", error);
    throw error;
  }
};

/**
 * Get top pages from search results
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getTopPages = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 10
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    const endDateFormatted = endDate === "today" 
      ? new Date().toISOString().split("T")[0]
      : formatDate(endDate);
    
    const startDateFormatted = formatDate(startDate);

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        dimensions: ["page"],
        rowLimit: limit,
        orderBys: [
          {
            dimension: "CLICKS",
            sortOrder: "DESCENDING",
          },
        ],
      },
    });

    return (
      response.data.rows?.map((row) => ({
        page: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching top pages:", error);
    throw error;
  }
};

/**
 * Fetch and parse sitemap XML
 * @param {string} sitemapUrl - URL of the sitemap
 * @returns {Array<string>} Array of URLs from sitemap
 */
const fetchSitemap = async (sitemapUrl = "https://www.proteinbarnerd.com/sitemap.xml") => {
  try {
    const response = await axios.get(sitemapUrl);
    const xmlText = response.data;
    
    // Parse XML to extract URLs
    const urlMatches = xmlText.match(/<loc>(.*?)<\/loc>/g) || [];
    const urls = urlMatches.map(match => {
      return match.replace(/<\/?loc>/g, '').trim();
    });
    
    return urls;
  } catch (error) {
    console.error("Error fetching sitemap:", error);
    throw error;
  }
};

/**
 * Get all pages with indexing status, comparing against sitemap
 * @param {number} limit - Number of results to return
 */
export const getPageIndexStatus = async (limit = 1000) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    // Fetch sitemap URLs
    const sitemapUrls = await fetchSitemap();
    const sitemapUrlSet = new Set(sitemapUrls.map(url => {
      // Normalize URLs - remove protocol and www
      return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    }));

    // Get all pages from search analytics (pages that have appeared in search)
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ["page"],
        rowLimit: limit,
      },
    });

    // Fetch average duration from Google Analytics for all pages
    let avgDurationMap = {};
    try {
      const { getPageAvgDurations } = await import('./googleAnalytics.js');
      avgDurationMap = await getPageAvgDurations(startDate, endDate) || {};
    } catch (gaError) {
      console.warn("Could not fetch average duration from GA:", gaError.message);
      // Continue without average duration data
    }

    // Create a set of indexed URLs (normalized)
    const indexedUrlSet = new Set();
    const indexedPages = response.data.rows?.map((row) => {
      const pageUrl = row.keys[0];
      const normalizedUrl = pageUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      indexedUrlSet.add(normalizedUrl);
      
      // Extract page path from full URL for matching with GA data
      const pagePath = pageUrl.replace(/^https?:\/\/(www\.)?[^\/]+/, '') || '/';
      const avgDuration = avgDurationMap[pagePath] || null;
      
      return {
        url: pageUrl,
        indexed: true, // If it appears in search analytics, it's indexed
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        category: categorizePage(pageUrl),
        avgDuration: avgDuration,
      };
    }) || [];

    // Find pages in sitemap that are not indexed
    const notIndexedPages = sitemapUrls
      .filter(url => {
        const normalizedUrl = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        return !indexedUrlSet.has(normalizedUrl);
      })
      .map(url => {
        // Extract page path from full URL for matching with GA data
        const pagePath = url.replace(/^https?:\/\/(www\.)?[^\/]+/, '') || '/';
        const avgDuration = avgDurationMap[pagePath] || null;
        
        return {
          url: url,
          indexed: false,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          category: categorizePage(url),
          avgDuration: avgDuration,
        };
      });

    // Combine indexed and non-indexed pages
    const allPages = [...indexedPages, ...notIndexedPages];

    // Calculate statistics
    const totalPages = sitemapUrls.length;
    const indexedCount = indexedPages.length;
    const notIndexedCount = notIndexedPages.length;
    const notIndexedPercent = totalPages > 0 ? (notIndexedCount / totalPages) * 100 : 0;

    return {
      pages: allPages,
      stats: {
        totalPages,
        indexedCount,
        notIndexedCount,
        notIndexedPercent: notIndexedPercent.toFixed(2),
      },
    };
  } catch (error) {
    console.error("Error fetching page index status:", error);
    throw error;
  }
};

/**
 * Categorize page by URL pattern
 * Uses the same logic as the Visitors side panel Type mapping
 * @param {string} url - Page URL
 * @returns {string} Category (tool, about, reviews, rankings, directory, landing, other)
 */
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

/**
 * Get page rankings (queries we're showing up for)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getPageRankings = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 1000
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    const endDateFormatted = endDate === "today" 
      ? new Date().toISOString().split("T")[0]
      : formatDate(endDate);
    
    const startDateFormatted = formatDate(startDate);

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        dimensions: ["query", "page"],
        rowLimit: limit,
        orderBys: [
          {
            dimension: "CLICKS",
            sortOrder: "DESCENDING",
          },
        ],
      },
    });

    return (
      response.data.rows?.map((row) => ({
        query: row.keys[0],
        page: row.keys[1],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching page rankings:", error);
    throw error;
  }
};

/**
 * Get top countries from search traffic
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getTopCountries = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 10
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    const endDateFormatted = endDate === "today" 
      ? new Date().toISOString().split("T")[0]
      : formatDate(endDate);
    
    const startDateFormatted = formatDate(startDate);

    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        dimensions: ["country"],
        rowLimit: limit,
        orderBys: [
          {
            dimension: "CLICKS",
            sortOrder: "DESCENDING",
          },
        ],
      },
    });

    return (
      response.data.rows?.map((row) => ({
        country: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      })) || []
    );
  } catch (error) {
    console.error("Error fetching top countries:", error);
    throw error;
  }
};

/**
 * Helper function to convert date format
 * Converts "30daysAgo" to actual date string
 */
function formatDate(dateStr) {
  if (dateStr === "today") {
    return new Date().toISOString().split("T")[0];
  }
  
  if (dateStr.endsWith("daysAgo")) {
    const days = parseInt(dateStr.replace("daysAgo", ""));
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split("T")[0];
  }
  
  // If it's already in YYYY-MM-DD format, return as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }
  
  return dateStr;
}

export default {
  initializeSearchConsole,
  getSearchPerformance,
  getTopQueries,
  getTopPages,
  getTopCountries,
  getPageIndexStatus,
  getPageRankings,
};

