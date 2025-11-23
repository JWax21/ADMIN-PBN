/**
 * Device Detection Utility
 * Detects device model using screen resolution, DPR, WebGL GPU, and other characteristics
 */

// Device detection map based on known device characteristics
const DEVICE_DETECTION_MAP = [
  // iPhone models
  {
    name: "iPhone 15 Pro",
    dpr: 3.0,
    screen: { width: 1179, height: 2556 },
    gpuHints: ["A17", "A17 Pro"],
    maxTouchPoints: 5,
  },
  {
    name: "iPhone 15",
    dpr: 3.0,
    screen: { width: 1170, height: 2532 },
    gpuHints: ["A16"],
  },
  {
    name: "iPhone 14 Pro",
    dpr: 3.0,
    screen: { width: 1179, height: 2556 },
    gpuHints: ["A16"],
  },
  {
    name: "iPhone 14",
    dpr: 3.0,
    screen: { width: 1170, height: 2532 },
    gpuHints: ["A15"],
  },
  {
    name: "iPhone 13 Pro",
    dpr: 3.0,
    screen: { width: 1170, height: 2532 },
    gpuHints: ["A15"],
  },
  {
    name: "iPhone 13",
    dpr: 3.0,
    screen: { width: 1170, height: 2532 },
    gpuHints: ["A15"],
  },
  {
    name: "iPhone SE (3rd gen)",
    dpr: 2.0,
    screen: { width: 750, height: 1334 },
    gpuHints: ["A15"],
  },
  {
    name: "iPhone 12",
    dpr: 3.0,
    screen: { width: 1170, height: 2532 },
    gpuHints: ["A14"],
  },
  {
    name: "iPhone 11",
    dpr: 2.0,
    screen: { width: 828, height: 1792 },
    gpuHints: ["A13"],
  },
  // iPad models
  {
    name: "iPad Pro 12.9\"",
    dpr: 2.0,
    screen: { width: 1024, height: 1366 },
    gpuHints: ["M1", "M2", "A12Z"],
    maxTouchPoints: 5,
  },
  {
    name: "iPad Pro 11\"",
    dpr: 2.0,
    screen: { width: 834, height: 1194 },
    gpuHints: ["M1", "M2", "A12Z"],
  },
  {
    name: "iPad Air",
    dpr: 2.0,
    screen: { width: 820, height: 1180 },
    gpuHints: ["M1", "A14"],
  },
  // Android devices (common models)
  {
    name: "Samsung Galaxy S23",
    dpr: 3.0,
    screen: { width: 1080, height: 2340 },
    gpuHints: ["Adreno", "Mali"],
  },
  {
    name: "Samsung Galaxy S22",
    dpr: 3.0,
    screen: { width: 1080, height: 2340 },
    gpuHints: ["Adreno", "Mali"],
  },
  {
    name: "Google Pixel 7",
    dpr: 3.0,
    screen: { width: 1080, height: 2400 },
    gpuHints: ["Mali"],
  },
  {
    name: "Google Pixel 6",
    dpr: 3.0,
    screen: { width: 1080, height: 2400 },
    gpuHints: ["Mali"],
  },
];

/**
 * Get WebGL GPU renderer information
 */
function getWebGLRenderer() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      };
    }
    return {
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Get device characteristics
 */
export function getDeviceCharacteristics() {
  const characteristics = {
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    dpr: window.devicePixelRatio || 1,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
  };

  const webgl = getWebGLRenderer();
  if (webgl) {
    characteristics.gpuVendor = webgl.vendor;
    characteristics.gpuRenderer = webgl.renderer;
  }

  // Try to get memory info (if available)
  if (navigator.deviceMemory) {
    characteristics.deviceMemory = navigator.deviceMemory;
  }

  return characteristics;
}

/**
 * Detect device model based on characteristics
 * Can work with partial data from GA4 (OS, browser, device category)
 */
export function detectDeviceModel(characteristics) {
  if (!characteristics) {
    characteristics = getDeviceCharacteristics();
  }

  const { screenWidth, screenHeight, dpr, gpuRenderer, maxTouchPoints, deviceCategory, operatingSystem, browser } =
    characteristics;

  // Score each device match
  const matches = DEVICE_DETECTION_MAP.map((device) => {
    let score = 0;
    const maxScore = 100;

    // Screen resolution match (40 points) - only if we have screen data
    if (screenWidth && screenHeight) {
      const screenMatch =
        Math.abs(device.screen.width - screenWidth) <= 10 &&
        Math.abs(device.screen.height - screenHeight) <= 10;
      if (screenMatch) {
        score += 40;
      } else {
        // Partial match for similar resolutions
        const widthDiff = Math.abs(device.screen.width - screenWidth);
        const heightDiff = Math.abs(device.screen.height - screenHeight);
        if (widthDiff <= 50 && heightDiff <= 50) {
          score += 20;
        }
      }
    }

    // DPR match (30 points) - only if we have DPR
    if (dpr) {
      if (Math.abs(device.dpr - dpr) < 0.1) {
        score += 30;
      } else if (Math.abs(device.dpr - dpr) < 0.5) {
        score += 15;
      }
    }

    // GPU hint match (20 points) - only if we have GPU data
    if (device.gpuHints && gpuRenderer) {
      const gpuMatch = device.gpuHints.some((hint) =>
        gpuRenderer.includes(hint)
      );
      if (gpuMatch) {
        score += 20;
      }
    }

    // Max touch points match (10 points) - only if we have touch data
    if (device.maxTouchPoints && maxTouchPoints === device.maxTouchPoints) {
      score += 10;
    }

    // OS/Browser match (10 points) - for basic matching when we don't have screen/GPU data
    if (!screenWidth && !dpr) {
      const deviceNameLower = device.name.toLowerCase();
      if (operatingSystem) {
        const osLower = operatingSystem.toLowerCase();
        if (deviceNameLower.includes("iphone") && osLower.includes("ios")) {
          score += 5;
        } else if (deviceNameLower.includes("ipad") && osLower.includes("ios")) {
          score += 5;
        } else if (deviceNameLower.includes("galaxy") && osLower.includes("android")) {
          score += 5;
        } else if (deviceNameLower.includes("pixel") && osLower.includes("android")) {
          score += 5;
        }
      }
    }

    return { device: device.name, score };
  });

  // Sort by score and return best match
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];

  // Lower threshold when we only have OS/browser data (no screen/DPR/GPU)
  const threshold = (screenWidth && dpr) ? 50 : 20;

  if (bestMatch.score >= threshold) {
    return {
      detectedModel: bestMatch.device,
      confidence: bestMatch.score,
      characteristics,
      allMatches: matches.slice(0, 3), // Top 3 matches
    };
  }

  // If we have OS/browser but no good match, try to infer generic device type
  if (!screenWidth && !dpr && operatingSystem) {
    const osLower = operatingSystem.toLowerCase();
    
    if (deviceCategory?.toLowerCase() === "mobile") {
      if (osLower.includes("ios")) {
        // Try to find any iPhone in our map
        const iphoneMatch = DEVICE_DETECTION_MAP.find(d => d.name.toLowerCase().includes("iphone"));
        if (iphoneMatch) {
          return {
            detectedModel: iphoneMatch.name,
            confidence: 15,
            characteristics,
            allMatches: matches.slice(0, 3),
          };
        }
      } else if (osLower.includes("android")) {
        // Try to find Android device in our map based on brand/model hints
        if (deviceBrand) {
          const brandLower = deviceBrand.toLowerCase();
          const androidMatch = DEVICE_DETECTION_MAP.find(d => {
            const nameLower = d.name.toLowerCase();
            if (brandLower.includes("samsung") && nameLower.includes("galaxy")) return true;
            if (brandLower.includes("google") && nameLower.includes("pixel")) return true;
            return false;
          });
          if (androidMatch) {
            return {
              detectedModel: androidMatch.name,
              confidence: 15,
              characteristics,
              allMatches: matches.slice(0, 3),
            };
          }
        }
      }
    } else if (deviceCategory?.toLowerCase() === "desktop") {
      if (osLower.includes("mac")) {
        return {
          detectedModel: "Mac",
          confidence: 15,
          characteristics,
          allMatches: matches.slice(0, 3),
        };
      } else if (osLower.includes("windows")) {
        return {
          detectedModel: "Windows PC",
          confidence: 15,
          characteristics,
          allMatches: matches.slice(0, 3),
        };
      }
    }
  }

  return {
    detectedModel: "Unknown",
    confidence: bestMatch.score,
    characteristics,
    allMatches: matches.slice(0, 3),
  };
}

/**
 * Get full device detection report
 */
export function getDeviceDetectionReport() {
  const characteristics = getDeviceCharacteristics();
  const detection = detectDeviceModel(characteristics);

  return {
    characteristics,
    detection,
    timestamp: new Date().toISOString(),
  };
}

