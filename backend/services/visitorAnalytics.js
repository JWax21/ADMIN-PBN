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
          { name: "hour" }, // Hour of day
          { name: "landingPage" }, // First page viewed
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
          {
            dimension: {
              dimensionName: "hour",
            },
            desc: true,
          },
        ],
        limit,
      },
    });

    // First, map all rows to visitor objects with index for unique IDs
    const allVisitors = response.data.rows?.map((row, rowIndex) => {
      const dimensions = row.dimensionValues;
      const metrics = row.metricValues;

      // Normalize newVsReturning value - GA4 should return "new" or "returning"
      // but sometimes returns "(not set)", empty strings, or other values
      const newVsReturningValue = dimensions[7].value?.toLowerCase();
      const normalizedNewVsReturning = 
        newVsReturningValue === "returning" ? "returning" : "new";

      return {
        date: dimensions[0].value,
        hour: dimensions[1].value, // Hour of day (0-23)
        landingPage: dimensions[2].value || "", // First page viewed - may be empty
        browser: dimensions[3].value,
        country: dimensions[4].value,
        region: dimensions[5].value || "N/A",
        city: dimensions[6].value || "N/A",
        newVsReturning: normalizedNewVsReturning,
        sessionSource: dimensions[8].value || "N/A", // Current session source
        sessions: parseInt(metrics[0].value),
        pageViews: parseInt(metrics[1].value),
        avgSessionDuration: parseFloat(metrics[2].value),
        totalDuration: parseFloat(metrics[3].value), // Total engagement duration in seconds
        engagedSessions: parseInt(metrics[4].value),
        bounceRate: parseFloat(metrics[5].value) * 100,
        activeUsers: parseInt(metrics[6].value),
        _rowIndex: rowIndex, // Store original row index for composite ID
      };
    }) || [];

    // Group by user characteristics to ensure one row per unique user
    // User is identified by: country, region, city, browser (most stable identifiers)
    const userMap = new Map();

    allVisitors.forEach((visitor) => {
      // Create a user key from stable characteristics
      const userKey = `${visitor.country}|||${visitor.region}|||${visitor.city}|||${visitor.browser}`;

      if (!userMap.has(userKey)) {
        // First occurrence - use this as the base
        // Create composite ID with index (10 parts total for backend compatibility)
        const compositeId = `${visitor.date}|||${visitor.hour}|||${encodeURIComponent(
          visitor.landingPage
        )}|||${visitor.browser}|||${visitor.country}|||${
          visitor.region || "none"
        }|||${visitor.city || "none"}|||${
          visitor.newVsReturning
        }|||${visitor.sessionSource || "none"}|||${visitor._rowIndex}`;

        userMap.set(userKey, {
          id: compositeId,
          date: visitor.date,
          hour: visitor.hour,
          landingPage: visitor.landingPage,
          deviceCategory: "N/A",
          deviceBrand: "N/A",
          deviceModel: "N/A",
          operatingSystem: "N/A",
          browser: visitor.browser,
          country: visitor.country,
          region: visitor.region,
          city: visitor.city,
          newVsReturning: visitor.newVsReturning,
          sessionSource: visitor.sessionSource,
          firstUserSource: "N/A",
          sessions: visitor.sessions,
          pageViews: visitor.pageViews,
          totalDuration: visitor.totalDuration,
          engagedSessions: visitor.engagedSessions,
          bounceRate: visitor.bounceRate,
          activeUsers: 1, // Each row represents 1 unique user
          // Store for aggregation
          _allDurations: [visitor.avgSessionDuration],
          _dateHour: `${visitor.date}${visitor.hour.padStart(2, '0')}`, // For sorting most recent
          _rowIndex: visitor._rowIndex, // Store row index for composite ID
        });
      } else {
        // Aggregate metrics for this user
        const existing = userMap.get(userKey);
        existing.sessions += visitor.sessions;
        existing.pageViews += visitor.pageViews;
        existing.totalDuration += visitor.totalDuration;
        existing.engagedSessions += visitor.engagedSessions;
        // activeUsers stays 1 since each row represents 1 unique user
        existing._allDurations.push(visitor.avgSessionDuration);
        
        // Update to most recent visit
        const currentDateHour = `${visitor.date}${visitor.hour.padStart(2, '0')}`;
        if (currentDateHour > existing._dateHour) {
          existing.date = visitor.date;
          existing.hour = visitor.hour;
          existing.landingPage = visitor.landingPage;
          existing.sessionSource = visitor.sessionSource;
          existing.newVsReturning = visitor.newVsReturning; // Use most recent classification
          existing._dateHour = currentDateHour;
          existing._rowIndex = visitor._rowIndex; // Update row index to most recent
          // Update ID to reflect most recent visit (include index for 10 parts)
          existing.id = `${visitor.date}|||${visitor.hour}|||${encodeURIComponent(
            visitor.landingPage
          )}|||${visitor.browser}|||${visitor.country}|||${
            visitor.region || "none"
          }|||${visitor.city || "none"}|||${
            visitor.newVsReturning
          }|||${visitor.sessionSource || "none"}|||${visitor._rowIndex}`;
        }
      }
    });

    // Convert map to array and calculate aggregated averages
    const visitors = Array.from(userMap.values()).map((visitor) => {
      // Calculate average session duration from all sessions
      const avgDuration = visitor._allDurations.reduce((sum, d) => sum + d, 0) / visitor._allDurations.length;
      
      // Recalculate bounce rate: (total sessions - engaged sessions) / total sessions * 100
      const recalculatedBounceRate = visitor.sessions > 0 
        ? ((visitor.sessions - visitor.engagedSessions) / visitor.sessions) * 100 
        : 0;
      
      // Store dateHour for sorting before deleting
      const dateHour = visitor._dateHour;
      
      // Remove temporary fields
      delete visitor._allDurations;
      delete visitor._dateHour;
      delete visitor._rowIndex;
      
      return {
        ...visitor,
        avgSessionDuration: avgDuration,
        bounceRate: recalculatedBounceRate,
        _sortKey: dateHour, // Temporary sort key
      };
    });

    // Sort by most recent date and hour (descending)
    visitors.sort((a, b) => {
      return b._sortKey.localeCompare(a._sortKey);
    });

    // Remove sort key
    visitors.forEach(v => delete v._sortKey);

    // For visitors with empty landingPage, fetch the first pagePath they visited
    const visitorsNeedingFirstPage = visitors.filter(
      (v) => !v.landingPage || v.landingPage === ""
    );

    if (visitorsNeedingFirstPage.length > 0) {
      try {
        // Get first pagePath for each visitor group
        // We'll use the same dimensions but add pagePath and order by date/hour ASC
        const firstPageResponse =
          await analyticsDataClient.properties.runReport({
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
                { name: "hour" },
                { name: "pagePath" },
                { name: "browser" },
                { name: "country" },
                { name: "region" },
                { name: "city" },
                { name: "newVsReturning" },
                { name: "sessionSource" },
              ],
              metrics: [{ name: "screenPageViews" }],
              orderBys: [
                {
                  dimension: {
                    dimensionName: "date",
                  },
                  desc: false, // ASC to get earliest first
                },
                {
                  dimension: {
                    dimensionName: "hour",
                  },
                  desc: false, // ASC to get earliest hour first
                },
              ],
              limit: 10000, // Get enough to match all visitors
            },
          });

        // Create a map of first pages by visitor key
        const firstPageMap = {};
        if (firstPageResponse?.data?.rows) {
          firstPageResponse.data.rows.forEach((row) => {
            const dims = row.dimensionValues;
            // Create a key from dimensions (same as visitor key but without landingPage)
            // dims[0] = date, dims[1] = hour, dims[2] = pagePath, dims[3] = browser,
            // dims[4] = country, dims[5] = region, dims[6] = city, dims[7] = newVsReturning,
            // dims[8] = sessionSource
            const key = `${dims[0].value}|||${dims[1].value}|||${dims[3].value}|||${
              dims[4].value
            }|||${dims[5].value || "none"}|||${dims[6].value || "none"}|||${
              dims[7].value
            }|||${dims[8].value || "none"}`;

            // Only set if not already set (first occurrence is the earliest)
            if (!firstPageMap[key]) {
              firstPageMap[key] = dims[2].value; // pagePath (index 2)
            }
          });
        }

        // Update visitors with empty landingPage
        visitors.forEach((visitor) => {
          if (!visitor.landingPage || visitor.landingPage === "") {
            // Match with hour, region, city, and sessionSource included
            const key = `${visitor.date}|||${visitor.hour}|||${
              visitor.browser
            }|||${visitor.country}|||${
              visitor.region !== "N/A" ? visitor.region : "none"
            }|||${visitor.city !== "N/A" ? visitor.city : "none"}|||${
              visitor.newVsReturning
            }|||${
              visitor.sessionSource !== "N/A" ? visitor.sessionSource : "none"
            }`;

            if (firstPageMap[key]) {
              visitor.landingPage = firstPageMap[key];
            }
          }
        });
      } catch (error) {
        console.warn("Error fetching first pages for visitors:", error);
        // Continue without first pages - visitors will show N/A
      }
    }

    return visitors;
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
    // Format: date|||hour|||landingPage|||browser|||country|||region|||city|||newVsReturning|||sessionSource|||index
    // Using ||| as delimiter to avoid conflicts with URLs that contain dashes
    const parts = visitorId.split("|||");
    if (parts.length < 10) {
      throw new Error(
        `Invalid visitor ID format. Expected 10 parts, got ${parts.length}`
      );
    }
    const date = parts[0];
    const hour = parts[1];
    const landingPage = decodeURIComponent(parts[2]); // Decode the URL-encoded landing page
    const browser = parts[3];
    const country = parts[4];
    const region = parts[5] !== "none" ? parts[5] : null;
    const city = parts[6] !== "none" ? parts[6] : null;
    const newVsReturning = parts[7];
    const sessionSource = parts[8] !== "none" ? parts[8] : null;

    // Build dimension filters - limit to essential filters to stay under 9 dimension limit
    // Note: GA4 counts dimension filters toward the 9-dimension limit
    // We'll use only the most critical filters: date, hour, landingPage, country, newVsReturning
    // This reduces from 9 filters to 5, leaving room for 4 dimensions in the query
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
              fieldName: "hour",
              stringFilter: {
                matchType: "EXACT",
                value: hour,
              },
            },
          },
          ...(landingPage && landingPage !== ""
            ? [
                {
                  filter: {
                    fieldName: "landingPage",
                    stringFilter: {
                      matchType: "EXACT",
                      value: landingPage,
                    },
                  },
                },
              ]
            : []),
          {
            filter: {
              fieldName: "country",
              stringFilter: {
                matchType: "EXACT",
                value: country,
              },
            },
          },
          {
            filter: {
              fieldName: "newVsReturning",
              stringFilter: {
                matchType: "EXACT",
                value: newVsReturning,
              },
            },
          },
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
          { name: "operatingSystem" },
          { name: "browser" },
          { name: "country" },
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
    // Reduced to 5 dimensions to stay within 9-dimension limit (4 filters + 5 dimensions)
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
            desc: false, // ASC to get earliest first
          },
          {
            dimension: {
              dimensionName: "hour",
            },
            desc: false, // ASC to get earliest hour first
          },
        ],
        limit: 100,
      },
    });

    // Get scroll depth events for pages using event parameter
    // GA4 stores scroll percentage in event parameter "percent_scrolled"
    // Note: We need to get scroll events for all pages visited by this visitor,
    // so we'll query without visitor-specific filters and then match by pagePath
    let scrollEventsResponse = null;
    
    // First, collect all page paths from pageviews to filter scroll events
    const pagePathsFromPageviews = [];
    if (pageviewsResponse?.data?.rows) {
      pageviewsResponse.data.rows.forEach((row) => {
        const pagePath = row.dimensionValues[0].value;
        if (pagePath && !pagePathsFromPageviews.includes(pagePath)) {
          pagePathsFromPageviews.push(pagePath);
        }
      });
    }
    
    // Only query scroll events if we have page paths
    if (pagePathsFromPageviews.length > 0) {
      try {
        // Build filter for page paths
        const pagePathFilters = pagePathsFromPageviews.map(pagePath => ({
          filter: {
            fieldName: "pagePath",
            stringFilter: {
              matchType: "EXACT",
              value: pagePath,
            },
          },
        }));
        
        scrollEventsResponse = await analyticsDataClient.properties.runReport({
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
              { name: "eventParameter:percent_scrolled" }
            ],
            metrics: [{ name: "eventCount" }],
            dimensionFilter: {
              andGroup: {
                expressions: [
                  {
                    orGroup: {
                      expressions: pagePathFilters,
                    },
                  },
                  {
                    filter: {
                      fieldName: "eventName",
                      stringFilter: {
                        matchType: "EXACT",
                        value: "scroll",
                      },
                    },
                  },
                ],
              },
            },
            limit: 100,
          },
        });
      } catch (scrollError) {
        console.warn("Scroll events query with parameter failed, trying alternative method:", scrollError.message);
        // Fallback: try with event name containing "scroll"
        try {
          const pagePathFilters = pagePathsFromPageviews.map(pagePath => ({
            filter: {
              fieldName: "pagePath",
              stringFilter: {
                matchType: "EXACT",
                value: pagePath,
              },
            },
          }));
          
          scrollEventsResponse = await analyticsDataClient.properties.runReport({
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
                    {
                      orGroup: {
                        expressions: pagePathFilters,
                      },
                    },
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
          });
        } catch (fallbackError) {
          console.warn("Fallback scroll query also failed:", fallbackError.message);
          scrollEventsResponse = null;
        }
      }
    }

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
        const hasMobileDimensions = deviceDims.length >= 5;
        const screenResIndex = 0;
        const brandIndex = hasMobileDimensions ? 1 : -1;
        const modelIndex = hasMobileDimensions ? 2 : -1;
        const browserIndex = hasMobileDimensions ? 3 : 1;
        const osIndex = hasMobileDimensions ? 4 : 2;
        const osVersionIndex = -1; // Removed to stay within dimension limit

        return {
          date: dims[0].value,
          device: {
            category: "N/A", // Removed to stay within dimension limit
            os: dims[1].value,
            browser: dims[2].value,
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
            country: dims[3].value,
            region: "N/A", // Removed to stay within dimension limit
            city: "N/A", // Removed to stay within dimension limit
            metro: "N/A", // Not included to make room for newVsReturning
            latitude: "N/A", // Not available in GA4 Data API
            longitude: "N/A", // Not available in GA4 Data API
          },
          network: {
            domain: "N/A", // Deprecated in GA4
            provider: "N/A", // Deprecated in GA4
          },
          source: {
            source: "N/A", // Removed to stay within dimension limit
          },
          newVsReturning: (() => {
            const value = dims[4].value?.toLowerCase();
            return value === "returning" ? "returning" : "new";
          })(),
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
        const scrollValue = row.dimensionValues[1].value; // This could be eventParameter:percent_scrolled or eventName
        const eventCount = parseInt(row.metricValues[0].value);

        if (!scrollEventsByPage[pagePath]) {
          scrollEventsByPage[pagePath] = {};
        }

        // Try to extract percentage from event parameter or event name
        let percentage = null;
        
        // If it's a numeric value (from event parameter percent_scrolled)
        if (scrollValue && scrollValue !== "(not set)" && scrollValue !== "" && !isNaN(scrollValue)) {
          percentage = parseInt(scrollValue);
        } else if (scrollValue) {
          // Try to extract from event name (e.g., "scroll_90" -> 90)
          const scrollMatch = scrollValue.match(/(\d+)/);
          if (scrollMatch) {
            percentage = parseInt(scrollMatch[1]);
          }
        }
        
        if (percentage !== null && percentage >= 0 && percentage <= 100) {
          scrollEventsByPage[pagePath][percentage] = (scrollEventsByPage[pagePath][percentage] || 0) + eventCount;
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
        let maxScrollPercentage = null;
        if (Object.keys(scrollData).length > 0) {
          const percentages = Object.keys(scrollData).map(Number).filter(p => p > 0);
          if (percentages.length > 0) {
            maxScrollPercentage = Math.max(...percentages);
          }
        }

        // Calculate time on page: userEngagementDuration / screenPageViews
        const views = parseInt(metrics[0].value);
        const totalEngagementDuration = parseFloat(metrics[1].value) || 0; // Total engagement time in seconds
        const timeOnPage = views > 0 ? totalEngagementDuration / views : 0; // Average time per pageview in seconds

        return {
          path: pagePath,
          title: dims[1].value,
          hostname: dims[2].value,
          date: dims[3].value,
          hour: dims[4].value,
          views: views,
          engagementDuration: totalEngagementDuration,
          avgDuration: parseFloat(metrics[2].value), // Average session duration
          timeOnPage: timeOnPage,
          scrollPercentage: maxScrollPercentage > 0 ? maxScrollPercentage : null,
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

    // Determine the actual first page from pageviews if landingPage was empty
    // The pageviews are sorted by date ASC and hour ASC, so the first one is the landing page
    const actualLandingPage = pageviews.length > 0 ? pageviews[0].path : null;

    return {
      visitorId,
      sessions,
      pageviews,
      events,
      actualLandingPage, // The first page from pageviews (used when landingPage dimension is empty)
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

        // Normalize newVsReturning value
        const newVsReturningValue = dimensions[8].value?.toLowerCase();
        const normalizedNewVsReturning = 
          newVsReturningValue === "returning" ? "returning" : "new";

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
          newVsReturning: normalizedNewVsReturning,
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

/**
 * Get power users (users with more than 3 sessions in the last 30 days)
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} minSessions - Minimum number of sessions to qualify (default: 3)
 */
export const getPowerUsers = async (
  startDate = "30daysAgo",
  endDate = "today",
  minSessions = 3
) => {
  const analyticsDataClient = getClient();
  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Get users with their session counts and metrics
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
          { name: "operatingSystem" },
          { name: "browser" },
          { name: "country" },
          { name: "region" },
          { name: "city" },
          { name: "newVsReturning" },
          { name: "sessionSource" },
          { name: "landingPage" },
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
            metric: {
              metricName: "sessions",
            },
            desc: true,
          },
        ],
        limit: 10000,
      },
    });

    // Group by user characteristics and aggregate metrics
    const userMap = new Map();

    response.data.rows?.forEach((row) => {
      const dimensions = row.dimensionValues;
      const metrics = row.metricValues;

      // Create a user key from dimensions (excluding date and landingPage to group across dates/pages)
      // dimensions[0] = date, [1] = operatingSystem, [2] = browser, [3] = country,
      // [4] = region, [5] = city, [6] = newVsReturning, [7] = sessionSource, [8] = landingPage
      const userKey = `${dimensions[1].value}|||${dimensions[2].value}|||${
        dimensions[3].value
      }|||${dimensions[4].value || "none"}|||${
        dimensions[5].value || "none"
      }|||${dimensions[6].value}|||${dimensions[7].value || "none"}`;

      const sessions = parseInt(metrics[0].value);
      const pageViews = parseInt(metrics[1].value);
      const avgSessionDuration = parseFloat(metrics[2].value);
      const totalEngagementDuration = parseFloat(metrics[3].value);
      const engagedSessions = parseInt(metrics[4].value);
      const bounceRate = parseFloat(metrics[5].value);
      const date = dimensions[0].value;
      const landingPage = dimensions[8].value;

      // Normalize newVsReturning value
      const newVsReturningValue = dimensions[6].value?.toLowerCase();
      const normalizedNewVsReturning = 
        newVsReturningValue === "returning" ? "returning" : "new";

      if (!userMap.has(userKey)) {
        userMap.set(userKey, {
          landingPage: landingPage, // Store first landing page
          operatingSystem: dimensions[1].value,
          browser: dimensions[2].value,
          country: dimensions[3].value,
          region: dimensions[4].value || "N/A",
          city: dimensions[5].value || "N/A",
          newVsReturning: normalizedNewVsReturning,
          sessionSource: dimensions[7].value || "N/A",
          totalSessions: 0,
          totalPageViews: 0,
          totalEngagementDuration: 0,
          totalEngagedSessions: 0,
          totalBounceSessions: 0,
          dates: [],
          firstVisit: date,
          lastVisit: date,
        });
      }

      const user = userMap.get(userKey);
      user.totalSessions += sessions;
      user.totalPageViews += pageViews;
      user.totalEngagementDuration += totalEngagementDuration;
      user.totalEngagedSessions += engagedSessions;
      user.totalBounceSessions += Math.round(sessions * bounceRate);
      user.dates.push(date);
      if (date < user.firstVisit) user.firstVisit = date;
      if (date > user.lastVisit) user.lastVisit = date;
    });

    // Filter users with >= minSessions and calculate final metrics
    const powerUsers = Array.from(userMap.values())
      .filter((user) => user.totalSessions >= minSessions)
      .map((user) => {
        const avgSessionDuration =
          user.totalSessions > 0
            ? user.totalEngagementDuration / user.totalSessions
            : 0;
        const engagementRate =
          user.totalSessions > 0
            ? (user.totalEngagedSessions / user.totalSessions) * 100
            : 0;
        const bounceRate =
          user.totalSessions > 0
            ? (user.totalBounceSessions / user.totalSessions) * 100
            : 0;

        return {
          id: `${user.operatingSystem}|||${user.browser}|||${user.country}|||${user.region}|||${user.city}|||${user.newVsReturning}|||${user.sessionSource}`,
          landingPage: user.landingPage,
          operatingSystem: user.operatingSystem,
          browser: user.browser,
          country: user.country,
          region: user.region,
          city: user.city,
          newVsReturning: user.newVsReturning,
          sessionSource: user.sessionSource,
          sessions: user.totalSessions,
          pageViews: user.totalPageViews,
          avgSessionDuration,
          totalEngagementDuration: user.totalEngagementDuration,
          engagementRate,
          bounceRate,
          firstVisit: user.firstVisit,
          lastVisit: user.lastVisit,
          uniqueDays: new Set(user.dates).size,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);

    return powerUsers;
  } catch (error) {
    console.error("Error fetching power users:", error);
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
    // Get new users by date (users who had their first session on each date)
    const newUsersResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "newUsers" }],
        orderBys: [
          {
            dimension: {
              dimensionName: "date",
            },
          },
        ],
      },
    });

    // Get active users by date (all distinct users who visited on each date)
    const activeUsersResponse = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: "date" }],
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

    // Build a map of date -> new users
    const newUsersByDate = {};
    newUsersResponse.data.rows?.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const newUsers = parseInt(row.metricValues[0].value);
      newUsersByDate[date] = newUsers;
    });

    // Build daily data from active users, calculating returning as activeUsers - newUsers
    const dailyData = {};

    activeUsersResponse.data.rows?.forEach((row) => {
      const date = row.dimensionValues[0].value;
      const activeUsers = parseInt(row.metricValues[0].value);
      const newUsers = newUsersByDate[date] || 0;
      const returningUsers = Math.max(0, activeUsers - newUsers); // Ensure non-negative

      dailyData[date] = {
        date,
        new: newUsers,
        returning: returningUsers,
        total: activeUsers,
      };
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
