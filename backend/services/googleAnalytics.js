import { google } from "googleapis";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Google Analytics Data API
let analyticsDataClient = null;

/**
 * Initialize the Google Analytics API client
 * Requires a service account key file
 */
export const initializeAnalytics = () => {
  try {
    const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
    const GA_SERVICE_ACCOUNT_BASE64 = process.env.GA_SERVICE_ACCOUNT_BASE64;
    const GA_KEY_FILE = process.env.GA_KEY_FILE_PATH;

    if (!GA_PROPERTY_ID) {
      console.warn("⚠️  GA_PROPERTY_ID not set in environment variables");
      return null;
    }

    // Get credentials from either base64 env var (production) or file (local dev)
    let credentials;
    
    if (GA_SERVICE_ACCOUNT_BASE64) {
      // Production: decode base64 environment variable
      console.log("📦 Loading GA credentials from base64 environment variable");
      const decoded = Buffer.from(GA_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
      credentials = JSON.parse(decoded);
    } else if (GA_KEY_FILE) {
      // Local development: read from file
      console.log("📁 Loading GA credentials from file");
      const keyFilePath = join(__dirname, "..", GA_KEY_FILE);
      credentials = JSON.parse(readFileSync(keyFilePath, "utf8"));
    } else {
      console.warn("⚠️  Neither GA_SERVICE_ACCOUNT_BASE64 nor GA_KEY_FILE_PATH set in environment variables");
      return null;
    }

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    analyticsDataClient = google.analyticsdata({
      version: "v1beta",
      auth,
    });

    console.log("✅ Google Analytics API initialized successfully");
    return analyticsDataClient;
  } catch (error) {
    console.error("❌ Error initializing Google Analytics:", error.message);
    return null;
  }
};

/**
 * Get overview metrics for a date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getOverviewMetrics = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "conversions" },
        ],
      },
    });

    const row = response.data.rows?.[0];
    if (!row) {
      return null;
    }

    return {
      activeUsers: parseInt(row.metricValues[0].value),
      sessions: parseInt(row.metricValues[1].value),
      pageViews: parseInt(row.metricValues[2].value),
      avgSessionDuration: parseFloat(row.metricValues[3].value),
      bounceRate: parseFloat(row.metricValues[4].value) * 100,
      conversions: parseInt(row.metricValues[5].value),
    };
  } catch (error) {
    console.error("Error fetching overview metrics:", error);
    throw error;
  }
};

/**
 * Get page views by page path
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getTopPages = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 10
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [
          {
            metric: {
              metricName: "screenPageViews",
            },
            desc: true,
          },
        ],
        limit,
      },
    });

    return (
      response.data.rows?.map((row) => ({
        path: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        views: parseInt(row.metricValues[0].value),
        avgDuration: parseFloat(row.metricValues[1].value),
      })) || []
    );
  } catch (error) {
    console.error("Error fetching top pages:", error);
    throw error;
  }
};

/**
 * Get average session duration for all pages
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Object} Map of pagePath -> averageSessionDuration in seconds
 */
export const getPageAvgDurations = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "averageSessionDuration" }],
        limit: 10000, // Get as many pages as possible
      },
    });

    const durationMap = {};
    response.data.rows?.forEach((row) => {
      const pagePath = row.dimensionValues[0].value;
      const avgDuration = parseFloat(row.metricValues[0].value) || 0;
      durationMap[pagePath] = avgDuration;
    });

    return durationMap;
  } catch (error) {
    console.error("Error fetching page average durations:", error);
    throw error;
  }
};

/**
 * Get unique visitors and bounce rate per page
 * Fetches all-time data (uses a long date range to capture historical data)
 * @param {string} startDate - Start date in YYYY-MM-DD format (defaults to 2 years ago)
 * @param {string} endDate - End date in YYYY-MM-DD format (defaults to today)
 * @returns {Object} Map of pagePath -> { uniqueVisitors, bounceRate }
 */
export const getPageVisitorsAndBounceRate = async (
  startDate = null,
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  // If no startDate provided, use 2 years ago to capture most historical data
  const effectiveStartDate = startDate || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString().split("T")[0];
  })();

  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate: effectiveStartDate,
            endDate,
          },
        ],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "activeUsers" }, // Unique visitors
          { name: "bounceRate" },
          { name: "sessions" }, // Sessions for weighting
        ],
        limit: 10000, // Get as many pages as possible
      },
    });

    const pageDataMap = {};
    response.data.rows?.forEach((row) => {
      const pagePath = row.dimensionValues[0].value;
      const uniqueVisitors = parseInt(row.metricValues[0].value) || 0;
      const bounceRate = parseFloat(row.metricValues[1].value) || 0;
      const sessions = parseInt(row.metricValues[2].value) || 0;
      pageDataMap[pagePath] = {
        uniqueVisitors,
        bounceRate: bounceRate * 100, // Convert to percentage
        sessions,
      };
    });

    return pageDataMap;
  } catch (error) {
    console.error("Error fetching page visitors and bounce rate:", error);
    throw error;
  }
};

/**
 * Get traffic by source/medium with enhanced attribution
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getTrafficSources = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Get session-level (last-touch) attribution
    const sessionResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionDefaultChannelGroup" },
        ],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [
          {
            metric: {
              metricName: "sessions",
            },
            desc: true,
          },
        ],
        limit: 100,
      },
    });

    // Get first-touch attribution
    const firstTouchResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: "firstUserSource" },
          { name: "firstUserMedium" },
        ],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
        orderBys: [
          {
            metric: {
              metricName: "sessions",
            },
            desc: true,
          },
        ],
        limit: 100,
      },
    });

    // Get landing pages
    const landingPageResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "landingPage" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "newUsers" },
          { name: "bounceRate" },
        ],
        orderBys: [
          {
            metric: {
              metricName: "sessions",
            },
            desc: true,
          },
        ],
        limit: 50,
      },
    });

    const sessionSources =
      sessionResponse.data.rows?.map((row) => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        channelGroup: row.dimensionValues[2].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        attribution: "last-touch",
      })) || [];

    const firstTouchSources =
      firstTouchResponse.data.rows?.map((row) => ({
        source: row.dimensionValues[0].value,
        medium: row.dimensionValues[1].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        newUsers: parseInt(row.metricValues[2].value),
        attribution: "first-touch",
      })) || [];

    const landingPages =
      landingPageResponse.data.rows?.map((row) => ({
        landingPage: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value),
        users: parseInt(row.metricValues[1].value),
        newUsers: parseInt(row.metricValues[2].value),
        bounceRate: parseFloat(row.metricValues[3].value) * 100,
      })) || [];

    return {
      sessionSources,
      firstTouchSources,
      landingPages,
    };
  } catch (error) {
    console.error("Error fetching traffic sources:", error);
    throw error;
  }
};

/**
 * Map raw sessionSource from GA4 to canonical name (matches frontend getCanonicalSource).
 */
const getCanonicalSource = (raw) => {
  const s = (raw || "(not set)").trim();
  const k = s.toLowerCase();
  if (k === "(direct)" || k === "direct") return "Direct";
  if (k.includes("openai") || k.includes("chatgpt")) return "ChatGPT";
  if (k.includes("anthropic") || k.includes("claude")) return "Claude";
  if (k.includes("perplexity")) return "Perplexity";
  if (k.includes("google")) return "Google";
  if (k.includes("bing")) return "Bing";
  if (k.includes("yahoo")) return "Yahoo";
  if (k.includes("duckduckgo")) return "DuckDuckGo";
  if (k.includes("ecosia")) return "Ecosia";
  if (k.includes("copilot")) return "Microsoft Copilot";
  if (k.includes("facebook")) return "Facebook";
  if (k.includes("twitter") || k.includes("x.com")) return "X (Twitter)";
  if (k.includes("instagram")) return "Instagram";
  if (k.includes("linkedin")) return "LinkedIn";
  if (k.includes("pinterest")) return "Pinterest";
  return s || "(not set)";
};

/**
 * Get daily traffic by source for the last 7 days (for overview Sources chart).
 * Returns one row per day with merged canonical sources and percentages.
 * @param {string} startDate - e.g. 7daysAgo
 * @param {string} endDate - e.g. today
 */
export const getDailyTrafficBySource = async (
  startDate = "7daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }
  const propertyId = process.env.GA_PROPERTY_ID;
  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }, { name: "sessionSource" }],
        metrics: [{ name: "sessions" }],
        orderBys: [
          { dimension: { dimensionName: "date" }, desc: false },
          { metric: { metricName: "sessions" }, desc: true },
        ],
        limit: 500,
      },
    });

    const rows = response.data.rows || [];
    const byDate = {};
    rows.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const rawSource = row.dimensionValues[1].value;
      const sessions = parseInt(row.metricValues[0].value, 10);
      const source = getCanonicalSource(rawSource);
      if (!byDate[date]) byDate[date] = {};
      byDate[date][source] = (byDate[date][source] || 0) + sessions;
    });

    const daily = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sourceCounts]) => {
        const sources = Object.entries(sourceCounts).map(([source, sessions]) => ({ source, sessions }));
        const totalSessions = sources.reduce((sum, x) => sum + x.sessions, 0);
        return { date, sources, totalSessions };
      });

    return { daily };
  } catch (error) {
    console.error("Error fetching daily traffic by source:", error);
    throw error;
  }
};

/**
 * Get daily traffic broken down by a dimension (same shape as getDailyTrafficBySource).
 * @param {string} dimensionName - GA4 dimension name (e.g. "country", "landingPage", "hour")
 * @param {string} startDate - e.g. 30daysAgo
 * @param {string} endDate - e.g. today
 * @param {{ formatLabel?: (value: string) => string }} options - optional label formatter
 * @returns {{ daily: Array<{ date: string, sources: Array<{ source: string, sessions: number }>, totalSessions: number }> }}
 */
export const getDailyTrafficByDimension = async (
  dimensionName,
  startDate = "30daysAgo",
  endDate = "today",
  options = {}
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }
  const propertyId = process.env.GA_PROPERTY_ID;
  const formatLabel = options.formatLabel || ((v) => v);
  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }, { name: dimensionName }],
        metrics: [{ name: "sessions" }],
        orderBys: [
          { dimension: { dimensionName: "date" }, desc: false },
          { metric: { metricName: "sessions" }, desc: true },
        ],
        limit: 10000,
      },
    });

    const rows = response.data.rows || [];
    const byDate = {};
    rows.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const dimValue = row.dimensionValues[1].value ?? "(not set)";
      const sessions = parseInt(row.metricValues[0].value, 10);
      const label = formatLabel(dimValue);
      if (!byDate[date]) byDate[date] = {};
      byDate[date][label] = (byDate[date][label] || 0) + sessions;
    });

    const daily = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sourceCounts]) => {
        const sources = Object.entries(sourceCounts).map(([source, sessions]) => ({ source, sessions }));
        const totalSessions = sources.reduce((sum, x) => sum + x.sessions, 0);
        return { date, sources, totalSessions };
      });

    return { daily };
  } catch (error) {
    console.error(`Error fetching daily traffic by ${dimensionName}:`, error);
    throw error;
  }
};

/** Format hour dimension "0"-"23" to "12am", "1am", ... "11pm" */
const formatHourLabel = (hourStr) => {
  const h = parseInt(hourStr, 10);
  if (Number.isNaN(h) || h < 0 || h > 23) return hourStr;
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
};

/** Bucket engagement time into duration labels (GA4 may return seconds or milliseconds) */
const bucketDurationLabel = (value) => {
  let sec = parseInt(value, 10);
  if (Number.isNaN(sec)) return value;
  if (sec > 10000) sec = Math.round(sec / 1000);
  if (sec < 30) return "0–30s";
  if (sec < 120) return "30s–2m";
  if (sec < 300) return "2m–5m";
  return "5m+";
};

/**
 * Get daily traffic by country (geography). Uses same response shape as daily-traffic-by-source.
 */
export const getDailyTrafficByCountry = (startDate, endDate) =>
  getDailyTrafficByDimension("country", startDate, endDate);

/**
 * Get daily traffic by landing page (first page visited).
 */
export const getDailyTrafficByLandingPage = (startDate, endDate) =>
  getDailyTrafficByDimension("landingPage", startDate, endDate);

/**
 * Get daily traffic by hour of day (0-23 formatted as 12am, 1am, ...).
 */
export const getDailyTrafficByHour = (startDate, endDate) =>
  getDailyTrafficByDimension("hour", startDate, endDate, { formatLabel: formatHourLabel });

/**
 * Get daily traffic by session engagement duration bucket (0–30s, 30s–2m, 2m–5m, 5m+).
 * Uses sessionEngagementDuration dimension (seconds) and buckets in code if needed.
 */
export const getDailyTrafficByDuration = async (startDate = "30daysAgo", endDate = "today") => {
  try {
    const raw = await getDailyTrafficByDimension("sessionEngagementDuration", startDate, endDate, {
      formatLabel: bucketDurationLabel,
    });
    return raw;
  } catch (err) {
    console.warn("sessionEngagementDuration dimension not available, returning empty duration breakdown:", err.message);
    return { daily: [] };
  }
};

/**
 * Map sourceId (UI) to GA4 dimension filter for sessionSource.
 * Returns a FilterExpression for runReport dimensionFilter, or null if no filter.
 */
const getSourceDimensionFilter = (sourceId) => {
  if (sourceId === "chatgpt") {
    return {
      orGroup: {
        expressions: [
          { filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "chatgpt" } } },
          { filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "openai" } } },
        ],
      },
    };
  }
  if (sourceId === "claude") {
    return {
      orGroup: {
        expressions: [
          { filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "claude" } } },
          { filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "anthropic" } } },
        ],
      },
    };
  }
  if (sourceId === "perplexity") {
    return {
      filter: { fieldName: "sessionSource", stringFilter: { matchType: "CONTAINS", value: "perplexity" } },
    };
  }
  return null;
};

/**
 * Get traffic analysis for a specific source (e.g. chatgpt, claude, perplexity).
 * Returns aggregate metrics and top landing pages for that source.
 * @param {string} sourceId - e.g. "chatgpt", "claude", "perplexity"
 * @param {string} startDate - Start date (e.g. 30daysAgo)
 * @param {string} endDate - End date (e.g. today)
 */
export const getSourceAnalysis = async (
  sourceId,
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }
  const dimensionFilter = getSourceDimensionFilter(sourceId);
  if (!dimensionFilter) {
    return { summary: null, topLandingPages: [], sourceId };
  }

  const propertyId = process.env.GA_PROPERTY_ID;
  const baseRequest = {
    dateRanges: [{ startDate, endDate }],
    dimensionFilter,
  };

  try {
    const [summaryResponse, pagesResponse] = await Promise.all([
      analyticsDataClient.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          ...baseRequest,
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
            { name: "engagedSessions" },
          ],
        },
      }),
      analyticsDataClient.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          ...baseRequest,
          dimensions: [{ name: "landingPage" }],
          metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "averageSessionDuration" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 20,
        },
      }),
    ]);

    const summaryRow = summaryResponse.data.rows?.[0];
    const summary = summaryRow
      ? {
          sessions: parseInt(summaryRow.metricValues[0].value, 10),
          activeUsers: parseInt(summaryRow.metricValues[1].value, 10),
          screenPageViews: parseInt(summaryRow.metricValues[2].value, 10),
          averageSessionDuration: parseFloat(summaryRow.metricValues[3].value, 10),
          bounceRate: parseFloat(summaryRow.metricValues[4].value, 10) * 100,
          engagedSessions: parseInt(summaryRow.metricValues[5].value, 10),
        }
      : { sessions: 0, activeUsers: 0, screenPageViews: 0, averageSessionDuration: 0, bounceRate: 0, engagedSessions: 0 };

    const topLandingPages =
      pagesResponse.data.rows?.map((row) => ({
        landingPage: row.dimensionValues[0].value,
        sessions: parseInt(row.metricValues[0].value, 10),
        screenPageViews: parseInt(row.metricValues[1].value, 10),
        averageSessionDuration: parseFloat(row.metricValues[2].value, 10),
      })) || [];

    return { summary, topLandingPages, sourceId };
  } catch (error) {
    console.error("Error fetching source analysis:", error);
    throw error;
  }
};

/**
 * Get daily trend data
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getDailyTrend = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
            desc: false,
          },
        ],
      },
    });

    return (
      response.data.rows?.map((row) => ({
        date: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
        pageViews: parseInt(row.metricValues[2].value),
      })) || []
    );
  } catch (error) {
    console.error("Error fetching daily trend:", error);
    throw error;
  }
};

/**
 * Get the analytics client (for use by other services)
 */
export const getAnalyticsClient = () => {
  return analyticsDataClient;
};

export default {
  initializeAnalytics,
  getOverviewMetrics,
  getTopPages,
  getTrafficSources,
  getSourceAnalysis,
  getDailyTrafficBySource,
  getDailyTrend,
  getAnalyticsClient,
};

