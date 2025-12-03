import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { MongoClient } from "mongodb";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import axios from "axios";
import {
  initializeAnalytics,
  getOverviewMetrics,
  getTopPages,
  getTrafficSources,
  getDailyTrend,
} from "./services/googleAnalytics.js";
import {
  getVisitorsList,
  getVisitorDetails,
  getDailyVisitorTrends,
  getVisitorsByPage,
  getPowerUsers,
} from "./services/visitorAnalytics.js";
import {
  initializeSearchConsole,
  getSearchPerformance,
  getTopQueries,
  getTopPages as getSearchTopPages,
  getTopCountries,
  getPageIndexStatus,
  getPageRankings,
  syncSitemapUrlsToSupabase,
  categorizePage,
} from "./services/googleSearchConsole.js";
import {
  getEngagementMetrics,
  getEngagementByPage,
} from "./services/engagementMetrics.js";
import {
  getConversionMetrics,
  getConversionBySource,
} from "./services/conversionMetrics.js";
import { getContentInsights } from "./services/contentInsights.js";
import {
  getTechnicalPerformance,
  getCoreWebVitals,
} from "./services/technicalPerformance.js";
import { getSEOMetrics } from "./services/seoMetrics.js";
import { getAudienceProfile } from "./services/audienceProfile.js";
import { getSessionMetrics } from "./services/sessionMetrics.js";

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, ".env") });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration. Please check your .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize MongoDB client
const mongoUri = process.env.MONGODB_URI;
let mongoClient;
let db;

if (mongoUri) {
  mongoClient = new MongoClient(mongoUri);

  // Connect to MongoDB
  mongoClient
    .connect()
    .then(() => {
      console.log("✅ Connected to MongoDB");
      db = mongoClient.db("Boxes");
    })
    .catch((error) => {
      console.error("❌ MongoDB connection error:", error);
    });
} else {
  console.warn("⚠️  MongoDB URI not configured");
}

// Initialize Google Analytics
initializeAnalytics();

// Initialize Google Search Console
initializeSearchConsole();

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  // Don't exit the process, just log the error
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Trust proxy for accurate IP addresses (important for Railway)
app.set("trust proxy", true);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Root endpoint - API information
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Admin Dashboard API Server",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      analytics: "/api/analytics/*",
      visitors: "/api/visitors/*",
      searchConsole: "/api/search-console/*",
      users: "/api/users/*",
      customers: "/api/customers/*",
    },
    timestamp: new Date().toISOString(),
  });
});

// Favicon handler (return 204 No Content to avoid 404)
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Admin Dashboard API is running",
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting for login attempts (in-memory store - use Redis in production)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > LOCKOUT_DURATION * 2) {
      loginAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Simple 4-digit code authentication endpoint with rate limiting
app.post("/api/auth/login", async (req, res) => {
  try {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    
    // Check rate limiting
    const attemptData = loginAttempts.get(clientIp) || {
      attempts: 0,
      lockedUntil: 0,
      requests: [],
      lastAttempt: 0,
    };
    
    // Check if account is locked
    if (attemptData.lockedUntil > now) {
      const remainingMinutes = Math.ceil((attemptData.lockedUntil - now) / 60000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Account locked for ${remainingMinutes} minute(s).`,
        lockedUntil: attemptData.lockedUntil,
      });
    }
    
    // Check request rate limit
    attemptData.requests = attemptData.requests.filter(
      (time) => now - time < RATE_LIMIT_WINDOW
    );
    
    if (attemptData.requests.length >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again in a minute.",
      });
    }
    
    attemptData.requests.push(now);
    
    const { code } = req.body;
    
    // Get the admin code from environment variable
    const ADMIN_CODE = process.env.ADMIN_CODE || "9521";
    
    if (!code || code.length !== 4 || !/^\d+$/.test(code)) {
      attemptData.lastAttempt = now;
      loginAttempts.set(clientIp, attemptData);
      return res.status(400).json({
        success: false,
        error: "Invalid code format. Please enter a 4-digit code.",
      });
    }
    
    if (code !== ADMIN_CODE) {
      attemptData.attempts += 1;
      attemptData.lastAttempt = now;
      
      // Lock account after max attempts
      if (attemptData.attempts >= MAX_ATTEMPTS) {
        attemptData.lockedUntil = now + LOCKOUT_DURATION;
        loginAttempts.set(clientIp, attemptData);
        return res.status(401).json({
          success: false,
          error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`,
          lockedUntil: attemptData.lockedUntil,
        });
      }
      
      loginAttempts.set(clientIp, attemptData);
      return res.status(401).json({
        success: false,
        error: `Invalid code. ${MAX_ATTEMPTS - attemptData.attempts} attempt(s) remaining.`,
        attemptsRemaining: MAX_ATTEMPTS - attemptData.attempts,
      });
    }
    
    // Successful login - reset attempts and generate secure token
    loginAttempts.delete(clientIp);
    
    // Generate a more secure token with expiration (24 hours)
    const crypto = await import("crypto");
    const tokenData = {
      code: code,
      timestamp: now,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
      random: crypto.randomBytes(16).toString("hex"),
    };
    
    const sessionToken = Buffer.from(JSON.stringify(tokenData)).toString("base64");
    
    res.json({
      success: true,
      message: "Login successful",
      token: sessionToken,
      expiresAt: tokenData.expiresAt,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during login",
    });
  }
});

// Verify session token
app.get("/api/auth/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({
        success: false,
        authenticated: false,
      });
    }
    
    try {
      // Decode and validate token
      const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
      const now = Date.now();
      
      // Check if token is expired
      if (decoded.expiresAt && decoded.expiresAt < now) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error: "Token expired",
        });
      }
      
      // Verify token structure
      if (!decoded.timestamp || !decoded.random) {
        return res.status(401).json({
          success: false,
          authenticated: false,
          error: "Invalid token format",
        });
      }
      
      res.json({
        success: true,
        authenticated: true,
        expiresAt: decoded.expiresAt,
      });
    } catch (decodeError) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: "Invalid token",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      authenticated: false,
    });
  }
});

// ==================== Google Analytics Endpoints ====================

// Get engagement metrics
app.get("/api/analytics/engagement", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const metrics = await getEngagementMetrics(startDate, endDate);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error("Error fetching engagement metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get engagement metrics by page
app.get("/api/analytics/engagement/by-page", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 20,
    } = req.query;
    const data = await getEngagementByPage(startDate, endDate, parseInt(limit));
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching engagement by page:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get analytics overview metrics
app.get("/api/analytics/overview", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const metrics = await getOverviewMetrics(startDate, endDate);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get top pages
app.get("/api/analytics/top-pages", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 10,
    } = req.query;
    const pages = await getTopPages(startDate, endDate, parseInt(limit));

    res.json({
      success: true,
      data: pages,
    });
  } catch (error) {
    console.error("Error fetching top pages:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get traffic sources
app.get("/api/analytics/traffic-sources", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const sources = await getTrafficSources(startDate, endDate);

    res.json({
      success: true,
      data: sources,
    });
  } catch (error) {
    console.error("Error fetching traffic sources:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get daily trend data
app.get("/api/analytics/daily-trend", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const trend = await getDailyTrend(startDate, endDate);

    res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error("Error fetching daily trend:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get conversion metrics
app.get("/api/analytics/conversion", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const metrics = await getConversionMetrics(startDate, endDate);
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error("Error fetching conversion metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get conversion metrics by source
app.get("/api/analytics/conversion/by-source", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getConversionBySource(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching conversion by source:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get content insights
app.get("/api/analytics/content", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getContentInsights(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching content insights:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get technical performance metrics
app.get("/api/analytics/technical", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getTechnicalPerformance(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching technical performance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get Core Web Vitals
app.get("/api/analytics/core-web-vitals", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getCoreWebVitals(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching Core Web Vitals:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get SEO metrics
app.get("/api/analytics/seo", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getSEOMetrics(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching SEO metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get audience profile
app.get("/api/analytics/audience", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getAudienceProfile(startDate, endDate);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching audience profile:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get session metrics
app.get("/api/analytics/sessions", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const data = await getSessionMetrics(startDate, endDate);
    
    // Also get today's metrics for the Today card
    let todayMetrics = null;
    try {
      todayMetrics = await getSessionMetrics("today", "today");
    } catch (error) {
      console.warn("Error fetching today's metrics:", error.message);
    }
    
    res.json({ 
      success: true, 
      data: {
        ...data,
        today: todayMetrics,
      }
    });
  } catch (error) {
    console.error("Error fetching session metrics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Google Search Console Endpoints ====================

// Get search performance overview
app.get("/api/search-console/performance", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const performance = await getSearchPerformance(startDate, endDate);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error("Error fetching search performance:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get top search queries
app.get("/api/search-console/top-queries", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 10,
    } = req.query;
    const queries = await getTopQueries(startDate, endDate, parseInt(limit));

    res.json({
      success: true,
      data: queries,
    });
  } catch (error) {
    console.error("Error fetching top queries:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get top pages from search
app.get("/api/search-console/top-pages", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 10,
    } = req.query;
    const pages = await getSearchTopPages(startDate, endDate, parseInt(limit));

    res.json({
      success: true,
      data: pages,
    });
  } catch (error) {
    console.error("Error fetching search top pages:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get top countries from search
app.get("/api/search-console/top-countries", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 10,
    } = req.query;
    const countries = await getTopCountries(startDate, endDate, parseInt(limit));

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    console.error("Error fetching top countries:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get page index status from Supabase
app.get("/api/search-console/page-index", async (req, res) => {
  try {
    // Fetch ALL pages from Supabase (no limit - get everything)
    // Supabase has a default limit of 1000, so we need to fetch in batches if needed
    let allPages = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data: pagesBatch, error: fetchError } = await supabase
        .from("google_index_pages")
        .select("id, title, url, google_index_status, created_at")
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (pagesBatch && pagesBatch.length > 0) {
        allPages = allPages.concat(pagesBatch);
        hasMore = pagesBatch.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    const pages = allPages;
    console.log(`[Page Index Backend] Fetched ${pages.length} total pages from Supabase (in ${page} batches)`);
    
    if (!pages || pages.length === 0) {
      return res.json({
        success: true,
        data: {
          pages: [],
          stats: {
            totalPages: 0,
            indexedCount: 0,
            notIndexedCount: 0,
            notIndexedPercent: "0.00",
          },
        },
      });
    }

    // Query Supabase directly for accurate counts from the entire table
    const { count: indexedCountResult, error: indexedCountError } =
      await supabase
        .from("google_index_pages")
        .select("*", { count: "exact", head: true })
        .eq("google_index_status", "indexed");

    const { count: notIndexedCountResult, error: notIndexedCountError } =
      await supabase
        .from("google_index_pages")
        .select("*", { count: "exact", head: true })
        .eq("google_index_status", "not_indexed");

    if (indexedCountError) {
      console.warn("Error counting indexed pages:", indexedCountError);
    }
    if (notIndexedCountError) {
      console.warn("Error counting not indexed pages:", notIndexedCountError);
    }

    // Use direct database counts
    const indexedCount = indexedCountResult || 0;
    const notIndexedCount = notIndexedCountResult || 0;
    const totalPages = pages.length;

    // Fetch analytics data from GA and Search Console to augment each page
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // 2 years ago

    let avgDurationMap = {};
    let pageVisitorsMap = {};
    let searchAnalyticsMap = {};

    try {
      // Fetch GA data
      const { getPageAvgDurations, getPageVisitorsAndBounceRate } =
        await import("./services/googleAnalytics.js");
      avgDurationMap = (await getPageAvgDurations(startDate, endDate)) || {};
      pageVisitorsMap =
        (await getPageVisitorsAndBounceRate(startDate, endDate)) || {};
      console.log(`[Page Index] Fetched GA data for ${Object.keys(pageVisitorsMap).length} pages`);
    } catch (gaError) {
      console.warn("Could not fetch GA data:", gaError.message);
    }

    try {
      // Fetch Search Console data
      const { getPageIndexStatus } = await import(
        "./services/googleSearchConsole.js"
      );
      const searchData = await getPageIndexStatus(25000);
      // Create a map of URL -> search analytics data
      searchData.pages?.forEach((page) => {
        const normalizedUrl = page.url
          .replace(/^https?:\/\/(www\.)?/, "")
          .replace(/\/$/, "");
        searchAnalyticsMap[normalizedUrl] = {
          clicks: page.clicks || 0,
          impressions: page.impressions || 0,
          ctr: page.ctr || 0,
          position: page.position || 0,
        };
      });
      console.log(`[Page Index] Fetched Search Console data for ${Object.keys(searchAnalyticsMap).length} pages`);
    } catch (scError) {
      console.warn("Could not fetch Search Console data:", scError.message);
    }

    // Merge pages from Supabase with analytics data
    const pagesWithAnalytics = pages.map((page) => {
      // Categorize page
      const category = categorizePage(page.url);

      // Determine indexed status
      const isIndexed = page.google_index_status === "indexed";

      // Extract page path from full URL for matching with GA data
      // GA uses paths like "/highest-carb" not full URLs
      const pagePath = page.url.replace(/^https?:\/\/(www\.)?[^\/]+/, "") || "/";

      // Get GA data by page path
      const avgDuration = avgDurationMap[pagePath] || null;
      const pageData = pageVisitorsMap[pagePath] || {
        uniqueVisitors: 0,
        bounceRate: 0,
        sessions: 0,
      };

      // Get Search Console data by normalized URL
      // Search Console URLs need to be normalized (remove protocol, www, trailing slash)
      const normalizedUrl = page.url
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
      const searchData = searchAnalyticsMap[normalizedUrl] || {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
      };

      return {
        url: page.url,
        indexed: isIndexed,
        google_index_status: page.google_index_status,
        category: category,
        // Analytics data from Search Console
        clicks: searchData.clicks,
        impressions: searchData.impressions,
        ctr: searchData.ctr,
        position: searchData.position,
        // Analytics data from GA
        avgDuration: avgDuration,
        uniqueVisitors: pageData.uniqueVisitors || 0,
        bounceRate: pageData.bounceRate || 0,
        sessions: pageData.sessions || 0,
      };
    });

    // Calculate comprehensive stats from merged data
    const totalUniqueVisitors = pagesWithAnalytics.reduce(
      (sum, p) => sum + (p.uniqueVisitors || 0),
      0
    );

    // Calculate weighted average bounce rate
    const pagesWithSessions = pagesWithAnalytics.filter(
      (p) => p.sessions > 0 && p.uniqueVisitors >= 1
    );
    const totalSessions = pagesWithSessions.reduce(
      (sum, p) => sum + (p.sessions || 0),
      0
    );
    const weightedBounceRate =
      totalSessions > 0
        ? pagesWithSessions.reduce(
            (sum, p) => sum + ((p.bounceRate || 0) / 100) * (p.sessions || 0),
            0
          ) / totalSessions
        : 0;
    const engagementRate = ((1 - weightedBounceRate) * 100).toFixed(1);

    // Calculate average duration (weighted by sessions or page views)
    const pagesWithDuration = pagesWithAnalytics.filter(
      (p) => p.avgDuration && p.avgDuration > 0
    );
    const totalDurationWeight = pagesWithDuration.reduce(
      (sum, p) => sum + (p.sessions || p.uniqueVisitors || 1),
      0
    );
    const avgDuration =
      totalDurationWeight > 0
        ? pagesWithDuration.reduce(
            (sum, p) =>
              sum +
              (p.avgDuration || 0) * (p.sessions || p.uniqueVisitors || 1),
            0
          ) / totalDurationWeight
        : 0;

    res.json({
      success: true,
      data: {
        pages: pagesWithAnalytics,
        stats: {
          totalPages,
          indexedCount,
          notIndexedCount,
          notIndexedPercent:
            totalPages > 0
              ? ((notIndexedCount / totalPages) * 100).toFixed(2)
              : "0.00",
          totalUniqueVisitors,
          engagementRate,
          avgDuration,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching page index status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


// Sync sitemap URLs to Supabase (trigger manual sync)
app.post("/api/search-console/sync-index-status", async (req, res) => {
  try {
    // Start sync in background (don't wait for completion)
    syncSitemapUrlsToSupabase(supabase, (progress) => {
      console.log(
        `Sync progress: ${progress.processed}/${progress.total} (${progress.indexed} indexed, ${progress.notIndexed} not indexed, ${progress.errors} errors)`
      );
    })
      .then((result) => {
        console.log("Sync completed:", result);
      })
      .catch((error) => {
        console.error("Sync error:", error);
      });

    res.json({
      success: true,
      message: "Sync started in background. This may take a while.",
    });
  } catch (error) {
    console.error("Error starting sync:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get page rankings (queries we're showing up for)
app.get("/api/search-console/page-rankings", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 1000,
    } = req.query;
    const rankings = await getPageRankings(startDate, endDate, parseInt(limit));

    // Log for debugging
    const totalClicks = rankings.reduce((sum, r) => sum + (r.clicks || 0), 0);
    const rowsWithClicks = rankings.filter(r => (r.clicks || 0) > 0).length;
    console.log(`[Page Rankings] Date range: ${startDate} to ${endDate}, Total rows: ${rankings.length}, Rows with clicks: ${rowsWithClicks}, Total clicks: ${totalClicks}`);

    res.json({
      success: true,
      data: rankings,
    });
  } catch (error) {
    console.error("Error fetching page rankings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== Visitors Endpoints ====================

// Get list of visitors
app.get("/api/visitors", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 100,
    } = req.query;
    const visitors = await getVisitorsList(
      startDate,
      endDate,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: visitors,
    });
  } catch (error) {
    console.error("Error fetching visitors:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get daily visitor trends with new vs returning breakdown
app.get("/api/visitors/daily-trends", async (req, res) => {
  try {
    const { startDate = "30daysAgo", endDate = "today" } = req.query;
    const trends = await getDailyVisitorTrends(startDate, endDate);

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error("Error fetching daily visitor trends:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get visitors for a specific page
app.get("/api/visitors/by-page/:pagePath", async (req, res) => {
  try {
    const { pagePath } = req.params;
    const decodedPagePath = decodeURIComponent(pagePath);
    const {
      startDate = "30daysAgo",
      endDate = "today",
      limit = 100,
    } = req.query;
    
    const visitors = await getVisitorsByPage(
      decodedPagePath,
      startDate,
      endDate,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: visitors,
    });
  } catch (error) {
    console.error("Error fetching visitors by page:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get detailed information about a specific visitor
// Get power users (users with more than 3 sessions)
app.get("/api/visitors/power-users", async (req, res) => {
  try {
    const {
      startDate = "30daysAgo",
      endDate = "today",
      minSessions = 3,
    } = req.query;
    const powerUsers = await getPowerUsers(
      startDate,
      endDate,
      parseInt(minSessions)
    );

    res.json({
      success: true,
      data: powerUsers,
    });
  } catch (error) {
    console.error("Error fetching power users:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/visitors/:visitorId", async (req, res) => {
  try {
    const { visitorId } = req.params;
    const {
      startDate = "30daysAgo",
      endDate = "today",
    } = req.query;
    
    const details = await getVisitorDetails(
      visitorId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error("Error fetching visitor details:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== User Management Endpoints ====================

// Example: Get all users (modify based on your Supabase schema)
app.get("/api/users", async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("*");

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Example: Get user by ID
app.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Example: Create user
app.post("/api/users", async (req, res) => {
  try {
    const userData = req.body;
    const { data, error } = await supabase
      .from("users")
      .insert([userData])
      .select();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Example: Update user
app.put("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userData = req.body;
    const { data, error } = await supabase
      .from("users")
      .update(userData)
      .eq("id", id)
      .select();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Example: Delete user
app.delete("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// MongoDB: Get active customers (Orders)
app.get("/api/customers", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const customersCollection = db.collection("customers");
    const customers = await customersCollection
      .find({
        stripe_status: { $in: ["active", "trialing", "past_due"] },
      })
      .toArray();

    // Format data with concatenated name and address
    const formattedCustomers = customers.map((customer) => {
      // Concatenate firstName + lastName
      const fullName =
        [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
        "N/A";

      // Concatenate shipping address
      let fullAddress = "N/A";
      if (
        customer.shipping_address &&
        typeof customer.shipping_address === "object"
      ) {
        const { street, aptSuite, city, state, zip } =
          customer.shipping_address;

        const addressParts = [street, aptSuite, city, state, zip].filter(
          (part) => part && part.trim() !== ""
        );

        if (addressParts.length > 0) {
          fullAddress = addressParts.join(", ");
        }
      }

      return {
        ...customer,
        fullName,
        fullAddress,
      };
    });

    res.json({ success: true, data: formattedCustomers });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// MongoDB: Update Packed status for a draftbox
app.patch(
  "/api/customers/:customerId/draftbox/:month/packed",
  async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: "Database not connected",
        });
      }

      const { customerId, month } = req.params;
      const { packed } = req.body;

      if (typeof packed !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Packed field must be a boolean",
        });
      }

      const monthInt = parseInt(month);
      const draftboxesCollection = db.collection("draftboxes");

      const result = await draftboxesCollection.updateOne(
        { customerID: customerId, month: monthInt },
        { $set: { Packed: packed } }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: "Draftbox not found for this customer and month",
        });
      }

      console.log(
        `✅ Updated Packed status for ${customerId} month ${monthInt}: ${packed}`
      );

      res.json({
        success: true,
        message: "Packed status updated successfully",
        data: { customerID: customerId, month: monthInt, Packed: packed },
      });
    } catch (error) {
      console.error("Error updating packed status:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// MongoDB: Get draftbox for a customer by month
app.get("/api/customers/:customerId/draftbox", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const { customerId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: "Month and year are required query parameters",
      });
    }

    const draftboxesCollection = db.collection("draftboxes");

    // Generate month as integer in MYY format (e.g., 1125 for November 2025)
    const yearShort = parseInt(year.toString().slice(-2));
    const monthInt = parseInt(`${month}${yearShort}`);

    console.log(
      `🔍 Fetching draftbox for customerID: ${customerId}, month: ${monthInt}`
    );

    // Find the draftbox for this customer and specific month
    const draftbox = await draftboxesCollection.findOne({
      customerID: customerId,
      month: monthInt,
    });

    if (!draftbox) {
      return res.status(404).json({
        success: false,
        error: "No draftbox found for this customer and month",
      });
    }

    // Enrich snacks with productLine and primaryCategory from snacks collection
    if (draftbox.snacks && Array.isArray(draftbox.snacks)) {
      const snacksCollection = db.collection("snacks");

      // Get all unique SnackIDs
      const snackIDs = draftbox.snacks.map((s) => s.SnackID).filter(Boolean);

      if (snackIDs.length > 0) {
        // Fetch all snack info in one query
        const snackInfoList = await snacksCollection
          .find({ SnackID: { $in: snackIDs } })
          .project({ SnackID: 1, productLine: 1, primaryCategory: 1, _id: 0 })
          .toArray();

        // Create a map for quick lookup
        const snackInfoMap = {};
        snackInfoList.forEach((snack) => {
          snackInfoMap[snack.SnackID] = snack;
        });

        // Enrich each snack in the draftbox
        draftbox.snacks = draftbox.snacks.map((snack) => {
          const snackInfo = snackInfoMap[snack.SnackID];
          if (snackInfo) {
            return {
              ...snack,
              productLine: snack.productLine || snackInfo.productLine,
              primaryCategory:
                snack.primaryCategory || snackInfo.primaryCategory,
            };
          }
          return snack;
        });
      }
    }

    res.json({ success: true, data: draftbox });
  } catch (error) {
    console.error("Error fetching draftbox:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// MongoDB: Create a new draftbox for a customer
app.post("/api/customers/:customerId/create-box", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const { customerId } = req.params;
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: "Month and year are required",
      });
    }

    const customersCollection = db.collection("customers");
    const draftboxesCollection = db.collection("draftboxes");

    // Generate month as integer in MYY format (e.g., 1125 for November 2025)
    const yearShort = parseInt(year.toString().slice(-2));
    const monthInt = parseInt(`${month}${yearShort}`);

    console.log(
      `📦 Creating box for customerID: ${customerId}, month: ${monthInt}`
    );

    // Step 1: Get customer data (need repeatMonthly field)
    const customer = await customersCollection.findOne(
      { customerID: customerId },
      { projection: { customerID: 1, firstName: 1, repeatMonthly: 1, _id: 0 } }
    );

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    console.log(
      `  Customer: ${customer.firstName}, repeatMonthly:`,
      customer.repeatMonthly
    );

    // Step 2: Check if draftbox already exists for this month
    const existingDraftbox = await draftboxesCollection.findOne({
      customerID: customerId,
      month: monthInt,
    });

    if (existingDraftbox) {
      return res.status(409).json({
        success: false,
        error: "Draftbox already exists for this customer and month",
      });
    }

    // Step 3: Prepare payload for external API
    const payload = {
      customerID: customerId,
      new_signup: false,
      repeat_customer: true,
      off_cycle: false,
      is_reset_box: false,
      reset_total: 0,
      repeat_monthly: customer.repeatMonthly || [],
    };

    console.log(`  Payload prepared:`, payload);

    // Step 4: Call external API to generate the box
    const externalApiUrl =
      "https://cleanbox-script-generate-startin-production.up.railway.app/api/v1/build-starting-box";

    console.log(`  🚀 Calling external API: ${externalApiUrl}`);

    try {
      const apiResponse = await axios.post(externalApiUrl, payload, {
        timeout: 30000, // 30 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log(`  ✅ External API Response:`, apiResponse.data);

      res.json({
        success: true,
        message: "Box created successfully",
        data: apiResponse.data,
        monthInt: monthInt,
      });
    } catch (apiError) {
      console.error(`  ❌ External API Error:`, apiError.message);

      // Return detailed error information
      return res.status(500).json({
        success: false,
        error: "Failed to create box via external API",
        details: apiError.response?.data || apiError.message,
        statusCode: apiError.response?.status,
      });
    }
  } catch (error) {
    console.error("Error creating box:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// MongoDB: Check which customers have draftboxes for a specific month
app.post("/api/customers/check-month", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const { month, year, customerIDs } = req.body;

    if (!month || !year || !customerIDs || !Array.isArray(customerIDs)) {
      return res.status(400).json({
        success: false,
        error: "month, year, and customerIDs array are required",
      });
    }

    const draftboxesCollection = db.collection("draftboxes");

    // Generate month as integer in MMYY or MYY format
    const yearShort = parseInt(year.toString().slice(-2)); // Get last 2 digits of year
    const monthInt = parseInt(`${month}${yearShort}`); // e.g., 725 or 1125 (as integer)

    console.log("🔍 Checking month boxes:");
    console.log("  Month:", month, "Year:", year);
    console.log(
      "  Month integer to search:",
      monthInt,
      "(type:",
      typeof monthInt,
      ")"
    );
    console.log("  Number of customerIDs:", customerIDs.length);
    console.log("  Sample customerIDs:", customerIDs.slice(0, 3));

    // Find all draftboxes for these customers in the specified month
    // month field is stored as int32 in MongoDB
    const draftboxes = await draftboxesCollection
      .find({
        customerID: { $in: customerIDs },
        month: monthInt,
      })
      .project({ customerID: 1, popped: 1, month: 1, snacks: 1, Packed: 1 })
      .toArray();

    console.log("  Found draftboxes:", draftboxes.length);
    if (draftboxes.length > 0) {
      console.log("  Sample draftbox:", {
        customerID: draftboxes[0].customerID,
        month: draftboxes[0].month,
        popped: draftboxes[0].popped,
        Packed: draftboxes[0].Packed,
      });
    }

    // Create sets for different categories and calculate box sizes
    const customerIDsWithBoxes = new Set(draftboxes.map((d) => d.customerID));
    const customerIDsWithPopped = new Set(
      draftboxes.filter((d) => d.popped === true).map((d) => d.customerID)
    );
    const customerIDsWithPacked = new Set(
      draftboxes.filter((d) => d.Packed === true).map((d) => d.customerID)
    );

    // Calculate box sizes (total snack count for each customer)
    const boxSizes = {};
    draftboxes.forEach((draftbox) => {
      if (draftbox.snacks && Array.isArray(draftbox.snacks)) {
        const totalSnacks = draftbox.snacks.reduce((sum, snack) => {
          return sum + (snack.count || 0);
        }, 0);
        boxSizes[draftbox.customerID] = totalSnacks;
      }
    });

    res.json({
      success: true,
      data: {
        withBoxes: Array.from(customerIDsWithBoxes),
        withPopped: Array.from(customerIDsWithPopped),
        withPacked: Array.from(customerIDsWithPacked),
        boxSizes: boxSizes, // Add box sizes to response
      },
    });
  } catch (error) {
    console.error("Error checking month draftboxes:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// MongoDB: Get customer's snack history (all snacks from all their draftboxes)
app.get("/api/customers/:customerId/snack-history", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const { customerId } = req.params;
    const draftboxesCollection = db.collection("draftboxes");

    console.log(`📜 Fetching snack history for customerID: ${customerId}`);

    // Get all draftboxes for this customer
    const draftboxes = await draftboxesCollection
      .find({ customerID: customerId })
      .toArray();

    console.log(`  Found ${draftboxes.length} draftboxes for customer`);

    // Extract and deduplicate all snacks
    const allSnacks = [];
    const seenSnackIDs = new Set();

    draftboxes.forEach((box) => {
      if (box.snacks && Array.isArray(box.snacks)) {
        box.snacks.forEach((snack) => {
          if (snack.SnackID && !seenSnackIDs.has(snack.SnackID)) {
            seenSnackIDs.add(snack.SnackID);
            allSnacks.push(snack);
          }
        });
      }
    });

    console.log(
      `  Total unique snacks customer has tried: ${allSnacks.length}`
    );

    res.json({
      success: true,
      data: {
        snacks: allSnacks,
        snackIDs: Array.from(seenSnackIDs),
      },
    });
  } catch (error) {
    console.error("Error fetching snack history:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get available snacks for replacement (filtered by customer history and category)
app.post("/api/customers/:customerId/available-snacks", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        error: "Database not connected",
      });
    }

    const { customerId } = req.params;
    const { currentSnackID } = req.body;

    console.log(
      `🔄 Getting available snacks for replacement. Customer: ${customerId}, Current snack: ${currentSnackID}`
    );

    // Get customer's snack history
    const draftboxesCollection = db.collection("draftboxes");
    const draftboxes = await draftboxesCollection
      .find({ customerID: customerId })
      .toArray();

    const triedSnackIDs = new Set();
    const triedSnacksWithMonth = []; // Track snacks with their months

    draftboxes.forEach((box) => {
      if (box.snacks && Array.isArray(box.snacks)) {
        box.snacks.forEach((snack) => {
          if (snack.SnackID) {
            triedSnackIDs.add(snack.SnackID);
            // Store snack with month info (deduplicate same snack/month combos)
            const existingEntry = triedSnacksWithMonth.find(
              (item) =>
                item.SnackID === snack.SnackID && item.month === box.month
            );
            if (!existingEntry) {
              triedSnacksWithMonth.push({
                SnackID: snack.SnackID,
                month: box.month, // MMYY or MYY format
              });
            }
          }
        });
      }
    });

    console.log(`  Customer has tried ${triedSnackIDs.size} unique snacks`);

    // Get available snacks from Supabase inventory
    const { data: inventory, error } = await supabase
      .from("fs_unassigned_inventory")
      .select("sku");

    if (error) {
      console.error("Error fetching inventory from Supabase:", error);
      throw error;
    }

    console.log(`  Found ${inventory?.length || 0} SKUs in inventory`);

    // Filter out snacks customer has already tried
    const availableSnacks = inventory
      .filter((item) => !triedSnackIDs.has(item.sku))
      .map((item) => item.sku);

    console.log(`  Available snacks (not tried): ${availableSnacks.length}`);

    // Extract category from current snack (first 2 digits)
    const currentCategory = currentSnackID
      ? currentSnackID.substring(0, 2)
      : null;

    // Categorize available snacks
    const sameCategory = [];
    const otherCategories = [];

    availableSnacks.forEach((snackID) => {
      const category = snackID.substring(0, 2);
      if (category === currentCategory) {
        sameCategory.push(snackID);
      } else {
        otherCategories.push(snackID);
      }
    });

    // Also categorize tried snacks with month info (for display in modal)
    const triedSameCategory = [];
    const triedOtherCategories = [];

    triedSnacksWithMonth.forEach((snackEntry) => {
      const category = snackEntry.SnackID.substring(0, 2);
      if (category === currentCategory) {
        triedSameCategory.push(snackEntry);
      } else {
        triedOtherCategories.push(snackEntry);
      }
    });

    console.log(
      `  Same category (${currentCategory}): ${sameCategory.length} available, ${triedSameCategory.length} tried`
    );
    console.log(
      `  Other categories: ${otherCategories.length} available, ${triedOtherCategories.length} tried`
    );

    res.json({
      success: true,
      data: {
        currentCategory,
        sameCategory,
        otherCategories,
        triedSameCategory, // Now array of {SnackID, month}
        triedOtherCategories, // Now array of {SnackID, month}
        totalAvailable: availableSnacks.length,
        totalTried: triedSnackIDs.size,
      },
    });
  } catch (error) {
    console.error("Error getting available snacks:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Replace a snack in a draftbox
app.put(
  "/api/customers/:customerId/draftbox/:month/replace-snack",
  async (req, res) => {
    try {
      const { customerId, month } = req.params;
      const { oldSnackID, newSnackID, replaceCount } = req.body;

      console.log(`\n🔄 Replace Snack Request:`);
      console.log(`  Customer ID: ${customerId}`);
      console.log(`  Month: ${month}`);
      console.log(`  Old Snack: ${oldSnackID}`);
      console.log(`  New Snack: ${newSnackID}`);
      console.log(`  Replace Count: ${replaceCount || "all"}`);

      if (!oldSnackID || !newSnackID) {
        return res.status(400).json({
          success: false,
          error: "Both oldSnackID and newSnackID are required",
        });
      }

      if (!db) {
        return res.status(500).json({
          success: false,
          error: "Database connection not available",
        });
      }

      // Step 1: Get snack info from snacks collection
      console.log(`  📦 Fetching snack info for ${newSnackID}...`);
      const snacksCollection = db.collection("snacks");
      const snackInfo = await snacksCollection.findOne({
        SnackID: newSnackID,
      });

      if (!snackInfo) {
        console.log(`  ❌ Snack ${newSnackID} not found in snacks collection`);
        return res.status(404).json({
          success: false,
          error: `Snack ${newSnackID} not found in snacks collection`,
        });
      }

      console.log(`  ✅ Found snack info:`, {
        SnackID: snackInfo.SnackID,
        productLine: snackInfo.productLine,
        primaryCategory: snackInfo.primaryCategory,
      });

      // Step 2: Find the draftbox
      console.log(`  🔍 Finding draftbox for month ${month}...`);
      const draftboxesCollection = db.collection("draftboxes");
      const monthInt = parseInt(month);

      const draftbox = await draftboxesCollection.findOne({
        customerID: customerId,
        month: monthInt,
      });

      if (!draftbox) {
        console.log(`  ❌ Draftbox not found`);
        return res.status(404).json({
          success: false,
          error: "Draftbox not found for this customer and month",
        });
      }

      console.log(
        `  ✅ Found draftbox with ${draftbox.snacks?.length || 0} snacks`
      );

      // Step 3: Find the old snack in the snacks array
      if (!draftbox.snacks || !Array.isArray(draftbox.snacks)) {
        return res.status(400).json({
          success: false,
          error: "Draftbox has no snacks array",
        });
      }

      const oldSnackIndex = draftbox.snacks.findIndex(
        (snack) => snack.SnackID === oldSnackID
      );

      if (oldSnackIndex === -1) {
        console.log(`  ❌ Old snack ${oldSnackID} not found in draftbox`);
        return res.status(404).json({
          success: false,
          error: `Snack ${oldSnackID} not found in draftbox`,
        });
      }

      const oldSnack = draftbox.snacks[oldSnackIndex];
      const oldSnackCount = oldSnack.count || 1;
      console.log(`  🔍 Found old snack at index ${oldSnackIndex}:`, oldSnack);
      console.log(`     Current count: ${oldSnackCount}`);

      // Determine how many to replace (default to all if not specified)
      const countToReplace = replaceCount || oldSnackCount;

      // Validate replaceCount
      if (countToReplace < 1 || countToReplace > oldSnackCount) {
        return res.status(400).json({
          success: false,
          error: `Invalid replaceCount. Must be between 1 and ${oldSnackCount}`,
        });
      }

      let updateResult;

      // Step 4: Handle partial vs full replacement
      if (countToReplace < oldSnackCount) {
        // PARTIAL REPLACEMENT: Decrease old count + Add new snack
        console.log(
          `  📊 Partial replacement: ${countToReplace} out of ${oldSnackCount}`
        );

        // Create new snack object
        const newSnack = {
          SnackID: newSnackID,
          productLine: snackInfo.productLine,
          primaryCategory: snackInfo.primaryCategory,
          count: countToReplace,
          sort: draftbox.snacks.length, // Add to end
        };

        console.log(
          `  ⬇️  Decreasing old snack count: ${oldSnackCount} → ${
            oldSnackCount - countToReplace
          }`
        );
        console.log(`  ✨ Adding new snack:`, newSnack);

        // MongoDB doesn't allow $set and $push on the same path in one operation
        // So we split into two sequential operations

        // Step 1: Decrease the count of the old snack
        const decreaseResult = await draftboxesCollection.updateOne(
          {
            customerID: customerId,
            month: monthInt,
          },
          {
            $set: {
              [`snacks.${oldSnackIndex}.count`]: oldSnackCount - countToReplace,
            },
          }
        );

        if (decreaseResult.modifiedCount === 0) {
          console.log(`  ❌ Failed to decrease old snack count`);
          return res.status(500).json({
            success: false,
            error: "Failed to decrease old snack count",
          });
        }

        // Step 2: Add the new snack to the array
        updateResult = await draftboxesCollection.updateOne(
          {
            customerID: customerId,
            month: monthInt,
          },
          {
            $push: {
              snacks: newSnack,
            },
          }
        );
      } else {
        // FULL REPLACEMENT: Replace entire snack
        console.log(`  🔄 Full replacement: replacing entire snack`);

        const newSnack = {
          SnackID: newSnackID,
          productLine: snackInfo.productLine,
          primaryCategory: snackInfo.primaryCategory,
          count: oldSnackCount,
          sort: oldSnack.sort || oldSnackIndex,
        };

        console.log(`  ✨ Creating replacement snack:`, newSnack);

        updateResult = await draftboxesCollection.updateOne(
          {
            customerID: customerId,
            month: monthInt,
          },
          {
            $set: {
              [`snacks.${oldSnackIndex}`]: newSnack,
            },
          }
        );
      }

      if (updateResult.modifiedCount === 0) {
        console.log(`  ❌ Failed to update draftbox`);
        return res.status(500).json({
          success: false,
          error: "Failed to update draftbox",
        });
      }

      console.log(`  ✅ Successfully replaced snack!`);
      console.log(`     ${oldSnackID} (${countToReplace}x) → ${newSnackID}`);

      // Return the updated draftbox
      const updatedDraftbox = await draftboxesCollection.findOne({
        customerID: customerId,
        month: monthInt,
      });

      res.json({
        success: true,
        message: "Snack replaced successfully",
        data: {
          oldSnackID,
          newSnackID,
          draftbox: updatedDraftbox,
        },
      });
    } catch (error) {
      console.error("❌ Error replacing snack:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Error handler (must be after all routes)
app.use((err, req, res, next) => {
  console.error("❌ Express Error Handler:", err);
  console.error("Error Stack:", err.stack);
  
  // Don't send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Something went wrong!",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("❌ Server Error:", error);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    if (mongoClient) {
      mongoClient.close();
    }
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    if (mongoClient) {
      mongoClient.close();
    }
    process.exit(0);
  });
});

export default app;
