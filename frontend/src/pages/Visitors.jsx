import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../api/axios";
import VisitorDetailsPanel from "../components/VisitorDetailsPanel";
import GeographyHeatmap from "../components/GeographyHeatmap";
import { detectDeviceModel } from "../utils/deviceDetection";
import { HiDownload } from "react-icons/hi";
import * as XLSX from "xlsx";
import PageRankings from "./PageRankings";
import "./Visitors.css";
import "./TrafficSources.css";
import "./PowerUsers.css";

const Visitors = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [visitors, setVisitors] = useState([]);
  const [dailyTrends, setDailyTrends] = useState([]);
  const [dailyTrendsAllTime, setDailyTrendsAllTime] = useState([]);
  const [hoveredLinePointIndex, setHoveredLinePointIndex] = useState(null);
  const [lineChartWidth, setLineChartWidth] = useState(400);
  const lineChartContainerRef = useRef(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [dateRange, setDateRange] = useState("30daysAgo");
  const [hoveredBar, setHoveredBar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [visitorsView, setVisitorsView] = useState("overview");
  const [audienceProfile, setAudienceProfile] = useState(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState(null);
  const [powerUsers, setPowerUsers] = useState([]);
  const [powerUsersLoading, setPowerUsersLoading] = useState(false);
  const [powerUsersError, setPowerUsersError] = useState(null);
  const [powerUsersDateRange, setPowerUsersDateRange] = useState("30daysAgo");
  const [trafficSourcesData, setTrafficSourcesData] = useState(null);
  const [trafficSourcesLoading, setTrafficSourcesLoading] = useState(false);
  const [trafficSourcesError, setTrafficSourcesError] = useState(null);
  const [trafficSourcesByPeriod, setTrafficSourcesByPeriod] = useState({ "7daysAgo": null, "30daysAgo": null, "90daysAgo": null });
  const [trafficSourcesChartLoading, setTrafficSourcesChartLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceAnalysis, setSourceAnalysis] = useState(null);
  const [sourceAnalysisLoading, setSourceAnalysisLoading] = useState(false);
  const [sourceAnalysisError, setSourceAnalysisError] = useState(null);
  const [topPagesData, setTopPagesData] = useState([]);
  const [topPagesLoading, setTopPagesLoading] = useState(false);
  const [overviewDailySources, setOverviewDailySources] = useState(null);
  const [overviewDailySourcesLoading, setOverviewDailySourcesLoading] = useState(false);

  /** Map GA source strings to a canonical name for chart/legend (dedupe e.g. chatgpt.com + openai → ChatGPT). */
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
    if (k.includes("vercel")) return "Vercel";
    if (k.includes("facebook")) return "Facebook";
    if (k.includes("twitter") || k.includes("x.com")) return "X (Twitter)";
    if (k.includes("instagram")) return "Instagram";
    if (k.includes("linkedin")) return "LinkedIn";
    if (k.includes("pinterest")) return "Pinterest";
    return s || "(not set)";
  };

  const mergeSessionSourcesByCanonical = (list) => {
    const byCanonical = {};
    (list || []).forEach((x) => {
      const canon = getCanonicalSource(x.source);
      byCanonical[canon] = (byCanonical[canon] || 0) + (x.sessions || 0);
    });
    return Object.entries(byCanonical).map(([source, sessions]) => ({ source, sessions }));
  };

  /** iPhone physical (and common logical) pixel dimensions -> short model label (Apple logo + this) */
  const IPHONE_RESOLUTION_TO_MODEL = {
    "1260x2736": "Air",
    "1320x2868": "16 Pro Max",
    "1206x2622": "16 Pro",
    "1179x2556": "15 Pro",
    "1170x2532": "14",
    "1290x2796": "15 Pro Max",
    "1284x2778": "14 Plus",
    "1242x2688": "11 Pro Max",
    "1125x2436": "11 Pro",
    "1080x2340": "13 mini",
    "1080x1920": "8 Plus",
    "828x1792": "11",
    "750x1334": "SE",
    "640x1136": "SE (1st)",
    "393x852": "15 Pro",
    "390x844": "14",
    "430x932": "15 Pro Max",
    "428x926": "14 Plus",
    "402x874": "16 Pro",
    "440x956": "16 Pro Max",
    "375x812": "13 mini",
    "375x667": "SE",
    "414x896": "11",
    "414x736": "8 Plus",
  };

  const formatDeviceDisplay = (deviceName, screenResolution) => {
    const isIPhone = /iphone|ios/i.test(deviceName || "");
    if (!isIPhone) return deviceName || "—";
    const res = (screenResolution || "").replace(/\s/g, "");
    const match = /(\d+)\s*[x×]\s*(\d+)/i.exec(res);
    if (!match) return "\uF8FF " + (deviceName || "iPhone");
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    const key = w < h ? `${w}x${h}` : `${h}x${w}`;
    const model = IPHONE_RESOLUTION_TO_MODEL[key];
    if (model) return <><span className="device-apple-logo" aria-hidden="true">&#xF8FF;</span> {model}</>;
    return "\uF8FF " + (deviceName || "iPhone");
  };

  const SOURCE_GROUPS = [
    {
      label: "Search engines",
      sources: [
        { id: "google", label: "Google Organic", logo: "https://www.google.com/favicon.ico" },
        { id: "bing", label: "Bing", logo: "https://www.bing.com/favicon.ico" },
        { id: "yahoo", label: "Yahoo", logo: "https://www.yahoo.com/favicon.ico" },
        { id: "duckduckgo", label: "DuckDuckGo", logo: "https://duckduckgo.com/favicon.ico" },
      ],
    },
    {
      label: "LLMs",
      sources: [
        { id: "chatgpt", label: "ChatGPT", logo: "https://chat.openai.com/favicon.ico" },
        { id: "claude", label: "Claude", logo: "https://www.anthropic.com/favicon.ico" },
        { id: "perplexity", label: "Perplexity", logo: "https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32" },
      ],
    },
    {
      label: "Social media",
      sources: [
        { id: "facebook", label: "Facebook", logo: "https://www.facebook.com/favicon.ico" },
        { id: "twitter", label: "X (Twitter)", logo: "https://twitter.com/favicon.ico" },
        { id: "instagram", label: "Instagram", logo: "https://www.google.com/s2/favicons?domain=instagram.com&sz=32" },
        { id: "linkedin", label: "LinkedIn", logo: "https://www.linkedin.com/favicon.ico" },
        { id: "pinterest", label: "Pinterest", logo: "https://www.pinterest.com/favicon.ico" },
        { id: "tiktok", label: "TikTok", logo: "https://www.google.com/s2/favicons?domain=tiktok.com&sz=32" },
        { id: "reddit", label: "Reddit", logo: "https://www.google.com/s2/favicons?domain=reddit.com&sz=32" },
        { id: "youtube", label: "YouTube", logo: "https://www.google.com/s2/favicons?domain=youtube.com&sz=32" },
      ],
    },
  ];

  useEffect(() => {
    fetchVisitors();
    fetchDailyTrends();
    fetchDailyTrendsAllTime();
    fetchMetrics();
    fetchTopPages();
    setCurrentPage(1);
  }, [dateRange]);

  useEffect(() => {
    if (visitorsView !== "overview") return;
    setOverviewDailySourcesLoading(true);
    apiClient
      .get("/api/analytics/daily-traffic-by-source", { params: { startDate: "7daysAgo", endDate: "today" } })
      .then((res) => {
        if (res.data.success) setOverviewDailySources(res.data.data);
      })
      .catch(() => setOverviewDailySources(null))
      .finally(() => setOverviewDailySourcesLoading(false));
  }, [visitorsView]);

  const fetchTopPages = async () => {
    setTopPagesLoading(true);
    try {
      const response = await apiClient.get("/api/analytics/top-pages", {
        params: { startDate: dateRange, endDate: "today", limit: 200 },
      });
      if (response.data.success) setTopPagesData(response.data.data || []);
    } catch (err) {
      setTopPagesData([]);
    } finally {
      setTopPagesLoading(false);
    }
  };

  const categorizePageFromPath = (path) => {
    if (!path) return "other";
    const p = (path.startsWith("/") ? path : `/${path}`).toLowerCase();
    if (p.includes("/ingredient-checker")) return "ingredient-checker";
    if (p.includes("/compare-bars") || p.includes("/browse")) return "tool";
    if (p.includes("/partners") || p.includes("/contact") || p.includes("/help-center") || p.includes("/privacy-policy") || p.includes("/terms-of-service")) return "about";
    if (p.includes("/reviews")) return "reviews";
    if (p.includes("/rankings")) return "rankings";
    if (p.includes("/directory")) return "directory";
    const segments = p.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
    if (segments.length <= 1 && (p === "/" || p === "" || segments.length === 1)) return "landing";
    return "other";
  };

  const CATEGORY_LABELS = {
    landing: "Landing",
    reviews: "Reviews",
    rankings: "Rankings",
    tool: "Tool",
    "ingredient-checker": "Ingredient",
    about: "About",
    directory: "Directory",
    other: "Other",
  };

  /** Bot detection: known crawler/bot browser strings (GA4 "browser" dimension). */
  const KNOWN_BOT_BROWSER_PATTERNS = [
    "googlebot", "bingbot", "slurp", "duckduckbot", "baiduspider", "yandexbot",
    "facebookexternalhit", "twitterbot", "linkedinbot", "pinterest", "slackbot",
    "whatsapp", "telegrambot", "discordbot", "applebot", "petalbot", "sogou",
    "bytespider", "semrushbot", "ahrefsbot", "mj12bot", "dotbot", "screaming",
    "headlesschrome", "phantom", "puppeteer", "selenium", "bot", "crawler", "spider",
    "curl", "wget", "python-requests", "go-http-client", "java/", "apache-httpclient",
  ];

  /** Behavioral heuristics: sessions with duration <= this (seconds) and pageViews <= 1 are flagged. */
  const BOT_BEHAVIORAL_MAX_DURATION_SEC = 3;
  const BOT_BEHAVIORAL_MAX_PAGE_VIEWS = 1;

  const botAnalysis = useMemo(() => {
    const list = visitors || [];
    const byBrowser = [];
    const byBehavioral = [];
    const flaggedIds = new Set();

    list.forEach((v) => {
      const browser = (v.browser || "").toLowerCase();
      const isKnownBotBrowser = KNOWN_BOT_BROWSER_PATTERNS.some((p) => browser.includes(p));
      const duration = Number(v.totalDuration) || 0;
      const pageViews = Number(v.pageViews) || 0;
      const isBehavioralBot = duration <= BOT_BEHAVIORAL_MAX_DURATION_SEC && pageViews <= BOT_BEHAVIORAL_MAX_PAGE_VIEWS;

      if (isKnownBotBrowser) {
        byBrowser.push({ ...v, botReason: "Known crawler/bot (browser)" });
        flaggedIds.add(v.id);
      }
      if (isBehavioralBot) {
        byBehavioral.push({ ...v, botReason: "Short session, single page" });
        flaggedIds.add(v.id);
      }
    });

    const combined = list.filter((v) => flaggedIds.has(v.id));
    const byBrowserOnlyCount = byBrowser.length;
    const byBehavioralOnlyCount = byBehavioral.filter((b) => !byBrowser.some((x) => x.id === b.id)).length;
    const summary = {
      totalSessions: list.length,
      flaggedAsBot: combined.length,
      byBrowserOnly: byBrowserOnlyCount,
      byBehavioralOnly: byBehavioralOnlyCount,
      percentFlagged: list.length ? ((combined.length / list.length) * 100).toFixed(1) : "0",
    };
    return {
      byBrowser,
      byBehavioral,
      combined,
      summary,
    };
  }, [visitors]);

  const categoryPieData = (() => {
    if (!topPagesData.length) return [];
    const byCat = {};
    topPagesData.forEach((page) => {
      const cat = categorizePageFromPath(page.path);
      if (!byCat[cat]) byCat[cat] = { views: 0, weightedDuration: 0 };
      byCat[cat].views += page.views || 0;
      byCat[cat].weightedDuration += (page.views || 0) * (page.avgDuration || 0);
    });
    const totalViews = Object.values(byCat).reduce((s, x) => s + x.views, 0);
    if (totalViews === 0) return [];
    const slices = Object.entries(byCat)
      .filter(([, d]) => d.views > 0)
      .map(([cat, d]) => ({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        views: d.views,
        share: d.views / totalViews,
        avgDuration: d.views > 0 ? d.weightedDuration / d.views : 0,
      }))
      .sort((a, b) => b.views - a.views);
    const sortedByDuration = [...slices].sort((a, b) => a.avgDuration - b.avgDuration);
    const rank = (s) => sortedByDuration.findIndex((x) => x.category === s.category);
    const n = sortedByDuration.length;
    return slices.map((s) => {
      const r = rank(s);
      const opacityByDuration = n > 1 ? 0.3 + 0.65 * (r / (n - 1)) : 0.75;
      return {
        ...s,
        opacity: opacityByDuration,
      };
    });
  })();

  useEffect(() => {
    if (visitorsView === "overview" || visitorsView === "logs") {
      fetchAudienceProfile();
    }
    if (visitorsView === "logs") {
      fetchPowerUsers();
    }
  }, [dateRange, visitorsView, powerUsersDateRange]);

  useEffect(() => {
    const el = lineChartContainerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setLineChartWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visitorsView, trailing7LineData?.length]);

  const fetchPowerUsers = async () => {
    setPowerUsersLoading(true);
    setPowerUsersError(null);
    try {
      const response = await apiClient.get("/api/visitors/power-users", {
        params: { startDate: powerUsersDateRange, endDate: "today", minSessions: 3 },
      });
      if (response.data.success) setPowerUsers(response.data.data || []);
    } catch (err) {
      setPowerUsersError(err.response?.data?.error || "Failed to load power users");
      setPowerUsers([]);
    } finally {
      setPowerUsersLoading(false);
    }
  };

  useEffect(() => {
    if (visitorsView === "sources") {
      fetchTrafficSources();
      fetchTrafficSourcesForChart();
    }
  }, [dateRange, visitorsView]);

  useEffect(() => {
    if (visitorsView === "sources" && selectedSource === "chatgpt") {
      setSourceAnalysisError(null);
      setSourceAnalysisLoading(true);
      apiClient
        .get("/api/analytics/source-analysis", {
          params: { sourceId: "chatgpt", startDate: dateRange, endDate: "today" },
        })
        .then((res) => {
          if (res.data.success) setSourceAnalysis(res.data.data);
          else setSourceAnalysisError(res.data.error || "Failed to load");
        })
        .catch((err) => {
          setSourceAnalysisError(err.response?.data?.error || err.message);
          setSourceAnalysis(null);
        })
        .finally(() => setSourceAnalysisLoading(false));
    } else {
      setSourceAnalysis(null);
    }
  }, [visitorsView, selectedSource, dateRange]);

  const fetchTrafficSources = async () => {
    setTrafficSourcesLoading(true);
    setTrafficSourcesError(null);
    try {
      const response = await apiClient.get("/api/analytics/traffic-sources", {
        params: { startDate: dateRange, endDate: "today" },
      });
      if (response.data.success) setTrafficSourcesData(response.data.data);
    } catch (err) {
      setTrafficSourcesError(err.response?.data?.error || err.message);
    } finally {
      setTrafficSourcesLoading(false);
    }
  };

  const fetchTrafficSourcesForChart = async () => {
    setTrafficSourcesChartLoading(true);
    try {
      const periods = ["7daysAgo", "30daysAgo", "90daysAgo"];
      const results = await Promise.all(
        periods.map((startDate) =>
          apiClient.get("/api/analytics/traffic-sources", { params: { startDate, endDate: "today" } }).then((r) => r.data.success ? r.data.data : null)
        )
      );
      setTrafficSourcesByPeriod({
        "7daysAgo": results[0],
        "30daysAgo": results[1],
        "90daysAgo": results[2],
      });
    } catch (err) {
      setTrafficSourcesByPeriod({ "7daysAgo": null, "30daysAgo": null, "90daysAgo": null });
    } finally {
      setTrafficSourcesChartLoading(false);
    }
  };

  const fetchAudienceProfile = async () => {
    setAudienceLoading(true);
    setAudienceError(null);
    try {
      const response = await apiClient.get("/api/analytics/audience", {
        params: { startDate: dateRange, endDate: "today" },
      });
      setAudienceProfile(response.data.data);
    } catch (err) {
      setAudienceError(err.response?.data?.error || "Failed to load audience data");
    } finally {
      setAudienceLoading(false);
    }
  };

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

  const fetchDailyTrendsAllTime = async () => {
    try {
      const response = await apiClient.get("/api/visitors/daily-trends", {
        params: { startDate: "90daysAgo", endDate: "today" },
      });
      if (response.data.success) {
        setDailyTrendsAllTime(response.data.data || []);
      } else {
        setDailyTrendsAllTime([]);
      }
    } catch (error) {
      console.error("Error fetching all-time daily trends:", error);
      setDailyTrendsAllTime([]);
    }
  };

  const trailing7LineData = useMemo(() => {
    const data = dailyTrendsAllTime;
    if (!data.length) return [];
    return data.map((_, i) => {
      const start = Math.max(0, i - 6);
      const slice = data.slice(start, i + 1);
      const sum = slice.reduce((s, d) => s + (d.total || 0), 0);
      return { date: data[i].date, avg: slice.length ? sum / slice.length : 0 };
    });
  }, [dailyTrendsAllTime]);

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

  const stripSiteNameFromTitle = (str) => {
    if (!str || typeof str !== "string") return str;
    return str.replace(/\s*\|\s*Protein Bar Nerd\s*$/i, "").trim();
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
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatPowerUsersDate = (dateStr) => {
    if (!dateStr) return "N/A";
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${month}/${day}/${year}`;
    }
    return dateStr;
  };

  const formatPowerUsersLocation = (city, region, country) => {
    const parts = [];
    if (city && city !== "N/A") parts.push(city);
    if (region && region !== "N/A") parts.push(getStateAbbreviation(region) || region);
    if (country) parts.push(country === "United States" ? "US" : country);
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const formatHourLabel = (hour) => {
    const h = typeof hour === "number" ? hour : parseInt(hour, 10);
    if (!Number.isInteger(h) || h < 0 || h > 23) return hour != null ? String(hour) : "—";
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const formatDayOfWeekLabel = (value) => {
    const n = typeof value === "number" ? value : parseInt(value, 10);
    if (Number.isInteger(n) && n >= 0 && n <= 6) return DAY_NAMES[n];
    return value != null ? String(value) : "—";
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
    const dateRangeLabel = "30D";
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
              <div className="visitor-metric-label">Month (30D)</div>
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

      <div className="visitors-view-tabs">
        <button
          className={`visitors-view-tab ${visitorsView === "overview" ? "active" : ""}`}
          onClick={() => setVisitorsView("overview")}
        >
          Overview
        </button>
        <button
          className={`visitors-view-tab ${visitorsView === "logs" ? "active" : ""}`}
          onClick={() => setVisitorsView("logs")}
        >
          Logs
        </button>
        <button
          className={`visitors-view-tab ${visitorsView === "sources" ? "active" : ""}`}
          onClick={() => setVisitorsView("sources")}
        >
          Sources
        </button>
        <button
          className={`visitors-view-tab ${visitorsView === "bots" ? "active" : ""}`}
          onClick={() => setVisitorsView("bots")}
        >
          Bots
        </button>
      </div>

      {visitorsView === "overview" && (
        <>
      <div className="overview-chart-row">
      {/* Combined card: bar chart + line chart */}
      <div className="card overview-combined-charts-card">
        <h2 className="overview-combined-charts-title">Traffic</h2>
        <div className="overview-charts-column">
      {/* Daily Trends Chart (top) */}
      <div className="trend-card-inner">
        <div className="trend-chart">
          {dailyTrends.length > 0 ? (
            <div className="trend-chart-container">
              {/* Y-axis labels */}
              <div className="y-axis">
                {(() => {
                  const maxTotal = 100;
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
                    const maxTotal = 100;
                    return dailyTrends.slice(-30).map((day, index) => {
                      // Total bar height as percentage of container
                      const totalBarHeight = Math.min(100, (day.total / maxTotal) * 100);
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

      {/* Trailing 7-day average line chart (bottom), 90D */}
      <div className="trend-line-card-inner">
        <div className="trend-line-chart">
          {trailing7LineData.length > 0 ? (
            <div
              ref={lineChartContainerRef}
              className="trend-line-chart-container"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const fraction = x / rect.width;
                const index = Math.min(
                  trailing7LineData.length - 1,
                  Math.max(0, Math.round(fraction * (trailing7LineData.length - 1)))
                );
                setHoveredLinePointIndex(index);
              }}
              onMouseLeave={() => setHoveredLinePointIndex(null)}
            >
              {(() => {
                const trailing7 = trailing7LineData;
                const yMax = 100;
                const padding = { top: 8, right: 8, bottom: 24, left: 44 };
                const width = lineChartWidth;
                const height = 180;
                const xScale = (i) => padding.left + (i / Math.max(1, trailing7.length - 1)) * (width - padding.left - padding.right);
                const yScale = (v) => padding.top + (1 - v / yMax) * (height - padding.top - padding.bottom);
                const pathD = trailing7
                  .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.avg)}`)
                  .join(" ");
                const yTicks = 5;
                return (
                  <>
                    <svg className="trend-line-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
                      {/* Grid lines */}
                      {Array.from({ length: yTicks + 1 }, (_, i) => {
                        const y = padding.top + (i / yTicks) * (height - padding.top - padding.bottom);
                        return <line key={i} x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="trend-line-grid" />;
                      })}
                      {/* Line */}
                      <path d={pathD} fill="none" stroke="#FFBC00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {/* Y-axis labels */}
                      {Array.from({ length: yTicks + 1 }, (_, i) => {
                        const val = Math.round((yMax * (yTicks - i)) / yTicks);
                        const y = padding.top + (i / yTicks) * (height - padding.top - padding.bottom);
                        return (
                          <text key={i} x={padding.left - 6} y={y + 4} textAnchor="end" className="trend-line-y-label">{formatNumber(val)}</text>
                        );
                      })}
                      {/* X-axis labels */}
                      {trailing7.length > 0 && Array.from({ length: 5 }, (_, i) => {
                        const idx = Math.round((i / 4) * (trailing7.length - 1));
                        const day = trailing7[idx];
                        if (!day) return null;
                        const x = xScale(idx);
                        return (
                          <text key={i} x={x} y={height - 4} textAnchor="middle" className="trend-line-x-label">{formatDate(day.date)}</text>
                        );
                      })}
                    </svg>
                    {hoveredLinePointIndex != null && trailing7[hoveredLinePointIndex] && (
                      <div className="bar-tooltip trend-line-tooltip">
                        <div className="tooltip-header">
                          <div className="tooltip-day-name">{getDayOfWeek(trailing7[hoveredLinePointIndex].date)}</div>
                          <div className="tooltip-date">{formatDate(trailing7[hoveredLinePointIndex].date)}</div>
                        </div>
                        <div className="tooltip-divider"></div>
                        <div className="tooltip-value total">
                          <span className="tooltip-label">Total (7d avg)</span>
                          <span className="tooltip-number">{formatNumber(Math.round(trailing7[hoveredLinePointIndex].avg))}</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="no-data">No data available</div>
          )}
        </div>
      </div>
        </div>
      </div>

      {/* Top Pages - right of chart */}
      <div className="card overview-top-pages-card">
        <h2 className="overview-top-pages-title">Top Pages</h2>
        {topPagesLoading ? (
          <div className="overview-top-pages-loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="overview-top-pages-table-wrap">
            <table className="overview-top-pages-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Views</th>
                  <th>Avg</th>
                </tr>
              </thead>
              <tbody>
                {topPagesData.length > 0 ? (
                  topPagesData.slice(0, 15).map((page, index) => (
                    <tr key={index}>
                      <td className="overview-top-pages-path" title={stripSiteNameFromTitle(page.path)}>
                        {stripSiteNameFromTitle(page.title && page.title !== "(not set)" ? page.title : page.path)}
                      </td>
                      <td className="overview-top-pages-num">{formatNumber(page.views)}</td>
                      <td className="overview-top-pages-num">
                        {page.avgDuration != null ? formatDuration(page.avgDuration) : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="no-data">No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category pie: page views by category, opacity = weighted avg engagement */}
      <div className="card overview-category-pie-card">
        <h2 className="overview-top-pages-title">Page views by category</h2>
        {topPagesLoading ? (
          <div className="overview-top-pages-loading">
            <div className="spinner"></div>
          </div>
        ) : categoryPieData.length > 0 ? (
          <div className="overview-pie-wrap">
            <svg className="overview-pie-svg" viewBox="0 0 100 100">
              {(() => {
                let startAngle = 0;
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
                return categoryPieData.map((slice, i) => {
                  const angle = slice.share * 2 * Math.PI;
                  const endAngle = startAngle + angle;
                  const x1 = 50 + 42 * Math.sin(startAngle);
                  const y1 = 50 - 42 * Math.cos(startAngle);
                  const x2 = 50 + 42 * Math.sin(endAngle);
                  const y2 = 50 - 42 * Math.cos(endAngle);
                  const large = angle > Math.PI ? 1 : 0;
                  const d = `M 50 50 L ${x1} ${y1} A 42 42 0 ${large} 1 ${x2} ${y2} Z`;
                  const color = colors[i % colors.length];
                  startAngle = endAngle;
                  return (
                    <path
                      key={slice.category}
                      d={d}
                      fill={color}
                      fillOpacity={slice.opacity}
                      className="overview-pie-slice"
                    />
                  );
                });
              })()}
            </svg>
            <div className="overview-pie-legend">
              {categoryPieData.map((slice, i) => {
                const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
                return (
                  <div key={slice.category} className="overview-pie-legend-item">
                    <span
                      className="overview-pie-legend-dot"
                      style={{ backgroundColor: colors[i % colors.length], opacity: slice.opacity }}
                    />
                    <span className="overview-pie-legend-label">{slice.label}</span>
                    <span className="overview-pie-legend-values">
                      <span className="overview-pie-legend-pct-cell">{(slice.share * 100).toFixed(0)}%</span>
                      <span>|</span>
                      <span>{formatNumber(slice.views)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="no-data">No data</div>
        )}
      </div>

      {/* Sources: 7-day stacked bars (skinny), right of pie */}
      <div className="card overview-sources-card">
        <h2 className="overview-top-pages-title">Sources</h2>
        {overviewDailySourcesLoading ? (
          <div className="overview-top-pages-loading">
            <div className="spinner"></div>
          </div>
        ) : overviewDailySources?.daily?.length > 0 ? (
          (() => {
            const daily = overviewDailySources.daily.slice(-7);
            const allSourceNames = [...new Set(daily.flatMap((d) => d.sources.map((s) => s.source)))];
            const sourceOrder = allSourceNames.sort((a, b) => {
              const totalA = daily.reduce((sum, d) => sum + (d.sources.find((s) => s.source === a)?.sessions || 0), 0);
              const totalB = daily.reduce((sum, d) => sum + (d.sources.find((s) => s.source === b)?.sessions || 0), 0);
              return totalB - totalA;
            });
            const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
            const getSourceColor = (source) => colors[sourceOrder.indexOf(source) % colors.length];
            return (
              <div className="overview-sources-chart">
                <div className="overview-sources-bars">
                  {daily.map((day, i) => {
                    const total = day.totalSessions || 1;
                    let cum = 0;
                    return (
                      <div key={day.date} className="overview-sources-bar-cell">
                        <div className="overview-sources-bar-stack">
                          {sourceOrder.map((src) => {
                            const sessions = day.sources.find((s) => s.source === src)?.sessions || 0;
                            const pct = (sessions / total) * 100;
                            if (pct <= 0) return null;
                            cum += pct;
                            return (
                              <div
                                key={src}
                                className="overview-sources-bar-segment"
                                style={{
                                  height: `${pct}%`,
                                  backgroundColor: getSourceColor(src),
                                }}
                                title={`${src}: ${(pct).toFixed(0)}%`}
                              />
                            );
                          })}
                        </div>
                        <span className="overview-sources-bar-label">{formatDate(day.date)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="overview-sources-legend">
                  {sourceOrder.map((src) => (
                    <div key={src} className="overview-sources-legend-item">
                      <span className="overview-sources-legend-dot" style={{ backgroundColor: getSourceColor(src) }} />
                      <span className="overview-sources-legend-label">{src}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="no-data">No data</div>
        )}
      </div>
      </div>

      {/* Overview: Geography, Device, Time Analysis */}
      {audienceLoading ? (
        <div className="audience-loading">
          <div className="spinner"></div>
          <p>Loading audience data...</p>
        </div>
      ) : audienceError ? (
        <div className="audience-error">
          <p>⚠️ {audienceError}</p>
        </div>
      ) : audienceProfile ? (
        <div className="overview-audience-sections audience-dashboard">
          <section className="audience-section audience-section-geography">
            <div className="audience-section-card">
              <h2 className="visitors-audience-card-title">Geography</h2>
              {audienceProfile.geographic?.length ? (
                <>
                  <div className="geographic-heatmap-header">
                    {(() => {
                      const usUsers = (audienceProfile.geographic || []).reduce((sum, geo) => {
                        const c = (geo.country || "").toLowerCase();
                        if (c === "united states" || c.includes("united states") || c === "us" || c === "usa") return sum + (geo.users || 0);
                        return sum;
                      }, 0);
                      const nonUsUsers = (audienceProfile.geographic || []).reduce((sum, geo) => {
                        const c = (geo.country || "").toLowerCase();
                        if (c !== "united states" && !c.includes("united states") && c !== "us" && c !== "usa") return sum + (geo.users || 0);
                        return sum;
                      }, 0);
                      return (
                        <div className="geographic-heatmap-stats">
                          US: {usUsers.toLocaleString()} | Non-U.S.: {nonUsUsers.toLocaleString()}
                        </div>
                      );
                    })()}
                  </div>
                  <GeographyHeatmap geographicData={audienceProfile.geographic} />
                  <div className="audience-subheading">By country</div>
                  <div className="table-container">
                    <table className="audience-data-table audience-data-table--clean">
                      <thead><tr><th>Country</th><th>Region</th><th>Users</th><th>Sessions</th><th>Page Views</th></tr></thead>
                      <tbody>
                        {audienceProfile.geographic.map((geo, index) => (
                          <tr key={index}>
                            <td>{geo.country}</td><td>{geo.region}</td>
                            <td>{geo.users?.toLocaleString()}</td><td>{geo.sessions?.toLocaleString()}</td><td>{geo.pageViews?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="no-data">No geographic data</div>
              )}
            </div>
          </section>
          <section className="audience-section audience-section-device">
            <div className="audience-section-card">
              <h2 className="visitors-audience-card-title">Device</h2>
              {audienceProfile.device?.length ? (
                <>
                  <div className="table-container">
                    <table className="audience-data-table audience-data-table--striped">
                      <thead><tr><th>Device</th><th>Screen</th><th>Users</th><th>% Users</th><th>Sessions</th><th>% Sessions</th><th>Page Views</th></tr></thead>
                      <tbody>
                        {(() => {
                          const raw = audienceProfile.device || [];
                          const totalUsers = raw.reduce((s, d) => s + (d.users || 0), 0);
                          const totalSessions = raw.reduce((s, d) => s + (d.sessions || 0), 0);
                          const desktopRows = raw.filter((d) => /desktop/i.test(d.device || ""));
                          const nonDesktopRows = raw.filter((d) => !/desktop/i.test(d.device || ""));
                          const mergedDesktop = desktopRows.length
                            ? [{
                                device: "Desktop",
                                screenResolution: null,
                                users: desktopRows.reduce((s, d) => s + (d.users || 0), 0),
                                sessions: desktopRows.reduce((s, d) => s + (d.sessions || 0), 0),
                                pageViews: desktopRows.reduce((s, d) => s + (d.pageViews || 0), 0),
                              }]
                            : [];
                          const merged = [...mergedDesktop, ...nonDesktopRows];
                          return merged.map((device, index) => {
                            const userPct = totalUsers > 0 ? ((device.users || 0) / totalUsers * 100).toFixed(1) : "0";
                            const sessionPct = totalSessions > 0 ? ((device.sessions || 0) / totalSessions * 100).toFixed(1) : "0";
                            const isDesktop = /desktop/i.test(device.device || "");
                            return (
                              <tr key={index}>
                                <td>{formatDeviceDisplay(device.device, device.screenResolution)}</td>
                                <td>{isDesktop ? "--" : (device.screenResolution || "N/A")}</td>
                                <td>{(device.users || 0).toLocaleString()}</td>
                                <td>{userPct}%</td>
                                <td>{(device.sessions || 0).toLocaleString()}</td>
                                <td>{sessionPct}%</td>
                                <td>{(device.pageViews || 0).toLocaleString()}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="no-data">No device data</div>
              )}
            </div>
          </section>
          <section className="audience-section audience-section-time">
            <div className="audience-section-card">
              <h2 className="visitors-audience-card-title">Time Analysis</h2>
              {audienceProfile.timeAnalysis ? (
                <>
                  <div className="audience-subheading">Sessions by hour</div>
                  {audienceProfile.timeAnalysis.byHour?.length > 0 && (
                    <div className="time-analysis-bar-chart">
                      <div className="time-analysis-bars">
                        {audienceProfile.timeAnalysis.byHour.map((hour, i) => {
                          const maxSessions = Math.max(...audienceProfile.timeAnalysis.byHour.map((h) => h.sessions || 0), 1);
                          const pct = (hour.sessions || 0) / maxSessions * 100;
                          return (
                            <div key={i} className="time-analysis-bar-cell" title={`${formatHourLabel(hour.hour)}: ${(hour.sessions || 0).toLocaleString()} sessions`}>
                              <div className="time-analysis-bar-fill" style={{ height: `${pct}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <div className="time-analysis-bar-labels">
                        {audienceProfile.timeAnalysis.byHour.map((hour, i) => (
                          <span key={i} className="time-analysis-bar-label">{i % 3 === 0 ? formatHourLabel(hour.hour) : ""}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="audience-subheading">By hour (table)</div>
                  <div className="table-container">
                    <table className="audience-data-table audience-data-table--dividers">
                      <thead><tr><th>Hour</th><th>Sessions</th><th>Users</th><th>Page Views</th></tr></thead>
                      <tbody>
                        {audienceProfile.timeAnalysis.byHour?.map((hour, i) => (
                          <tr key={i}><td>{formatHourLabel(hour.hour)}</td><td>{hour.sessions?.toLocaleString()}</td><td>{hour.users?.toLocaleString()}</td><td>{hour.pageViews?.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="audience-subheading">By day of week</div>
                  <div className="table-container">
                    <table className="audience-data-table audience-data-table--dividers">
                      <thead><tr><th>Day of Week</th><th>Sessions</th><th>Users</th><th>Page Views</th></tr></thead>
                      <tbody>
                        {audienceProfile.timeAnalysis.byDayOfWeek?.map((day, i) => (
                          <tr key={i}><td>{formatDayOfWeekLabel(day.dayOfWeek)}</td><td>{day.sessions?.toLocaleString()}</td><td>{day.users?.toLocaleString()}</td><td>{day.pageViews?.toLocaleString()}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="no-data">No time analysis data</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
        </>
      )}

      {visitorsView === "logs" && (
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
      )}

      {visitorsView === "logs" && (audienceLoading || audienceError || audienceProfile) && (
        <div className="visitors-logs-audience">
          {audienceLoading ? (
            <div className="audience-loading">
              <div className="spinner"></div>
              <p>Loading audience data...</p>
            </div>
          ) : audienceError ? (
            <div className="audience-error">
              <p>⚠️ {audienceError}</p>
            </div>
          ) : audienceProfile ? (
            <div className="audience-dashboard">
              <section className="audience-section audience-section-demographics">
                <div className="audience-section-card">
                  <h2 className="visitors-audience-card-title">Demographics</h2>
                  {audienceProfile.newReturningMetrics && (
                    <div className="audience-kpi-row">
                      <div className="audience-kpi-card">
                        <div className="audience-kpi-label">New Users</div>
                        <div className="audience-kpi-value">{audienceProfile.newReturningMetrics.newUsers?.toLocaleString()}</div>
                      </div>
                      <div className="audience-kpi-card">
                        <div className="audience-kpi-label">Returning Users</div>
                        <div className="audience-kpi-value">{audienceProfile.newReturningMetrics.returningUsers?.toLocaleString()}</div>
                      </div>
                      <div className="audience-kpi-card">
                        <div className="audience-kpi-label">Total Users</div>
                        <div className="audience-kpi-value">{audienceProfile.newReturningMetrics.totalUsers?.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                  {audienceProfile.visitorType?.length > 0 && (
                    <>
                      <div className="audience-subheading">New vs returning</div>
                      <div className="table-container">
                        <table className="audience-data-table audience-data-table--clean">
                          <thead><tr><th>Visitor Type</th><th>Users</th><th>Sessions</th><th>Page Views</th></tr></thead>
                          <tbody>
                            {audienceProfile.visitorType.map((v, i) => (
                              <tr key={i}><td>{v.type}</td><td>{v.users?.toLocaleString()}</td><td>{v.sessions?.toLocaleString()}</td><td>{v.pageViews?.toLocaleString()}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {audienceProfile.language?.length > 0 && (
                    <>
                      <div className="audience-subheading">Language</div>
                      <div className="table-container">
                        <table className="audience-data-table audience-data-table--clean">
                          <thead><tr><th>Language</th><th>Users</th><th>Sessions</th><th>Page Views</th></tr></thead>
                          <tbody>
                            {audienceProfile.language.map((lang, i) => (
                              <tr key={i}><td>{lang.language}</td><td>{lang.users?.toLocaleString()}</td><td>{lang.sessions?.toLocaleString()}</td><td>{lang.pageViews?.toLocaleString()}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {audienceProfile.demographics?.ageBrackets?.length > 0 && (
                    <>
                      <div className="audience-subheading">Age</div>
                      <div className="table-container">
                        <table className="audience-data-table audience-data-table--clean">
                          <thead><tr><th>Age Bracket</th><th>Users</th></tr></thead>
                          <tbody>
                            {audienceProfile.demographics.ageBrackets.map((a, i) => (
                              <tr key={i}><td>{a.bracket}</td><td>{a.users?.toLocaleString()}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {audienceProfile.demographics?.genders?.length > 0 && (
                    <>
                      <div className="audience-subheading">Gender</div>
                      <div className="table-container">
                        <table className="audience-data-table audience-data-table--clean">
                          <thead><tr><th>Gender</th><th>Users</th></tr></thead>
                          <tbody>
                            {audienceProfile.demographics.genders.map((g, i) => (
                              <tr key={i}><td>{g.gender}</td><td>{g.users?.toLocaleString()}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {!audienceProfile.visitorType?.length && !audienceProfile.language?.length && !audienceProfile.newReturningMetrics && !audienceProfile.demographics?.ageBrackets?.length && !audienceProfile.demographics?.genders?.length && (
                    <div className="no-data">No demographics data</div>
                  )}
                </div>
              </section>
              <section className="audience-section audience-section-power-users">
                <div className="audience-section-card">
                  <h2 className="visitors-audience-card-title">Power Users</h2>
                  <div className="audience-power-users-controls">
                    <label htmlFor="power-users-date-range-logs">Period:</label>
                    <select
                      id="power-users-date-range-logs"
                      value={powerUsersDateRange}
                      onChange={(e) => setPowerUsersDateRange(e.target.value)}
                      className="audience-power-users-select"
                    >
                      <option value="7daysAgo">Last 7 Days</option>
                      <option value="30daysAgo">Last 30 Days</option>
                      <option value="90daysAgo">Last 90 Days</option>
                    </select>
                  </div>
                  {powerUsersLoading ? (
                    <div className="audience-loading-inline">
                      <div className="spinner"></div>
                      <p>Loading power users...</p>
                    </div>
                  ) : powerUsersError ? (
                    <div className="audience-error-inline"><p>⚠️ {powerUsersError}</p></div>
                  ) : (
                    <div className="table-container audience-power-users-table-container">
                      <table className="audience-data-table audience-data-table--striped">
                        <thead>
                          <tr>
                            <th>Location</th>
                            <th>First</th>
                            <th>Last</th>
                            <th>Sessions</th>
                            <th>Page Views</th>
                            <th>Avg Duration</th>
                            <th>Total Duration</th>
                            <th>Engagement Rate</th>
                            <th>Bounce Rate</th>
                            <th>Active Days</th>
                            <th>Device</th>
                            <th>Source</th>
                            <th>First Page</th>
                          </tr>
                        </thead>
                        <tbody>
                          {powerUsers.length > 0 ? (
                            powerUsers.map((user, index) => (
                              <tr key={index}>
                                <td>{formatPowerUsersLocation(user.city, user.region, user.country)}</td>
                                <td>{formatPowerUsersDate(user.firstVisit)}</td>
                                <td>{formatPowerUsersDate(user.lastVisit)}</td>
                                <td>{formatNumber(user.sessions)}</td>
                                <td>{formatNumber(user.pageViews)}</td>
                                <td>{formatDuration(user.avgSessionDuration)}</td>
                                <td>{formatDuration(user.totalEngagementDuration)}</td>
                                <td>{user.engagementRate?.toFixed(1)}%</td>
                                <td>{user.bounceRate?.toFixed(1)}%</td>
                                <td>{user.uniqueDays}</td>
                                <td>{user.operatingSystem} / {user.browser}</td>
                                <td>{user.sessionSource || "N/A"}</td>
                                <td>{user.landingPage || "N/A"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="13" className="no-data">No power users found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      )}

      {visitorsView === "bots" && (
        <div className="bots-tab-content">
          <header className="bots-tab-header">
            <h1 className="bots-tab-title">Bot analysis</h1>
            <p className="bots-tab-subtitle">Detection rules, heuristics, and sessions flagged as likely automated traffic. Use this to separate bots from real users in your metrics.</p>
          </header>

          {/* Section: Summary */}
          <section className="bots-section" aria-labelledby="bots-summary-heading">
            <h2 id="bots-summary-heading" className="bots-section-title">Summary (current 30-day data)</h2>
            <div className="bots-summary-cards">
              <div className="bots-summary-card">
                <span className="bots-summary-label">Total sessions (visitors)</span>
                <span className="bots-summary-value">{formatNumber(botAnalysis.summary.totalSessions)}</span>
              </div>
              <div className="bots-summary-card bots-summary-card--flagged">
                <span className="bots-summary-label">Sessions flagged as likely bots</span>
                <span className="bots-summary-value">{formatNumber(botAnalysis.summary.flaggedAsBot)}</span>
              </div>
              <div className="bots-summary-card">
                <span className="bots-summary-label">Percentage of traffic flagged</span>
                <span className="bots-summary-value">{botAnalysis.summary.percentFlagged}%</span>
              </div>
              <div className="bots-summary-card">
                <span className="bots-summary-label">Flagged by browser (known crawler)</span>
                <span className="bots-summary-value">{formatNumber(botAnalysis.summary.byBrowserOnly)}</span>
              </div>
              <div className="bots-summary-card">
                <span className="bots-summary-label">Flagged by behavior only (short, 1 page)</span>
                <span className="bots-summary-value">{formatNumber(botAnalysis.summary.byBehavioralOnly)}</span>
              </div>
            </div>
          </section>

          {/* Section: Detection methods */}
          <section className="bots-section" aria-labelledby="bots-methods-heading">
            <h2 id="bots-methods-heading" className="bots-section-title">Detection methods used</h2>
            <div className="bots-methods-list">
              <div className="bots-method-item">
                <h3 className="bots-method-name">1. Known crawler / User-Agent (browser dimension)</h3>
                <p className="bots-method-desc">Sessions where the GA4 &quot;browser&quot; dimension matches a known bot or crawler string (e.g. Googlebot, Bingbot, curl, headless Chrome). This uses server-side reporting; GA4 may already filter some crawlers.</p>
              </div>
              <div className="bots-method-item">
                <h3 className="bots-method-name">2. Behavioral heuristics</h3>
                <p className="bots-method-desc">Sessions with <strong>duration ≤ {BOT_BEHAVIORAL_MAX_DURATION_SEC} seconds</strong> and <strong>page views ≤ {BOT_BEHAVIORAL_MAX_PAGE_VIEWS}</strong> are flagged as suspicious. Real users often scroll or view multiple pages; many bots hit one page and leave quickly.</p>
              </div>
            </div>
          </section>

          {/* Section: Known crawler rules */}
          <section className="bots-section" aria-labelledby="bots-crawler-rules-heading">
            <h2 id="bots-crawler-rules-heading" className="bots-section-title">Known crawler / bot browser patterns (matched against GA4 &quot;browser&quot;)</h2>
            <p className="bots-section-note">A session is flagged if its browser string (case-insensitive) contains any of the following.</p>
            <div className="bots-patterns-grid">
              {KNOWN_BOT_BROWSER_PATTERNS.map((p, i) => (
                <span key={i} className="bots-pattern-tag">{p}</span>
              ))}
            </div>
          </section>

          {/* Section: Behavioral thresholds */}
          <section className="bots-section" aria-labelledby="bots-behavioral-heading">
            <h2 id="bots-behavioral-heading" className="bots-section-title">Behavioral heuristics: thresholds</h2>
            <table className="bots-thresholds-table">
              <thead>
                <tr>
                  <th>Rule name</th>
                  <th>Condition</th>
                  <th>Current value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Maximum session duration (seconds)</td>
                  <td>Session duration ≤ this value</td>
                  <td>{BOT_BEHAVIORAL_MAX_DURATION_SEC} sec</td>
                </tr>
                <tr>
                  <td>Maximum page views</td>
                  <td>Page views per session ≤ this value</td>
                  <td>{BOT_BEHAVIORAL_MAX_PAGE_VIEWS} page(s)</td>
                </tr>
              </tbody>
            </table>
            <p className="bots-section-note">Sessions that satisfy <strong>both</strong> conditions are flagged as likely bots (behavioral). You can adjust these in code if needed.</p>
          </section>

          {/* Section: Sessions flagged by known browser */}
          <section className="bots-section" aria-labelledby="bots-by-browser-heading">
            <h2 id="bots-by-browser-heading" className="bots-section-title">Sessions flagged by known crawler (browser)</h2>
            <p className="bots-section-note">Sessions whose reported browser matches one of the known bot patterns above.</p>
            {botAnalysis.byBrowser.length > 0 ? (
              <div className="bots-table-wrapper">
                <table className="bots-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Browser</th>
                      <th>Location</th>
                      <th>Page views</th>
                      <th>Duration (sec)</th>
                      <th>Landing page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botAnalysis.byBrowser.map((v, i) => (
                      <tr key={v.id || i}>
                        <td>{formatDate(v.date)}</td>
                        <td>{formatTime(v.hour)}</td>
                        <td>{v.sessionSource || "N/A"}</td>
                        <td>{v.browser || "N/A"}</td>
                        <td>{formatLocation(v.city, v.region, v.country)}</td>
                        <td>{formatNumber(v.pageViews)}</td>
                        <td>{(Number(v.totalDuration) || 0).toFixed(0)}</td>
                        <td className="bots-cell-landing">{v.landingPage || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="bots-no-data">No sessions in this period were flagged by known crawler/browser. GA4 may already filter major crawlers, or your traffic has none.</p>
            )}
          </section>

          {/* Section: Sessions flagged by behavior only */}
          <section className="bots-section" aria-labelledby="bots-by-behavior-heading">
            <h2 id="bots-by-behavior-heading" className="bots-section-title">Sessions flagged by behavior only (short, single page)</h2>
            <p className="bots-section-note">Sessions that meet the duration and page-view thresholds and were not already flagged by browser. May include real users who bounced quickly.</p>
            {botAnalysis.byBehavioral.filter((b) => !botAnalysis.byBrowser.some((x) => x.id === b.id)).length > 0 ? (
              <div className="bots-table-wrapper">
                <table className="bots-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Browser</th>
                      <th>Location</th>
                      <th>Page views</th>
                      <th>Duration (sec)</th>
                      <th>Landing page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botAnalysis.byBehavioral.filter((b) => !botAnalysis.byBrowser.some((x) => x.id === b.id)).map((v, i) => (
                      <tr key={v.id || i}>
                        <td>{formatDate(v.date)}</td>
                        <td>{formatTime(v.hour)}</td>
                        <td>{v.sessionSource || "N/A"}</td>
                        <td>{v.browser || "N/A"}</td>
                        <td>{formatLocation(v.city, v.region, v.country)}</td>
                        <td>{formatNumber(v.pageViews)}</td>
                        <td>{(Number(v.totalDuration) || 0).toFixed(0)}</td>
                        <td className="bots-cell-landing">{v.landingPage || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="bots-no-data">No sessions in this period were flagged by behavior only (or all behavioral matches were already flagged by browser).</p>
            )}
          </section>

          {/* Section: All flagged sessions (combined) */}
          <section className="bots-section" aria-labelledby="bots-combined-heading">
            <h2 id="bots-combined-heading" className="bots-section-title">All sessions flagged as likely bots (combined)</h2>
            <p className="bots-section-note">Union of sessions flagged by known crawler (browser) or by behavioral heuristics. Use this list to exclude from &quot;human-only&quot; metrics.</p>
            {botAnalysis.combined.length > 0 ? (
              <div className="bots-table-wrapper">
                <table className="bots-data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Browser</th>
                      <th>Location</th>
                      <th>Page views</th>
                      <th>Duration (sec)</th>
                      <th>Landing page</th>
                      <th>Flag reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botAnalysis.combined.map((v, i) => {
                      const fromBrowser = botAnalysis.byBrowser.some((b) => b.id === v.id);
                      const reason = fromBrowser ? "Known crawler (browser)" : "Short session, single page";
                      return (
                        <tr key={v.id || i}>
                          <td>{formatDate(v.date)}</td>
                          <td>{formatTime(v.hour)}</td>
                          <td>{v.sessionSource || "N/A"}</td>
                          <td>{v.browser || "N/A"}</td>
                          <td>{formatLocation(v.city, v.region, v.country)}</td>
                          <td>{formatNumber(v.pageViews)}</td>
                          <td>{(Number(v.totalDuration) || 0).toFixed(0)}</td>
                          <td className="bots-cell-landing">{v.landingPage || "—"}</td>
                          <td className="bots-cell-reason">{reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="bots-no-data">No sessions in this period were flagged. Your traffic may be mostly human, or thresholds may need tuning.</p>
            )}
          </section>

          {/* Section: Recommendations */}
          <section className="bots-section" aria-labelledby="bots-recommendations-heading">
            <h2 id="bots-recommendations-heading" className="bots-section-title">Recommendations</h2>
            <ul className="bots-recommendations-list">
              <li><strong>Exclude flagged sessions from KPIs:</strong> When reporting &quot;real users&quot; or &quot;human traffic&quot;, exclude the sessions listed above (or use a &quot;human-only&quot; segment in GA4).</li>
              <li><strong>Log raw User-Agent server-side:</strong> GA4 does not expose full User-Agent in all reports. Logging UA on your server (e.g. in middleware) lets you run stricter bot rules (e.g. JA3 fingerprint, more crawler lists).</li>
              <li><strong>Behavioral thresholds:</strong> The current duration (≤3 sec) and page-view (≤1) rules can be tuned in code. Consider excluding only &quot;0 sec + 1 page&quot; if you want to avoid flagging fast bounces.</li>
              <li><strong>CAPTCHA or challenges:</strong> For sensitive actions, use a CAPTCHA or managed bot solution (e.g. Cloudflare Bot Management, Turnstile) to block or challenge suspected bots.</li>
              <li><strong>Rate limiting:</strong> Apply rate limits by IP or session on API or form endpoints to reduce automated abuse.</li>
            </ul>
          </section>
        </div>
      )}

      {visitorsView === "sources" && (
        <div className="visitors-sources-content traffic-sources-page">
          <div className="sources-multi-row-toggle">
            <div className="sources-toggle-row">
              <span className="sources-toggle-row-label">Overview</span>
              <button
                type="button"
                className={`sources-toggle-chip ${selectedSource === null ? "active" : ""}`}
                onClick={() => setSelectedSource(null)}
              >
                All traffic
              </button>
            </div>
            {SOURCE_GROUPS.map((group) => (
              <div key={group.label} className="sources-toggle-row">
                <span className="sources-toggle-row-label">{group.label}</span>
                <div className="sources-toggle-chips">
                  {group.sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className={`sources-toggle-chip ${selectedSource === source.id ? "active" : ""}`}
                      onClick={() => setSelectedSource(source.id)}
                    >
                      <img
                        src={source.logo}
                        alt=""
                        className="sources-toggle-chip-logo"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <span>{source.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {selectedSource === "google" && (
            <div className="sources-embedded-content sources-embedded-google">
              <PageRankings />
            </div>
          )}

          {selectedSource === "chatgpt" && (
            <div className="sources-embedded-content sources-embedded-llm">
              <div className="card source-analysis-card">
                <h2 className="source-analysis-title">ChatGPT traffic</h2>
                <p className="source-analysis-subtitle">Traffic where session source contains chatgpt or openai, for the selected date range.</p>
                {sourceAnalysisLoading && (
                  <div className="source-analysis-loading">
                    <div className="spinner"></div>
                    <p>Loading ChatGPT traffic analysis...</p>
                  </div>
                )}
                {sourceAnalysisError && !sourceAnalysis && (
                  <div className="source-analysis-error">
                    <p>⚠️ {sourceAnalysisError}</p>
                  </div>
                )}
                {!sourceAnalysisLoading && sourceAnalysis?.summary && (
                  <>
                    <h3 className="source-analysis-section-heading">Summary</h3>
                    <div className="source-analysis-metrics">
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Sessions</span>
                        <span className="source-analysis-metric-value">{formatNumber(sourceAnalysis.summary.sessions)}</span>
                      </div>
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Users</span>
                        <span className="source-analysis-metric-value">{formatNumber(sourceAnalysis.summary.activeUsers)}</span>
                      </div>
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Page views</span>
                        <span className="source-analysis-metric-value">{formatNumber(sourceAnalysis.summary.screenPageViews)}</span>
                      </div>
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Avg. session duration</span>
                        <span className="source-analysis-metric-value">{formatDuration(sourceAnalysis.summary.averageSessionDuration)}</span>
                      </div>
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Bounce rate</span>
                        <span className="source-analysis-metric-value">{sourceAnalysis.summary.bounceRate?.toFixed(1)}%</span>
                      </div>
                      <div className="source-analysis-metric">
                        <span className="source-analysis-metric-label">Engaged sessions</span>
                        <span className="source-analysis-metric-value">{formatNumber(sourceAnalysis.summary.engagedSessions)}</span>
                      </div>
                    </div>
                    {sourceAnalysis.topLandingPages?.length > 0 && (
                      <>
                        <h3 className="source-analysis-section-heading">Top landing pages from ChatGPT</h3>
                        <div className="source-analysis-table-wrap">
                          <table className="source-analysis-table">
                            <thead>
                              <tr>
                                <th>Landing page</th>
                                <th>Sessions</th>
                                <th>Page views</th>
                                <th>Avg. duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sourceAnalysis.topLandingPages.map((row, i) => (
                                <tr key={i}>
                                  <td className="source-analysis-page-cell" title={row.landingPage}>{stripSiteNameFromTitle(row.landingPage || "")}</td>
                                  <td>{formatNumber(row.sessions)}</td>
                                  <td>{formatNumber(row.screenPageViews)}</td>
                                  <td>{formatDuration(row.averageSessionDuration)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {sourceAnalysis.summary.sessions === 0 && (
                      <p className="source-analysis-no-data">No ChatGPT traffic in this period.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          {selectedSource && ["claude", "perplexity"].includes(selectedSource) && (
            <div className="sources-embedded-content sources-embedded-llm">
              <div className="card">
                <h2>LLM traffic</h2>
                <p>LLM traffic and engagement metrics for this source are coming soon.</p>
              </div>
            </div>
          )}

          {selectedSource && ["facebook", "twitter", "instagram", "linkedin", "pinterest", "tiktok", "reddit", "youtube"].includes(selectedSource) && (
            <div className="sources-embedded-content sources-embedded-social">
              <div className="card">
                <h2>Social media traffic</h2>
                <p>Social media traffic and engagement metrics for this source are coming soon.</p>
              </div>
            </div>
          )}

          {selectedSource && ["bing", "yahoo", "duckduckgo"].includes(selectedSource) && (
            <div className="sources-embedded-content">
              <div className="card">
                <h2>Search engine traffic</h2>
                <p>Detailed metrics for this search engine are coming soon. For now, use &quot;All traffic&quot; to see attribution data.</p>
              </div>
            </div>
          )}

          {selectedSource === null && (
            <>
          {trafficSourcesLoading && !trafficSourcesData ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading traffic sources...</p>
            </div>
          ) : trafficSourcesError && !trafficSourcesData ? (
            <div className="traffic-sources-card">
              <div className="traffic-sources-error-message">
                <h3>⚠️ Error Loading Traffic Sources</h3>
                <p>{trafficSourcesError}</p>
              </div>
            </div>
          ) : trafficSourcesData ? (
            <>
              <div className="sources-traffic-row">
                <div className="sources-chart-col">
                  {trafficSourcesChartLoading ? (
                    <div className="sources-chart-loading"><div className="spinner"></div><p>Loading chart...</p></div>
                  ) : (() => {
                    const raw7 = trafficSourcesByPeriod["7daysAgo"]?.sessionSources || [];
                    const raw30 = trafficSourcesByPeriod["30daysAgo"]?.sessionSources || [];
                    const raw90 = trafficSourcesByPeriod["90daysAgo"]?.sessionSources || [];
                    const d7 = mergeSessionSourcesByCanonical(raw7);
                    const d30 = mergeSessionSourcesByCanonical(raw30);
                    const d90 = mergeSessionSourcesByCanonical(raw90);
                    const total7 = d7.reduce((s, x) => s + (x.sessions || 0), 0);
                    const total30 = d30.reduce((s, x) => s + (x.sessions || 0), 0);
                    const total90 = d90.reduce((s, x) => s + (x.sessions || 0), 0);
                    if (total7 + total30 + total90 === 0) {
                      return <p className="traffic-sources-text-muted">No source data</p>;
                    }
                    const allSources = [...new Set([...d7.map((x) => x.source), ...d30.map((x) => x.source), ...d90.map((x) => x.source)])];
                    const bySource30 = Object.fromEntries(d30.map((x) => [x.source, x.sessions || 0]));
                    const sourceOrder = allSources.sort((a, b) => (bySource30[b] || 0) - (bySource30[a] || 0));
                    const legendSources = total30 > 0
                      ? sourceOrder.filter((src) => ((bySource30[src] || 0) / total30) > 0.01)
                      : sourceOrder;
                    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];
                    const byPeriod = (list) => Object.fromEntries((list || []).map((x) => [x.source || "(not set)", x.sessions || 0]));
                    const p7 = byPeriod(d7);
                    const p30 = byPeriod(d30);
                    const p90 = byPeriod(d90);
                    const periodTotals = [total7, total30, total90];
                    const barHeight = 220;
                    const barWidth = 88;
                    const gap = 40;
                    const axisWidth = 36;
                    const chartWidth = axisWidth + 3 * barWidth + 2 * gap + gap;
                    const chartHeight = barHeight + 24;
                    const yTicks = [100, 75, 50, 25, 0];
                    return (
                      <>
                        <h3 className="sources-chart-title">Percent</h3>
                        <div className="sources-chart-and-legend">
                          <div className="sources-stacked-chart-wrap">
                            <svg className="sources-stacked-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
                              {/* Y-axis line */}
                              <line x1={axisWidth} y1={0} x2={axisWidth} y2={barHeight} stroke="#e5e7eb" strokeWidth="1" />
                              {/* Y-axis labels (0% at bottom, 100% at top) */}
                              {yTicks.map((pct) => {
                                const y = (1 - pct / 100) * barHeight;
                                return (
                                  <g key={pct}>
                                    <line x1={axisWidth} y1={y} x2={axisWidth + 4} y2={y} stroke="#9ca3af" strokeWidth="1" />
                                    <text x={axisWidth - 4} y={y + 4} textAnchor="end" dominantBaseline="middle" className="sources-chart-axis-label">{pct}%</text>
                                  </g>
                                );
                              })}
                              {[p7, p30, p90].map((data, barIndex) => {
                                let y = barHeight;
                                const x = axisWidth + gap / 2 + barIndex * (barWidth + gap);
                                const periodTotal = periodTotals[barIndex] || 1;
                                return sourceOrder.map((src, segIndex) => {
                                  const sessions = data[src] || 0;
                                  if (sessions === 0) return null;
                                  const h = (sessions / periodTotal) * barHeight;
                                  y -= h;
                                  return (
                                    <rect
                                      key={`${barIndex}-${src}`}
                                      x={x}
                                      y={y}
                                      width={barWidth}
                                      height={Math.max(h, 0.5)}
                                      fill={colors[segIndex % colors.length]}
                                      className="sources-stacked-segment"
                                    />
                                  );
                                });
                              })}
                              {/* Period labels under each bar */}
                              {["7D", "30D", "90D"].map((label, i) => {
                                const barCenterX = axisWidth + gap / 2 + i * (barWidth + gap) + barWidth / 2;
                                return (
                                  <text key={label} x={barCenterX} y={chartHeight - 6} textAnchor="middle" className="sources-stacked-label-svg">{label}</text>
                                );
                              })}
                            </svg>
                          </div>
                          <div className="sources-pie-legend sources-stacked-legend">
                            {legendSources.map((src) => {
                              const label = src;
                              const colorIndex = sourceOrder.indexOf(src);
                              return (
                                <div key={src} className="sources-pie-legend-item">
                                  <span className="sources-pie-legend-dot" style={{ backgroundColor: colors[colorIndex % colors.length] }} />
                                  <span className="sources-pie-legend-label" title={label}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="sources-table-col">
              <div className="traffic-sources-summary-stats">
                <div className="traffic-summary-card">
                  <div className="traffic-summary-label">Total Sources</div>
                  <div className="traffic-summary-value">
                    {(trafficSourcesData.sessionSources || []).length}
                  </div>
                </div>
                <div className="traffic-summary-card">
                  <div className="traffic-summary-label">Total Sessions</div>
                  <div className="traffic-summary-value">
                    {formatNumber((trafficSourcesData.sessionSources || []).reduce((sum, s) => sum + (s.sessions || 0), 0))}
                  </div>
                </div>
                <div className="traffic-summary-card">
                  <div className="traffic-summary-label">Total Users</div>
                  <div className="traffic-summary-value">
                    {formatNumber((trafficSourcesData.sessionSources || []).reduce((sum, s) => sum + (s.users || 0), 0))}
                  </div>
                </div>
              </div>
              <div className="traffic-sources-card">
                  <div className="traffic-sources-data-table">
                    {(trafficSourcesData.sessionSources || []).length > 0 ? (
                      <table>
                        <thead>
                          <tr>
                            <th>Source</th>
                            <th>Medium</th>
                            <th>Channel Group</th>
                            <th>Sessions</th>
                            <th>Users</th>
                            <th>Sessions %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(trafficSourcesData.sessionSources || []).map((source, index) => {
                            const totalSessions = (trafficSourcesData.sessionSources || []).reduce((sum, s) => sum + (s.sessions || 0), 0);
                            const sessionsPercent = totalSessions > 0 ? ((source.sessions / totalSessions) * 100).toFixed(1) : "0.0";
                            return (
                              <tr key={index}>
                                <td>
                                  <div className="traffic-sources-source-with-favicon">
                                    <img
                                      src={`https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${source.source}&size=32`}
                                      alt=""
                                      className="traffic-sources-source-favicon"
                                      onError={(e) => { e.target.style.display = "none"; }}
                                    />
                                    <span>{source.source}</span>
                                  </div>
                                </td>
                                <td><span className="traffic-sources-medium-badge">{source.medium}</span></td>
                                <td><span className="traffic-sources-channel-badge">{source.channelGroup}</span></td>
                                <td className="traffic-sources-number-cell">{formatNumber(source.sessions)}</td>
                                <td className="traffic-sources-number-cell">{formatNumber(source.users)}</td>
                                <td className="traffic-sources-number-cell">
                                  <div className="traffic-sources-percentage-cell">
                                    <span>{sessionsPercent}%</span>
                                    <div className="traffic-sources-percentage-bar">
                                      <div className="traffic-sources-percentage-fill" style={{ width: `${sessionsPercent}%` }}></div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="traffic-sources-text-muted">No traffic source data available</p>
                    )}
                  </div>
                </div>
              </div>
              </div>
            </>
          ) : null}
            </>
          )}
        </div>
      )}

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

