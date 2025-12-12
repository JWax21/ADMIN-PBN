import { google } from "googleapis";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the analytics client from googleAnalytics.js
// We'll import it dynamically to avoid circular dependencies
let analyticsDataClient = null;

/**
 * Get the analytics client
 */
const getAnalyticsClient = () => {
  if (analyticsDataClient) {
    return analyticsDataClient;
  }

  try {
    const GA_PROPERTY_ID = process.env.GA_PROPERTY_ID;
    const GA_SERVICE_ACCOUNT_BASE64 = process.env.GA_SERVICE_ACCOUNT_BASE64;
    const GA_KEY_FILE = process.env.GA_KEY_FILE_PATH;

    if (!GA_PROPERTY_ID) {
      throw new Error("GA_PROPERTY_ID not set");
    }

    let credentials;
    
    if (GA_SERVICE_ACCOUNT_BASE64) {
      const decoded = Buffer.from(GA_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
      credentials = JSON.parse(decoded);
    } else if (GA_KEY_FILE) {
      const keyFilePath = join(__dirname, "..", GA_KEY_FILE);
      credentials = JSON.parse(readFileSync(keyFilePath, "utf8"));
    } else {
      throw new Error("No GA credentials available");
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    analyticsDataClient = google.analyticsdata({
      version: "v1beta",
      auth,
    });

    return analyticsDataClient;
  } catch (error) {
    console.error("Error initializing analytics client:", error);
    return null;
  }
};

/**
 * Get shopping referral events (Shop button clicks)
 * @param {string} startDate - Start date in YYYY-MM-DD format or relative like "30daysAgo"
 * @param {string} endDate - End date in YYYY-MM-DD format or "today"
 * @returns {Object} Shopping sessions data with events and summary
 */
export const getShoppingSessions = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  const analyticsDataClient = getAnalyticsClient();
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Query for "Shopping Referral" events with detailed dimensions
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "eventName" },
          { name: "pagePath" },
          { name: "pageTitle" },
          { name: "country" },
          { name: "region" },
          { name: "city" },
          { name: "deviceCategory" },
          { name: "browser" },
          { name: "operatingSystem" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "newVsReturning" },
        ],
        metrics: [
          { name: "eventCount" },
          { name: "activeUsers" },
          { name: "sessions" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: {
              matchType: "EXACT",
              value: "Shopping Referral",
            },
          },
        },
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
            desc: true,
          },
        ],
        limit: 10000, // Get up to 10,000 events
      },
    });

    // Process the response
    const events = [];
    let totalEvents = 0;
    let totalUsers = 0;
    let totalSessions = 0;

    if (response.data.rows) {
      response.data.rows.forEach((row) => {
        const date = row.dimensionValues[0].value;
        const eventName = row.dimensionValues[1].value;
        const pagePath = row.dimensionValues[2].value;
        const pageTitle = row.dimensionValues[3].value;
        const country = row.dimensionValues[4].value;
        const region = row.dimensionValues[5].value;
        const city = row.dimensionValues[6].value;
        const deviceCategory = row.dimensionValues[7].value;
        const browser = row.dimensionValues[8].value;
        const operatingSystem = row.dimensionValues[9].value;
        const sessionSource = row.dimensionValues[10].value;
        const sessionMedium = row.dimensionValues[11].value;
        const newVsReturning = row.dimensionValues[12].value;

        const eventCount = parseInt(row.metricValues[0].value) || 0;
        const activeUsers = parseInt(row.metricValues[1].value) || 0;
        const sessions = parseInt(row.metricValues[2].value) || 0;

        // Try to extract brand and flavor from pagePath or pageTitle
        // Page paths are like: /reviews/brand-name/flavor-name
        let brandName = "";
        let flavorName = "";
        
        if (pagePath) {
          const pathParts = pagePath.split("/").filter(Boolean);
          if (pathParts.length >= 3 && pathParts[0] === "reviews") {
            brandName = pathParts[1]?.replace(/-/g, " ") || "";
            flavorName = pathParts[2]?.replace(/-/g, " ") || "";
          }
        }

        // If we can't extract from path, try pageTitle
        if (!brandName && pageTitle) {
          // Page titles might be like "Brand Name Flavor Name Review"
          const titleParts = pageTitle.split(" ");
          if (titleParts.length >= 2) {
            brandName = titleParts[0] || "";
            flavorName = titleParts.slice(1, -1).join(" ") || ""; // Remove "Review" at the end
          }
        }

        events.push({
          date,
          eventName,
          pagePath,
          pageTitle,
          brandName: brandName || "Unknown",
          flavorName: flavorName || "Unknown",
          country,
          region,
          city,
          deviceCategory,
          browser,
          operatingSystem,
          sessionSource,
          sessionMedium,
          newVsReturning,
          eventCount,
          activeUsers,
          sessions,
        });

        totalEvents += eventCount;
        totalUsers += activeUsers;
        totalSessions += sessions;
      });
    }

    // Get summary statistics by different dimensions
    const summaryByBrand = {};
    const summaryByFlavor = {};
    const summaryByCountry = {};
    const summaryByDevice = {};
    const summaryByDate = {};

    events.forEach((event) => {
      // By brand
      if (!summaryByBrand[event.brandName]) {
        summaryByBrand[event.brandName] = {
          brandName: event.brandName,
          eventCount: 0,
          users: 0,
          sessions: 0,
        };
      }
      summaryByBrand[event.brandName].eventCount += event.eventCount;
      summaryByBrand[event.brandName].users += event.activeUsers;
      summaryByBrand[event.brandName].sessions += event.sessions;

      // By flavor (combine brand + flavor)
      const flavorKey = `${event.brandName} - ${event.flavorName}`;
      if (!summaryByFlavor[flavorKey]) {
        summaryByFlavor[flavorKey] = {
          brandName: event.brandName,
          flavorName: event.flavorName,
          eventCount: 0,
          users: 0,
          sessions: 0,
        };
      }
      summaryByFlavor[flavorKey].eventCount += event.eventCount;
      summaryByFlavor[flavorKey].users += event.activeUsers;
      summaryByFlavor[flavorKey].sessions += event.sessions;

      // By country
      if (!summaryByCountry[event.country]) {
        summaryByCountry[event.country] = {
          country: event.country,
          eventCount: 0,
          users: 0,
          sessions: 0,
        };
      }
      summaryByCountry[event.country].eventCount += event.eventCount;
      summaryByCountry[event.country].users += event.activeUsers;
      summaryByCountry[event.country].sessions += event.sessions;

      // By device
      if (!summaryByDevice[event.deviceCategory]) {
        summaryByDevice[event.deviceCategory] = {
          deviceCategory: event.deviceCategory,
          eventCount: 0,
          users: 0,
          sessions: 0,
        };
      }
      summaryByDevice[event.deviceCategory].eventCount += event.eventCount;
      summaryByDevice[event.deviceCategory].users += event.activeUsers;
      summaryByDevice[event.deviceCategory].sessions += event.sessions;

      // By date
      if (!summaryByDate[event.date]) {
        summaryByDate[event.date] = {
          date: event.date,
          eventCount: 0,
          users: 0,
          sessions: 0,
        };
      }
      summaryByDate[event.date].eventCount += event.eventCount;
      summaryByDate[event.date].users += event.activeUsers;
      summaryByDate[event.date].sessions += event.sessions;
    });

    return {
      events,
      summary: {
        totalEvents,
        totalUsers,
        totalSessions,
        byBrand: Object.values(summaryByBrand).sort(
          (a, b) => b.eventCount - a.eventCount
        ),
        byFlavor: Object.values(summaryByFlavor).sort(
          (a, b) => b.eventCount - a.eventCount
        ),
        byCountry: Object.values(summaryByCountry).sort(
          (a, b) => b.eventCount - a.eventCount
        ),
        byDevice: Object.values(summaryByDevice).sort(
          (a, b) => b.eventCount - a.eventCount
        ),
        byDate: Object.values(summaryByDate).sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        ),
      },
    };
  } catch (error) {
    console.error("Error fetching shopping sessions:", error);
    throw error;
  }
};

