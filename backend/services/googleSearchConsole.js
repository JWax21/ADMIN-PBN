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
      console.warn(
        "⚠️  SEARCH_CONSOLE_SITE_URL not set in environment variables"
      );
      return null;
    }

    // Get credentials from either base64 env var (production) or file (local dev)
    // Reuse the same credentials as Google Analytics
    let credentials;

    if (GA_SERVICE_ACCOUNT_BASE64) {
      // Production: decode base64 environment variable
      console.log(
        "📦 Loading Search Console credentials from base64 environment variable"
      );
      const decoded = Buffer.from(GA_SERVICE_ACCOUNT_BASE64, "base64").toString(
        "utf8"
      );
      credentials = JSON.parse(decoded);
    } else if (GA_KEY_FILE) {
      // Local development: read from file
      console.log("📁 Loading Search Console credentials from file");
      const keyFilePath = join(__dirname, "..", GA_KEY_FILE);
      credentials = JSON.parse(readFileSync(keyFilePath, "utf8"));
    } else {
      console.warn(
        "⚠️  Neither GA_SERVICE_ACCOUNT_BASE64 nor GA_KEY_FILE_PATH set in environment variables"
      );
      return null;
    }

    // Create auth client
    // Note: URL Inspection API requires webmasters scope (readonly is sufficient for inspection)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/webmasters.readonly",
        "https://www.googleapis.com/auth/webmasters",
      ],
    });

    searchConsoleClient = google.searchconsole({
      version: "v1",
      auth,
    });

    console.log("✅ Google Search Console API initialized successfully");
    return searchConsoleClient;
  } catch (error) {
    console.error(
      "❌ Error initializing Google Search Console:",
      error.message
    );
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
    const endDateFormatted =
      endDate === "today"
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
    const totalClicksFromAPI = rows.reduce((sum, row) => sum + (row.clicks || 0), 0);
    console.log(`[getSearchPerformance] Date: ${startDateFormatted} to ${endDateFormatted}, Rows returned: ${rows.length}, Total clicks from API: ${totalClicksFromAPI}`);

    return {
      totalClicks: totalClicksFromAPI,
      totalImpressions: rows.reduce(
        (sum, row) => sum + (row.impressions || 0),
        0
      ),
      averageCTR:
        rows.length > 0
          ? rows.reduce((sum, row) => sum + (row.ctr || 0), 0) / rows.length
          : 0,
      averagePosition:
        rows.length > 0
          ? rows.reduce((sum, row) => sum + (row.position || 0), 0) /
            rows.length
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
    const endDateFormatted =
      endDate === "today"
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
    const endDateFormatted =
      endDate === "today"
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
const fetchSitemap = async (
  sitemapUrl = "https://www.proteinbarnerd.com/sitemap.xml"
) => {
  try {
    const response = await axios.get(sitemapUrl);
    const xmlText = response.data;

    // Parse XML to extract URLs
    const urlMatches = xmlText.match(/<loc>(.*?)<\/loc>/g) || [];
    const urls = urlMatches.map((match) => {
      return match.replace(/<\/?loc>/g, "").trim();
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
export const getPageIndexStatus = async (limit = 25000) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    // Fetch sitemap URLs
    const sitemapUrls = await fetchSitemap();
    const sitemapUrlSet = new Set(
      sitemapUrls.map((url) => {
        // Normalize URLs - remove protocol and www
        return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      })
    );

    // Get all pages from search analytics (pages that have appeared in search)
    // Note: This only returns pages that have appeared in search results, not all indexed pages
    // Google Search Console API doesn't provide a direct way to get all indexed pages
    // The Coverage report in GSC UI shows all indexed pages, but this data isn't available via API
    const endDate = new Date().toISOString().split("T")[0];
    // Use a long date range (2 years) to capture most historical data
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Maximum limit is 25,000 rows per request
    const maxLimit = Math.min(limit, 25000);
    
    const response = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ["page"],
        rowLimit: maxLimit,
      },
    });

    // Fetch average duration, unique visitors, and bounce rate from Google Analytics for all pages
    let avgDurationMap = {};
    let pageVisitorsMap = {};
    try {
      const { getPageAvgDurations, getPageVisitorsAndBounceRate } =
        await import("./googleAnalytics.js");
      avgDurationMap = (await getPageAvgDurations(startDate, endDate)) || {};
      pageVisitorsMap =
        (await getPageVisitorsAndBounceRate(startDate, endDate)) || {};
    } catch (gaError) {
      console.warn("Could not fetch page data from GA:", gaError.message);
      // Continue without GA data
    }

    // Create a set of indexed URLs (normalized) from search analytics
    // Pages that appear in search analytics are definitely indexed
    const indexedUrlSet = new Set();
    const searchAnalyticsPagesMap = new Map(); // Store full page data by normalized URL
    
    response.data.rows?.forEach((row) => {
      const pageUrl = row.keys[0];
      const normalizedUrl = pageUrl
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
      indexedUrlSet.add(normalizedUrl);

      // Extract page path from full URL for matching with GA data
      const pagePath =
        pageUrl.replace(/^https?:\/\/(www\.)?[^\/]+/, "") || "/";
      const avgDuration = avgDurationMap[pagePath] || null;
      const pageData = pageVisitorsMap[pagePath] || {
        uniqueVisitors: 0,
        bounceRate: 0,
        sessions: 0,
      };

      searchAnalyticsPagesMap.set(normalizedUrl, {
        url: pageUrl,
        indexed: true, // If it appears in search analytics, it's indexed
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
        category: categorizePage(pageUrl),
        avgDuration: avgDuration,
        uniqueVisitors: pageData.uniqueVisitors || 0,
        bounceRate: pageData.bounceRate || 0,
        sessions: pageData.sessions || 0,
      });
    });

    // Process all sitemap URLs
    // Pages in sitemap that appear in search analytics = indexed
    // Pages in sitemap that don't appear in search analytics = not indexed (or not yet appearing in search)
    const allPagesMap = new Map();

    // First, add all pages from search analytics (these are definitely indexed)
    searchAnalyticsPagesMap.forEach((pageData, normalizedUrl) => {
      allPagesMap.set(normalizedUrl, pageData);
    });

    // Then, add pages from sitemap that aren't in search analytics
    sitemapUrls.forEach((url) => {
      const normalizedUrl = url
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
      
      // Only add if not already in the map (from search analytics)
      if (!allPagesMap.has(normalizedUrl)) {
        // Extract page path from full URL for matching with GA data
        const pagePath = url.replace(/^https?:\/\/(www\.)?[^\/]+/, "") || "/";
        const avgDuration = avgDurationMap[pagePath] || null;
        const pageData = pageVisitorsMap[pagePath] || {
          uniqueVisitors: 0,
          bounceRate: 0,
          sessions: 0,
        };

        allPagesMap.set(normalizedUrl, {
          url: url,
          indexed: false, // Not appearing in search analytics, so marked as not indexed
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          category: categorizePage(url),
          avgDuration: avgDuration,
          uniqueVisitors: pageData.uniqueVisitors || 0,
          bounceRate: pageData.bounceRate || 0,
          sessions: pageData.sessions || 0,
        });
      }
    });

    // Convert map to array
    const allPages = Array.from(allPagesMap.values());
    const indexedPages = allPages.filter(p => p.indexed);
    const notIndexedPages = allPages.filter(p => !p.indexed);

    // Calculate statistics
    const totalPages = allPages.length;
    const indexedCount = indexedPages.length;
    const notIndexedCount = notIndexedPages.length;
    const notIndexedPercent =
      totalPages > 0 ? (notIndexedCount / totalPages) * 100 : 0;

    return {
      pages: allPages,
      stats: {
        totalPages,
        indexedCount,
        notIndexedCount,
        notIndexedPercent: notIndexedPercent.toFixed(2),
        // Note: Pages marked as "indexed" have appeared in search results.
        // Pages marked as "not indexed" are in the sitemap but haven't appeared in search results.
        // Some "not indexed" pages may actually be indexed but just haven't appeared in search yet.
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
export const categorizePage = (url) => {
  if (!url) return "other";

  const lowerUrl = url.toLowerCase();

  // Clean path for analysis (remove leading/trailing slashes)
  const cleanPath = url
    .replace(/^https?:\/\/(www\.)?[^\/]+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  const pathSegments = cleanPath.split("/").filter((s) => s);
  const slashCount = pathSegments.length - 1; // Number of slashes (segments - 1)
  const isRootPage =
    !cleanPath ||
    cleanPath === "" ||
    url.endsWith("/") ||
    url.match(/^https?:\/\/(www\.)?[^\/]+\/?$/);

  // Determine type based on URL patterns (check in order of specificity)
  if (lowerUrl.includes("/ingredient-checker")) {
    return "ingredient-checker";
  } else if (
    lowerUrl.includes("/compare-bars") ||
    lowerUrl.includes("/browse")
  ) {
    return "tool";
  } else if (
    lowerUrl.includes("/partners") ||
    lowerUrl.includes("/contact") ||
    lowerUrl.includes("/help-center") ||
    lowerUrl.includes("/privacy-policy") ||
    lowerUrl.includes("/terms-of-service")
  ) {
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
    const endDateFormatted =
      endDate === "today"
        ? new Date().toISOString().split("T")[0]
        : formatDate(endDate);

    const startDateFormatted = formatDate(startDate);

    // First, get total clicks without dimensions to verify the total
    const totalResponse = await searchConsoleClient.searchanalytics.query({
      siteUrl: siteUrl,
      requestBody: {
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        rowLimit: 1,
      },
    });
    const totalClicksNoDimensions = totalResponse.data.rows?.[0]?.clicks || 0;
    console.log(`[getPageRankings] Total clicks (no dimensions): ${totalClicksNoDimensions}`);

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

    const rows = response.data.rows || [];
    const totalClicksFromAPI = rows.reduce((sum, row) => sum + (row.clicks || 0), 0);
    console.log(`[getPageRankings] Date: ${startDateFormatted} to ${endDateFormatted}, Rows returned: ${rows.length}, Total clicks from API (with dimensions): ${totalClicksFromAPI}, Total clicks (no dimensions): ${totalClicksNoDimensions}`);

    return (
      rows.map((row) => ({
        query: row.keys[0],
        page: row.keys[1],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }))
    );
  } catch (error) {
    console.error("Error fetching page rankings:", error);
    throw error;
  }
};

/**
 * Get links data from Search Console
 * Note: The Search Console API doesn't directly expose the Links report,
 * but we can try to get link data through other means or use GA4 referrer data
 * @param {number} limit - Number of results to return
 */
export const getLinksData = async (limit = 100) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    // Note: The Search Console API v1 doesn't have a direct "links" endpoint
    // The Links report in the UI is not available via API
    // We'll return a note about this limitation
    return {
      externalLinks: {
        topLinkedPages: [],
        topLinkingSites: [],
        topLinkingText: [],
        note: "External links data is not available through the Search Console API. The Links report in the UI is not exposed via API. Consider using GA4 referrer data or third-party tools (Ahrefs, Moz, SEMrush) for backlink analysis.",
      },
      internalLinks: {
        topLinkedPages: [],
        note: "Internal links data is not available through the Search Console API.",
      },
      apiAvailable: false,
    };
  } catch (error) {
    console.error("Error fetching links data:", error);
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
    const endDateFormatted =
      endDate === "today"
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

/**
 * Fetch page title from HTML
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Page title or URL as fallback
 */
const fetchPageTitle = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      },
    });
    const html = response.data;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
  } catch (error) {
    // Silently fail - we'll use URL as fallback
  }
  return url;
};

/**
 * Check if a single URL is indexed using Google Search Console URL Inspection API
 * @param {string} url - URL to check
 * @param {Object} supabaseClient - Supabase client instance (not used but kept for consistency)
 * @returns {Promise<Object>} Object with url, title, and google_index_status
 */
export const checkUrlIndexStatus = async (url, supabaseClient) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  try {
    // Use URL Inspection API
    // POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
    // The method in googleapis is urlInspection.index.inspect
    let response;
    try {
      response = await searchConsoleClient.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: siteUrl,
          languageCode: "en-US",
        },
      });
    } catch (apiError) {
      console.error(`URL Inspection API error for ${url}:`, apiError.message);
      console.error("API Error details:", apiError);
      throw apiError;
    }

    // Response structure per documentation:
    // { inspectionResult: { indexStatusResult: { indexingState, verdict, ... } } }
    const inspectionResult = response.data?.inspectionResult;
    const indexResult = inspectionResult?.indexStatusResult;

    // Determine index status from indexStatusResult
    // Per documentation: verdict = high-level verdict about whether URL IS indexed
    // indexingState = whether indexing is allowed or blocked
    let indexStatus = "not_indexed";

    if (indexResult) {
      // Primary check: verdict tells us if the URL IS indexed
      if (indexResult.verdict) {
        const verdict = indexResult.verdict;
        if (verdict === "PASS") {
          indexStatus = "indexed";
        } else if (verdict === "PARTIAL") {
          indexStatus = "discovered"; // Discovered but not fully indexed
        } else if (verdict === "FAIL" || verdict === "NEUTRAL") {
          indexStatus = "not_indexed";
        }
      }

      // Secondary check: indexingState tells us if indexing is allowed
      // If indexingState is BLOCKED, then it's definitely not_indexed
      if (indexResult.indexingState) {
        const indexingState = indexResult.indexingState;
        if (indexingState === "BLOCKED_BY_META_TAG" || 
            indexingState === "BLOCKED_BY_HTTP_HEADER" ||
            indexingState === "BLOCKED_BY_ROBOTS_TXT") {
          indexStatus = "not_indexed";
        }
        // INDEXING_ALLOWED means indexing is allowed, but doesn't guarantee it's indexed
        // We still rely on verdict to determine if it's actually indexed
      }

      // Log for debugging
      console.log(`[URL Inspection] ${url}: verdict=${indexResult.verdict || 'N/A'}, indexingState=${indexResult.indexingState || 'N/A'}, final=${indexStatus}`);
    } else {
      console.warn(`[URL Inspection] No indexStatusResult in response for ${url}. Response keys:`, Object.keys(response.data || {}));
    }

    // Fetch title from the page HTML
    const title = await fetchPageTitle(url);

    return {
      url,
      title: title || url, // Use URL as fallback title
      google_index_status: indexStatus,
    };
  } catch (error) {
    console.error(`Error checking URL ${url}:`, error.message);
    // Try to fetch title even on error
    const title = await fetchPageTitle(url);
    // Return not_indexed on error
    return {
      url,
      title: title || url,
      google_index_status: "not_indexed",
    };
  }
};

/**
 * Sync all sitemap URLs to Supabase with their index status
 * @param {Object} supabaseClient - Supabase client instance
 * @param {Function} progressCallback - Optional callback for progress updates
 * @returns {Promise<Object>} Sync results
 */
export const syncSitemapUrlsToSupabase = async (
  supabaseClient,
  progressCallback = null
) => {
  if (!searchConsoleClient) {
    throw new Error("Search Console client not initialized");
  }

  try {
    // Fetch all sitemap URLs
    const sitemapUrls = await fetchSitemap();
    console.log(`Found ${sitemapUrls.length} URLs in sitemap`);

    let processed = 0;
    let indexed = 0;
    let notIndexed = 0;
    let errors = 0;

    // Process URLs in batches to respect rate limits
    // Rate limit: 600 queries per minute = 10 per second
    // We'll process 5 per second to be safe
    const batchSize = 5;
    const delayBetweenBatches = 1000; // 1 second

    for (let i = 0; i < sitemapUrls.length; i += batchSize) {
      const batch = sitemapUrls.slice(i, i + batchSize);
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await checkUrlIndexStatus(url, supabaseClient);

          // Upsert to Supabase
          const { error: upsertError } = await supabaseClient
            .from("google_index_pages")
            .upsert(
              {
                url: result.url,
                title: result.title,
                google_index_status: result.google_index_status,
                created_at: new Date().toISOString(),
              },
              {
                onConflict: "url",
                ignoreDuplicates: false,
              }
            );

          if (upsertError) {
            console.error(`Error upserting ${url}:`, upsertError);
            errors++;
          } else {
            if (result.google_index_status === "indexed") {
              indexed++;
            } else {
              notIndexed++;
            }
            processed++;
          }

          return result;
        } catch (error) {
          console.error(`Error processing ${url}:`, error.message);
          errors++;
          return null;
        }
      });

      await Promise.all(batchPromises);

      // Report progress
      if (progressCallback) {
        progressCallback({
          processed,
          total: sitemapUrls.length,
          indexed,
          notIndexed,
          errors,
        });
      }

      // Delay between batches (except for the last batch)
      if (i + batchSize < sitemapUrls.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return {
      success: true,
      total: sitemapUrls.length,
      processed,
      indexed,
      notIndexed,
      errors,
    };
  } catch (error) {
    console.error("Error syncing sitemap URLs to Supabase:", error);
    throw error;
  }
};

export default {
  initializeSearchConsole,
  getSearchPerformance,
  getTopQueries,
  getTopPages,
  getTopCountries,
  getPageIndexStatus,
  getPageRankings,
  getLinksData,
  checkUrlIndexStatus,
  syncSitemapUrlsToSupabase,
};
