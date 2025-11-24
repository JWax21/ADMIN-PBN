import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Import leaflet.heat to extend L namespace
import "leaflet.heat";

// Fix for default marker icons in Leaflet with Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Country to approximate center coordinates mapping
const countryCoordinates = {
  "United States": [39.8283, -98.5795],
  "Canada": [56.1304, -106.3468],
  "United Kingdom": [55.3781, -3.4360],
  "Australia": [-25.2744, 133.7751],
  "Germany": [51.1657, 10.4515],
  "France": [46.2276, 2.2137],
  "Italy": [41.8719, 12.5674],
  "Spain": [40.4637, -3.7492],
  "Netherlands": [52.1326, 5.2913],
  "Belgium": [50.5039, 4.4699],
  "Switzerland": [46.8182, 8.2275],
  "Austria": [47.5162, 14.5501],
  "Sweden": [60.1282, 18.6435],
  "Norway": [60.4720, 8.4689],
  "Denmark": [56.2639, 9.5018],
  "Finland": [61.9241, 25.7482],
  "Poland": [51.9194, 19.1451],
  "Czech Republic": [49.8175, 15.4730],
  "Portugal": [39.3999, -8.2245],
  "Greece": [39.0742, 21.8243],
  "Ireland": [53.4129, -8.2439],
  "New Zealand": [-40.9006, 174.8860],
  "Japan": [36.2048, 138.2529],
  "South Korea": [35.9078, 127.7669],
  "China": [35.8617, 104.1954],
  "India": [20.5937, 78.9629],
  "Brazil": [-14.2350, -51.9253],
  "Mexico": [23.6345, -102.5528],
  "Argentina": [-38.4161, -63.6167],
  "Chile": [-35.6751, -71.5430],
  "South Africa": [-30.5595, 22.9375],
  "Egypt": [26.8206, 30.8025],
  "Israel": [31.0461, 34.8516],
  "United Arab Emirates": [23.4241, 53.8478],
  "Saudi Arabia": [23.8859, 45.0792],
  "Turkey": [38.9637, 35.2433],
  "Russia": [61.5240, 105.3188],
  "Singapore": [1.3521, 103.8198],
  "Malaysia": [4.2105, 101.9758],
  "Thailand": [15.8700, 100.9925],
  "Philippines": [12.8797, 121.7740],
  "Indonesia": [-0.7893, 113.9213],
  "Vietnam": [14.0583, 108.2772],
  "Taiwan": [23.6978, 120.9605],
  "Hong Kong": [22.3193, 114.1694],
};

// Get approximate coordinates for a country
const getCountryCoordinates = (countryName) => {
  // Try exact match first
  if (countryCoordinates[countryName]) {
    return countryCoordinates[countryName];
  }

  // Try case-insensitive match
  const lowerCountry = countryName.toLowerCase();
  for (const [key, coords] of Object.entries(countryCoordinates)) {
    if (key.toLowerCase() === lowerCountry) {
      return coords;
    }
  }

  // Try partial match (e.g., "United States" matches "United States of America")
  for (const [key, coords] of Object.entries(countryCoordinates)) {
    if (lowerCountry.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerCountry)) {
      return coords;
    }
  }

  // Default to a central location if not found
  return null;
};

const GeographyHeatmap = ({ geographicData }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!geographicData || geographicData.length === 0) return;

    // Initialize map if not already created
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([20, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }

    // Prepare heatmap data
    const heatData = [];
    let maxUsers = 0;

    geographicData.forEach((geo) => {
      const coords = getCountryCoordinates(geo.country);
      if (coords) {
        const users = geo.users || 0;
        maxUsers = Math.max(maxUsers, users);
        // The third value is the intensity/weight for the heat point
        heatData.push([coords[0], coords[1], users]);
      }
    });

    // Remove existing heat layer if it exists
    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
    }

    // Add heat layer
    if (heatData.length > 0) {
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        max: maxUsers,
        gradient: {
          0.0: "blue",
          0.5: "cyan",
          0.7: "lime",
          0.8: "yellow",
          1.0: "red",
        },
      }).addTo(mapInstanceRef.current);

      // Fit map to show all data points
      const bounds = heatData.map((point) => [point[0], point[1]]);
      if (bounds.length > 0) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    // Cleanup function
    return () => {
      if (heatLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [geographicData]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="geography-heatmap-container">
      <div ref={mapRef} className="geography-heatmap" />
    </div>
  );
};

export default GeographyHeatmap;

