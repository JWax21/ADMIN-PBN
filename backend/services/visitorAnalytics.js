import { getAnalyticsClient } from "./googleAnalytics.js";

// Reuse the analytics client from googleAnalytics
const getClient = () => {
  const client = getAnalyticsClient();
  if (!client) {
    throw new Error("Analytics client not initialized");
  }
  return client;
};

/**
 * Get list of visitors/sessions with key information
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getVisitorsList = async (
  startDate = "30daysAgo",
  endDate = "today",
  limit = 100
) => {
  const analyticsDataClient = getClient();
  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Get sessions with user and device information
    // Note: GA4 doesn't support sessionId/clientId as dimensions
    // We'll use a combination of dimensions to create a unique identifier
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: "date" },
          { name: "deviceCategory" },
          { name: "operatingSystem" },
          { name: "browser" },
          { name: "country" },
          { name: "region" },
          { name: "city" },
          { name: "newVsReturning" },
          { name: "sessionSource" }, // Current session source
        ],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "userEngagementDuration" },
          { name: "engagedSessions" },
          { name: "bounceRate" },
          { name: "activeUsers" },
        ],
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
            desc: true,
          },
        ],
        limit,
      },
    });

    return (
      response.data.rows?.map((row, index) => {
        const dimensions = row.dimensionValues;
        const metrics = row.metricValues;

        // Create a composite ID from available dimensions
        // Format: date-deviceCategory-operatingSystem-browser-country-region-city-newVsReturning-sessionSource-index
        const compositeId = `${dimensions[0].value}-${dimensions[1].value}-${
          dimensions[2].value
        }-${dimensions[3].value}-${dimensions[4].value}-${
          dimensions[5].value || "none"
        }-${dimensions[6].value || "none"}-${dimensions[7].value}-${
          dimensions[8].value || "none"
        }-${index}`;

        return {
          id: compositeId, // Composite identifier
          date: dimensions[0].value,
          deviceCategory: dimensions[1].value,
          deviceBrand: "N/A", // Removed to stay within 9-dimension limit
          deviceModel: "N/A", // Removed to stay within 9-dimension limit
          operatingSystem: dimensions[2].value,
          browser: dimensions[3].value,
          country: dimensions[4].value,
          region: dimensions[5].value || "N/A",
          city: dimensions[6].value || "N/A",
          newVsReturning: dimensions[7].value,
          sessionSource: dimensions[8].value || "N/A", // Current session source
          firstUserSource: "N/A", // Removed to stay within 9-dimension limit - only showing current source
          sessions: parseInt(metrics[0].value),
          pageViews: parseInt(metrics[1].value),
          avgSessionDuration: parseFloat(metrics[2].value),
          totalDuration: parseFloat(metrics[3].value), // Total engagement duration in seconds
          engagedSessions: parseInt(metrics[4].value),
          bounceRate: parseFloat(metrics[5].value) * 100,
          activeUsers: parseInt(metrics[6].value),
        };
      }) || []
    );
  } catch (error) {
    console.error("Error fetching visitors list:", error);
    throw error;
  }
};

/**
 * Get detailed information about a specific visitor/session
 * @param {string} visitorId - Composite visitor ID from the list
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getVisitorDetails = async (
  visitorId,
  startDate = "30daysAgo",
  endDate = "today"
) => {
  const analyticsDataClient = getClient();
  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Parse the composite ID to extract filter values
    // Format: date-deviceCategory-operatingSystem-browser-country-region-city-newVsReturning-sessionSource-index
    const parts = visitorId.split("-");
    const date = parts[0];
    const deviceCategory = parts[1];
    const operatingSystem = parts[2];
    const browser = parts[3];
    const country = parts[4];
    const region = parts[5] !== "none" ? parts[5] : null;
    const city = parts[6] !== "none" ? parts[6] : null;
    const newVsReturning = parts[7];
    const sessionSource = parts[8] !== "none" ? parts[8] : null;

    // Build dimension filters - limit to essential filters to stay under 9 dimension limit
    // Note: GA4 counts dimension filters toward the 9-dimension limit
    const dimensionFilter = {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "date",
              stringFilter: {
                matchType: "EXACT",
                value: date,
              },
            },
          },
          {
            filter: {
              fieldName: "deviceCategory",
              stringFilter: {
                matchType: "EXACT",
                value: deviceCategory,
              },
            },
          },
          {
            filter: {
              fieldName: "operatingSystem",
              stringFilter: {
                matchType: "EXACT",
                value: operatingSystem,
              },
            },
          },
          {
            filter: {
              fieldName: "browser",
              stringFilter: {
                matchType: "EXACT",
                value: browser,
              },
            },
          },
          {
            filter: {
              fieldName: "country",
              stringFilter: {
                matchType: "EXACT",
                value: country,
              },
            },
          },
          ...(region
            ? [
                {
                  filter: {
                    fieldName: "region",
                    stringFilter: {
                      matchType: "EXACT",
                      value: region,
                    },
                  },
                },
              ]
            : []),
          ...(city
            ? [
                {
                  filter: {
                    fieldName: "city",
                    stringFilter: {
                      matchType: "EXACT",
                      value: city,
                    },
                  },
                },
              ]
            : []),
          {
            filter: {
              fieldName: "newVsReturning",
              stringFilter: {
                matchType: "EXACT",
                value: newVsReturning,
              },
            },
          },
          ...(sessionSource
            ? [
                {
                  filter: {
                    fieldName: "sessionSource",
                    stringFilter: {
                      matchType: "EXACT",
                      value: sessionSource,
                    },
                  },
                },
              ]
            : []),
        ],
      },
    };

    // Get detailed session information
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
          { name: "date" },
          { name: "deviceCategory" },
          { name: "operatingSystem" },
          { name: "browser" },
          { name: "country" },
          { name: "region" },
          { name: "city" },
          { name: "sessionSource" },
          { name: "newVsReturning" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "engagedSessions" },
          { name: "bounceRate" },
          { name: "eventCount" },
        ],
        dimensionFilter,
        limit: 100,
      },
    });

    // Get device and technology details
    // Note: mobileDeviceBranding and mobileDeviceModel only work for mobile devices
    let deviceDetailsResponse = null;
    try {
      deviceDetailsResponse = await analyticsDataClient.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [
            { name: "screenResolution" },
            { name: "mobileDeviceBranding" },
            { name: "mobileDeviceModel" },
            { name: "browser" },
            { name: "operatingSystem" },
            { name: "operatingSystemVersion" },
          ],
          metrics: [{ name: "sessions" }],
          dimensionFilter,
          limit: 1,
        },
      });
    } catch (deviceError) {
      // If mobile device dimensions fail, try without them (for desktop devices)
      console.warn(
        "Mobile device dimensions not available, trying alternative query:",
        deviceError.message
      );
      try {
        deviceDetailsResponse = await analyticsDataClient.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [
              {
                startDate,
                endDate,
              },
            ],
            dimensions: [
              { name: "screenResolution" },
              { name: "browser" },
              { name: "operatingSystem" },
              { name: "operatingSystemVersion" },
            ],
            metrics: [{ name: "sessions" }],
            dimensionFilter,
            limit: 1,
          },
        });
      } catch (altError) {
        console.warn("Alternative device query also failed:", altError.message);
        deviceDetailsResponse = null;
      }
    }

    // Get pageviews with detailed metrics
    const pageviewsResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: "pagePath" },
          { name: "pageTitle" },
          { name: "hostName" },
          { name: "date" },
          { name: "hour" },
        ],
        metrics: [
          { name: "screenPageViews" },
          { name: "userEngagementDuration" },
          { name: "averageSessionDuration" },
          { name: "eventCount" },
        ],
        dimensionFilter,
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
            desc: true,
          },
        ],
        limit: 100,
      },
    });

    // Get scroll depth events for pages (custom event tracking)
    const scrollEventsResponse = await analyticsDataClient.properties.runReport(
      {
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [{ name: "pagePath" }, { name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            andGroup: {
              expressions: [
                ...dimensionFilter.andGroup.expressions,
                {
                  filter: {
                    fieldName: "eventName",
                    stringFilter: {
                      matchType: "CONTAINS",
                      value: "scroll",
                    },
                  },
                },
              ],
            },
          },
          limit: 100,
        },
      }
    );

    // Get events for this client
    const eventsResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: "eventName" },
          { name: "date" },
          { name: "pagePath" },
        ],
        metrics: [{ name: "eventCount" }],
        dimensionFilter,
        limit: 100,
      },
    });

    const sessions =
      sessionResponse.data.rows?.map((row) => {
        const dims = row.dimensionValues;
        const metrics = row.metricValues;

        // Get device details if available
        const deviceDetails = deviceDetailsResponse?.data?.rows?.[0];
        const deviceDims = deviceDetails?.dimensionValues || [];

        // Determine if we have mobile device dimensions or just basic dimensions
        const hasMobileDimensions = deviceDims.length >= 6;
        const screenResIndex = 0;
        const brandIndex = hasMobileDimensions ? 1 : -1;
        const modelIndex = hasMobileDimensions ? 2 : -1;
        const browserIndex = hasMobileDimensions ? 3 : 1;
        const osIndex = hasMobileDimensions ? 4 : 2;
        const osVersionIndex = hasMobileDimensions ? 5 : 3;

        return {
          date: dims[0].value,
          device: {
            category: dims[1].value,
            os: dims[2].value,
            browser: dims[3].value,
            screenResolution: deviceDims[screenResIndex]?.value || "N/A",
            brand:
              brandIndex >= 0
                ? deviceDims[brandIndex]?.value || "N/A"
                : "N/A (Desktop)",
            model:
              modelIndex >= 0
                ? deviceDims[modelIndex]?.value || "N/A"
                : "N/A (Desktop)",
            browserVersion: "N/A", // Not directly available in GA4
            osVersion:
              osVersionIndex >= 0
                ? deviceDims[osVersionIndex]?.value || "N/A"
                : "N/A",
            appVersion: "N/A", // Only for mobile apps
            isLimitedAdTracking: "N/A", // Not available in GA4 Data API
          },
          location: {
            country: dims[4].value,
            region: dims[5].value || "N/A",
            city: dims[6].value || "N/A",
            metro: "N/A", // Not included to make room for newVsReturning
            latitude: "N/A", // Not available in GA4 Data API
            longitude: "N/A", // Not available in GA4 Data API
          },
          network: {
            domain: "N/A", // Deprecated in GA4
            provider: "N/A", // Deprecated in GA4
          },
          source: {
            source: dims[7].value,
          },
          newVsReturning: dims[8].value || "N/A",
          session: {
            sessions: parseInt(metrics[0].value),
            pageViews: parseInt(metrics[1].value),
            avgDuration: parseFloat(metrics[2].value),
            engagedSessions: parseInt(metrics[3].value),
            bounceRate: parseFloat(metrics[4].value) * 100,
            eventCount: parseInt(metrics[5].value),
            engaged: parseInt(metrics[3].value) > 0,
          },
        };
      }) || [];

    // Map scroll events by page path
    const scrollEventsByPage = {};
    if (scrollEventsResponse?.data?.rows) {
      scrollEventsResponse.data.rows.forEach((row) => {
        const pagePath = row.dimensionValues[0].value;
        const eventName = row.dimensionValues[1].value;
        const eventCount = parseInt(row.metricValues[0].value);

        if (!scrollEventsByPage[pagePath]) {
          scrollEventsByPage[pagePath] = {};
        }

        // Extract scroll percentage from event name (e.g., "scroll_90" -> 90)
        const scrollMatch = eventName.match(/(\d+)/);
        if (scrollMatch) {
          const percentage = parseInt(scrollMatch[1]);
          scrollEventsByPage[pagePath][percentage] = eventCount;
        }
      });
    }

    // Get click events by page
    const clickEventsResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              ...dimensionFilter.andGroup.expressions,
              {
                filter: {
                  fieldName: "eventName",
                  stringFilter: {
                    matchType: "CONTAINS",
                    value: "click",
                  },
                },
              },
            ],
          },
        },
        limit: 100,
      },
    });

    const clickEventsByPage = {};
    if (clickEventsResponse?.data?.rows) {
      clickEventsResponse.data.rows.forEach((row) => {
        const pagePath = row.dimensionValues[0].value;
        const eventCount = parseInt(row.metricValues[0].value);
        clickEventsByPage[pagePath] =
          (clickEventsByPage[pagePath] || 0) + eventCount;
      });
    }

    // Get all events by page
    const eventsByPage = {};
    if (eventsResponse?.data?.rows) {
      eventsResponse.data.rows.forEach((row) => {
        const pagePath = row.dimensionValues[2].value;
        if (!eventsByPage[pagePath]) {
          eventsByPage[pagePath] = [];
        }
        eventsByPage[pagePath].push({
          name: row.dimensionValues[0].value,
          date: row.dimensionValues[1].value,
          count: parseInt(row.metricValues[0].value),
        });
      });
    }

    const pageviews =
      pageviewsResponse.data.rows?.map((row) => {
        const dims = row.dimensionValues;
        const metrics = row.metricValues;
        const pagePath = dims[0].value;

        // Get max scroll percentage for this page
        const scrollData = scrollEventsByPage[pagePath] || {};
        const maxScrollPercentage =
          Object.keys(scrollData).length > 0
            ? Math.max(...Object.keys(scrollData).map(Number))
            : 0;

        return {
          path: pagePath,
          title: dims[1].value,
          hostname: dims[2].value,
          date: dims[3].value,
          hour: dims[4].value,
          views: parseInt(metrics[0].value),
          engagementDuration: parseFloat(metrics[1].value), // Total engagement time in seconds
          avgDuration: parseFloat(metrics[2].value), // Average session duration
          timeOnPage:
            parseFloat(metrics[1].value) / parseInt(metrics[0].value) || 0, // Average time per pageview
          scrollPercentage: maxScrollPercentage,
          clicks: clickEventsByPage[pagePath] || 0,
          events: eventsByPage[pagePath] || [],
          eventCount: parseInt(metrics[3].value),
        };
      }) || [];

    const events =
      eventsResponse.data.rows?.map((row) => {
        const dims = row.dimensionValues;
        const metrics = row.metricValues;

        return {
          name: dims[0].value,
          date: dims[1].value,
          pagePath: dims[2].value,
          count: parseInt(metrics[0].value),
        };
      }) || [];

    return {
      visitorId,
      sessions,
      pageviews,
      events,
      summary: {
        totalSessions: sessions.length,
        totalPageViews: pageviews.reduce((sum, pv) => sum + pv.views, 0),
        totalEvents: events.reduce((sum, e) => sum + e.count, 0),
        avgSessionDuration:
          sessions.length > 0
            ? sessions.reduce((sum, s) => sum + s.session.avgDuration, 0) /
              sessions.length
            : 0,
      },
    };
  } catch (error) {
    console.error("Error fetching visitor details:", error);
    throw error;
  }
};

/**
 * Get daily visitor trends with new vs returning breakdown
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
/**
 * Get visitors for a specific page path
 * @param {string} pagePath - The page path to filter by
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} limit - Number of results to return
 */
export const getVisitorsByPage = async (
  pagePath,
  startDate = "30daysAgo",
  endDate = "today",
  limit = 100
) => {
  const analyticsDataClient = getClient();
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
        dimensions: [
          { name: "date" },
          { name: "pagePath" },
          { name: "deviceCategory" },
          { name: "operatingSystem" },
          { name: "browser" },
          { name: "country" },
          { name: "region" },
          { name: "city" },
          { name: "newVsReturning" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "userEngagementDuration" },
          { name: "engagedSessions" },
          { name: "bounceRate" },
          { name: "activeUsers" },
        ],
        dimensionFilter: {
          filter: {
            fieldName: "pagePath",
            stringFilter: {
              matchType: "CONTAINS",
              value: pagePath,
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
        limit,
      },
    });

    return (
      response.data.rows?.map((row, index) => {
        const dimensions = row.dimensionValues;
        const metrics = row.metricValues;

        // Create a composite ID (pagePath is now at index 1, so we skip it for the ID)
        const compositeId = `${dimensions[0].value}-${dimensions[2].value}-${
          dimensions[3].value
        }-${dimensions[4].value}-${dimensions[5].value}-${
          dimensions[6].value || "none"
        }-${dimensions[7].value || "none"}-${dimensions[8].value}-${index}`;

        return {
          id: compositeId,
          date: dimensions[0].value,
          pagePath: dimensions[1].value, // pagePath is now included
          deviceCategory: dimensions[2].value,
          deviceBrand: "N/A",
          deviceModel: "N/A",
          operatingSystem: dimensions[3].value,
          browser: dimensions[4].value,
          country: dimensions[5].value,
          region: dimensions[6].value || "N/A",
          city: dimensions[7].value || "N/A",
          newVsReturning: dimensions[8].value,
          sessionSource: "N/A", // Removed to stay within 9-dimension limit
          firstUserSource: "N/A",
          sessions: parseInt(metrics[0].value),
          pageViews: parseInt(metrics[1].value),
          avgSessionDuration: parseFloat(metrics[2].value),
          totalDuration: parseFloat(metrics[3].value),
          engagedSessions: parseInt(metrics[4].value),
          bounceRate: parseFloat(metrics[5].value) * 100,
          activeUsers: parseInt(metrics[6].value),
        };
      }) || []
    );
  } catch (error) {
    console.error("Error fetching visitors by page:", error);
    throw error;
  }
};

export const getDailyVisitorTrends = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  const analyticsDataClient = getClient();
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
        dimensions: [{ name: "date" }, { name: "newVsReturning" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
          },
        ],
      },
    });

    // Group by date and separate new vs returning
    const dailyData = {};

    response.data.rows?.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const visitorType = row.dimensionValues[1].value;
      const users = parseInt(row.metricValues[0].value);

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          new: 0,
          returning: 0,
          total: 0,
        };
      }

      if (visitorType === "new") {
        dailyData[date].new = users;
      } else if (visitorType === "returning") {
        dailyData[date].returning = users;
      }

      dailyData[date].total += users;
    });

    // Convert to array and sort by date
    return Object.values(dailyData).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch (error) {
    console.error("Error fetching daily visitor trends:", error);
    throw error;
  }
};

export default {
  getVisitorsList,
  getVisitorDetails,
  getDailyVisitorTrends,
};
