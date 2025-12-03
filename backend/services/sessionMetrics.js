import { getAnalyticsClient } from "./googleAnalytics.js";

/**
 * Get session metrics
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 */
export const getSessionMetrics = async (
  startDate = "30daysAgo",
  endDate = "today"
) => {
  const analyticsDataClient = getAnalyticsClient();
  if (!analyticsDataClient) {
    throw new Error("Analytics client not initialized");
  }

  const propertyId = process.env.GA_PROPERTY_ID;

  try {
    // Get session metrics
    const response = await analyticsDataClient.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "engagedSessions" },
          { name: "engagementRate" },
          { name: "sessions" },
          { name: "activeUsers" },
        ],
      },
    });

    const row = response.data.rows?.[0];
    if (!row) {
      return null;
    }

    const averageSessionDuration = parseFloat(row.metricValues[0].value) || 0;
    const bounceRate = parseFloat(row.metricValues[1].value) * 100 || 0;
    const engagedSessions = parseInt(row.metricValues[2].value) || 0;
    const engagementRate = parseFloat(row.metricValues[3].value) * 100 || 0;
    const sessions = parseInt(row.metricValues[4].value) || 0;
    const activeUsers = parseInt(row.metricValues[5].value) || 0;

    // Get unique engaged users (users with engagement duration > 5 seconds)
    // GA4 doesn't directly support filtering users by engagement duration
    // We'll query sessions grouped by user characteristics and sum engagement duration per user
    // Then count users where total engagement > 5 seconds
    let engagedUsers = 0;
    try {
      // Query sessions grouped by user-identifying dimensions
      // Group by country, region, city, browser to identify unique users
      const engagedUsersResponse = await analyticsDataClient.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [
            { name: "country" },
            { name: "region" },
            { name: "city" },
            { name: "browser" },
          ],
          metrics: [
            { name: "activeUsers" },
            { name: "userEngagementDuration" },
          ],
          limit: 10000, // Get up to 10k user groups
        },
      });

      // Filter rows where userEngagementDuration > 5 seconds and count unique users
      if (engagedUsersResponse.data.rows && engagedUsersResponse.data.rows.length > 0) {
        engagedUsers = engagedUsersResponse.data.rows
          .filter((row) => {
            const engagementDuration = parseFloat(row.metricValues[1].value || 0);
            return engagementDuration > 5.0; // Filter for engagement > 5 seconds
          })
          .reduce((sum, row) => {
            const users = parseInt(row.metricValues[0].value || 0);
            return sum + users; // Sum activeUsers from filtered rows
          }, 0);
      }
    } catch (error) {
      console.warn("Error fetching engaged users with duration > 5s:", error.message);
      // Fallback: try using engagedUsers metric (users with engaged sessions - 10s+ or 2+ pages)
      try {
        const engagedUsersResponse = await analyticsDataClient.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [{ startDate, endDate }],
            metrics: [
              { name: "engagedUsers" },
            ],
          },
        });

        const engagedUsersRow = engagedUsersResponse.data.rows?.[0];
        if (engagedUsersRow) {
          engagedUsers = parseInt(engagedUsersRow.metricValues[0].value) || 0;
        } else {
          // If no data, use engagedSessions as approximation
          engagedUsers = engagedSessions;
        }
      } catch (fallbackError) {
        console.warn("Error fetching engaged users, using engagedSessions as final fallback:", fallbackError.message);
        // Final fallback: use engagedSessions if all else fails
        engagedUsers = engagedSessions;
      }
    }

    // Calculate derived metrics
    const engagedSessionsPerActiveUser =
      activeUsers > 0 ? (engagedSessions / activeUsers).toFixed(2) : 0;
    const sessionsPerActiveUser =
      activeUsers > 0 ? (sessions / activeUsers).toFixed(2) : 0;

    // Note: Session key event rate requires key events to be configured in GA4
    // This is typically a custom metric based on specific key events
    // For now, we'll return null and note it in the response
    const sessionKeyEventRate = null; // Requires key events configuration

    return {
      activeUsers,
      averageSessionDuration,
      bounceRate,
      engagedSessions,
      engagedUsers, // Unique users with engagement duration > 5 seconds
      engagedSessionsPerActiveUser: parseFloat(engagedSessionsPerActiveUser),
      engagementRate,
      sessionKeyEventRate,
      sessions,
      sessionsPerActiveUser: parseFloat(sessionsPerActiveUser),
    };
  } catch (error) {
    console.error("Error fetching session metrics:", error);
    throw error;
  }
};
