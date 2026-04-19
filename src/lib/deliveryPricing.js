/**
 * Delivery Pricing Calculation Utility
 * Implements optimized tiered pricing model for Amayan Savings
 * 
 * Customer Tiered:
 *   - BASE: ₱39
 *   - 0–3 km: ₱10/km
 *   - 3–5 km: ₱8/km
 *   - 5–8 km: flat +₱15
 *   - MAX: ₱120
 * 
 * Rider Tiered:
 *   - BASE: ₱25
 *   - 0–3 km: ₱7/km
 *   - 3–6 km: ₱6/km
 *   - 6–8 km: ₱5/km
 */

// Pricing constants - Tiered pricing model
export const DELIVERY_PRICING = {
  CUSTOMER: {
    BASE_FEE: 39,
    MAX_FEE: 120,
    TIERS: [
      { upTo: 3, ratePerKm: 10 },   // 0-3 km: ₱10/km
      { upTo: 5, ratePerKm: 8 },    // 3-5 km: ₱8/km
      { upTo: 8, flatAdd: 15 },     // 5-8 km: flat +₱15
    ],
    RAIN_BOOST: 15,
    PRIORITY_DELIVERY_FEE: 20,
  },
  RIDER: {
    BASE_FEE: 25,
    TIERS: [
      { upTo: 3, ratePerKm: 7 },    // 0-3 km: ₱7/km
      { upTo: 6, ratePerKm: 6 },    // 3-6 km: ₱6/km
      { upTo: 8, ratePerKm: 5 },    // 6-8 km: ₱5/km
    ],
    RAIN_BOOST: 15,
  },
  PLATFORM: {
    MARGIN_PERCENT: 20,
  },
  DISTANCE_LIMITS: {
    MAX_DELIVERY_DISTANCE: 8,
    SUGGEST_NEAREST_ABOVE: 6,
  },
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - User latitude
 * @param {number} lng1 - User longitude
 * @param {number} lat2 - Store latitude
 * @param {number} lng2 - Store longitude
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const nLat1 = Number(lat1);
  const nLng1 = Number(lng1);
  const nLat2 = Number(lat2);
  const nLng2 = Number(lng2);

  if (![nLat1, nLng1, nLat2, nLng2].every(Number.isFinite)) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLng = ((nLng2 - nLng1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c + Number.EPSILON) * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate customer delivery fee using tiered pricing
 * @param {number} distanceKm - Distance in kilometers
 * @param {boolean} includeRainBoost - Whether to include rain boost
 * @param {boolean} priorityDelivery - Whether customer paid for priority delivery
 * @returns {number} Delivery fee in pesos (capped at MAX_FEE)
 */
export const calculateCustomerDeliveryFee = (
  distanceKm,
  includeRainBoost = false,
  priorityDelivery = false
) => {
  if (!distanceKm || distanceKm < 0) return 0;

  const { BASE_FEE, MAX_FEE, TIERS, RAIN_BOOST, PRIORITY_DELIVERY_FEE } = DELIVERY_PRICING.CUSTOMER;

  let distanceCharge = 0;
  let remaining = distanceKm;

  // Apply tiered pricing
  for (const tier of TIERS) {
    if (remaining <= 0) break;

    if (tier.flatAdd) {
      // Flat add tier (5-8 km range)
      distanceCharge += tier.flatAdd;
      remaining = 0;
    } else {
      // Per-km tier
      const distance = Math.min(remaining, tier.upTo);
      distanceCharge += distance * tier.ratePerKm;
      remaining -= distance;
    }
  }

  // Calculate final fee
  let totalFee = BASE_FEE + distanceCharge;
  totalFee += includeRainBoost ? RAIN_BOOST : 0;
  totalFee += priorityDelivery ? PRIORITY_DELIVERY_FEE : 0;

  // Cap at maximum fee
  totalFee = Math.min(totalFee, MAX_FEE);

  return Math.round((totalFee + Number.EPSILON) * 100) / 100;
};

/**
 * Calculate rider earnings using tiered pricing
 * @param {number} totalDistanceKm - Total distance traveled (rider → store → customer)
 * @param {number} bonusAmount - Bonus/incentive amount
 * @param {boolean} isPeakHours - Whether it's peak hours
 * @param {boolean} includeRainBoost - Whether to include rain boost
 * @returns {number} Rider earnings in pesos
 */
export const calculateRiderEarnings = (
  totalDistanceKm,
  bonusAmount = 0,
  isPeakHours = false,
  includeRainBoost = false
) => {
  if (!totalDistanceKm || totalDistanceKm < 0) return 0;

  const { BASE_FEE, TIERS, RAIN_BOOST } = DELIVERY_PRICING.RIDER;

  let distanceCharge = 0;
  let remaining = totalDistanceKm;

  // Apply tiered pricing
  for (const tier of TIERS) {
    if (remaining <= 0) break;
    const distance = Math.min(remaining, tier.upTo);
    distanceCharge += distance * tier.ratePerKm;
    remaining -= distance;
  }

  // Calculate rider earnings
  let earnings = BASE_FEE + distanceCharge + bonusAmount;
  
  if (isPeakHours) {
    // Peak hours: 15% bonus on base fee
    const peakBonus = Math.round((BASE_FEE * 0.15 + Number.EPSILON) * 100) / 100;
    earnings += peakBonus;
  }

  if (includeRainBoost) {
    earnings += RAIN_BOOST;
  }

  return Math.round((earnings + Number.EPSILON) * 100) / 100;
};

/**
 * Calculate platform commission/profit
 * @param {number} customerFee - Customer delivery fee
 * @param {number} riderEarnings - Rider earnings
 * @returns {number} Platform profit/commission in pesos
 */
export const calculatePlatformCommission = (customerFee, riderEarnings) => {
  return Math.round((customerFee - riderEarnings + Number.EPSILON) * 100) / 100;
};

/**
 * Get estimated delivery fee for initial display (no bonuses/peak hours)
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Estimated delivery fee
 */
export const getEstimatedDeliveryFee = (distanceKm) => {
  return calculateCustomerDeliveryFee(distanceKm, false);
};

/**
 * Format delivery fee breakdown for display with tiered pricing details
 * @param {number} distanceKm - Distance in kilometers
 * @returns {object} Breakdown with base fee, tiered distance charges, and total
 */
export const getDeliveryFeeBreakdown = (distanceKm) => {
  const { BASE_FEE, TIERS, RAIN_BOOST } = DELIVERY_PRICING.CUSTOMER;
  
  let distanceCharge = 0;
  let tierBreakdown = [];
  let remaining = distanceKm;

  // Calculate tiered charges and breakdown
  for (const tier of TIERS) {
    if (remaining <= 0) break;

    if (tier.flatAdd) {
      tierBreakdown.push({
        range: `${TIERS[TIERS.indexOf(tier) - 1]?.upTo || 0}–${tier.upTo} km`,
        charge: tier.flatAdd,
        type: 'flat',
      });
      distanceCharge += tier.flatAdd;
      remaining = 0;
    } else {
      const distance = Math.min(remaining, tier.upTo);
      const charge = distance * tier.ratePerKm;
      tierBreakdown.push({
        range: `${distance > 0 ? TIERS[TIERS.indexOf(tier) - 1]?.upTo || 0 : 0}–${tier.upTo} km`,
        distance,
        ratePerKm: tier.ratePerKm,
        charge,
        type: 'per-km',
      });
      distanceCharge += charge;
      remaining -= distance;
    }
  }

  const totalFee = BASE_FEE + distanceCharge;

  return {
    baseFee: BASE_FEE,
    distance: distanceKm,
    distanceCharge: Math.round((distanceCharge + Number.EPSILON) * 100) / 100,
    tierBreakdown,
    rainBoost: 0,
    totalFee: Math.round((totalFee + Number.EPSILON) * 100) / 100,
  };
};

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Get actual road distance using Google Directions API via Firebase Cloud Function
 * Returns real driving distance, not straight-line distance
 * @param {number} fromLat - Starting latitude
 * @param {number} fromLng - Starting longitude
 * @param {number} toLat - Destination latitude
 * @param {number} toLng - Destination longitude
 * @returns {Promise<number|null>} Road distance in kilometers or null if error
 */
export const getRoadDistance = async (fromLat, fromLng, toLat, toLng) => {
  try {
    // Validate inputs
    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
      console.warn("⚠️ Invalid coordinates for distance calculation");
      return null;
    }

    // Call Firebase Cloud Function (no CORS issues, no backend needed)
    const getRoadDistanceFunction = httpsCallable(functions, "getRoadDistance");
    
    console.log(`📍 Calling Cloud Function: (${fromLat},${fromLng}) → (${toLat},${toLng})`);

    const result = await getRoadDistanceFunction({
      fromLat: Number(fromLat),
      fromLng: Number(fromLng),
      toLat: Number(toLat),
      toLng: Number(toLng),
    });

    const { distanceKm, distanceText, durationText } = result.data;
    console.log(`✅ Road distance from Cloud Function: ${distanceKm} km (${distanceText}, ${durationText})`);
    return distanceKm;
  } catch (error) {
    console.error("❌ Road distance calculation error:", error.message);
    return null;
  }
};

/**
 * Check if distance exceeds delivery limits
 * @param {number} distanceKm - Distance in kilometers
 * @returns {object} Status with canDeliver flag and message
 */
export const checkDeliveryDistance = (distanceKm) => {
  const { MAX_DELIVERY_DISTANCE, SUGGEST_NEAREST_ABOVE } = DELIVERY_PRICING.DISTANCE_LIMITS;

  if (distanceKm > MAX_DELIVERY_DISTANCE) {
    return {
      canDeliver: false,
      tooFar: true,
      suggestNearest: distanceKm > SUGGEST_NEAREST_ABOVE,
      message: `This store is too far (${distanceKm} km). We deliver up to ${MAX_DELIVERY_DISTANCE} km.`,
    };
  }

  if (distanceKm > SUGGEST_NEAREST_ABOVE) {
    return {
      canDeliver: true,
      tooFar: false,
      suggestNearest: true,
      message: `This is a long delivery (${distanceKm} km). Would you like to see nearer branches?`,
    };
  }

  return {
    canDeliver: true,
    tooFar: false,
    suggestNearest: false,
    message: null,
  };
};

/**
 * Find nearest stores of same brand within suggested range
 * @param {object} userCoords - User {lat, lng}
 * @param {array} stores - All stores array
 * @param {string} targetBrand - Brand name to match (e.g., "Azcer Brew")
 * @param {number} maxDistance - Max distance to suggest (default: 3-4 km)
 * @param {function} distanceCalcFn - Function to calculate distance: (lat1, lng1, lat2, lng2) => km
 * @returns {array} Array of nearby stores sorted by distance
 */
export const findNearestStores = (
  userCoords,
  stores,
  targetBrand,
  maxDistance = 4,
  distanceCalcFn = calculateDistance
) => {
  if (!userCoords || !stores || !Array.isArray(stores)) return [];

  const { lat: userLat, lng: userLng } = userCoords;
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return [];

  return stores
    .filter((store) => {
      // Match store brand
      const storeName = store.storeName || store.name || "";
      if (!targetBrand || !storeName.includes(targetBrand)) return false;

      // Calculate distance
      const storeCoords = extractCoordinates(store);
      if (!storeCoords) return false;

      const dist = distanceCalcFn(userLat, userLng, storeCoords.lat, storeCoords.lng);
      return dist > 0 && dist <= maxDistance;
    })
    .map((store) => {
      const storeCoords = extractCoordinates(store);
      const dist = distanceCalcFn(userLat, userLng, storeCoords.lat, storeCoords.lng);
      return {
        ...store,
        distance: Math.round((dist + Number.EPSILON) * 10) / 10,
      };
    })
    .sort((a, b) => a.distance - b.distance);
};

/**
 * Extract store brand name from store document
 * Useful for finding same-brand alternatives
 * @param {object} store - Store document
 * @returns {string|null} Brand name or null
 */
export const extractStoreBrand = (store) => {
  if (!store || typeof store !== "object") return null;

  // Try to extract brand from store name
  const storeName = store.storeName || store.name || "";
  
  // Common brand patterns
  const brandPatterns = [
    /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/,  // Capitalized words at start
  ];

  for (const pattern of brandPatterns) {
    const match = storeName.match(pattern);
    if (match) return match[1];
  }

  return null;
};

/**
 * Extract coordinates from user profile or location data
 * @param {object} userData - User data object
 * @returns {object|null} Coordinates {lat, lng} or null
 */
export const extractCoordinates = (userData) => {
  if (!userData || typeof userData !== "object") return null;

  const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  // Direct lat/lng
  const lat = toNumber(userData.lat ?? userData.latitude ?? userData.userLat ?? userData.userlat);
  const lng = toNumber(userData.lng ?? userData.lon ?? userData.long ?? userData.longitude ?? userData.userLng ?? userData.userlng);
  if (lat != null && lng != null) return { lat, lng };

  // Nested location - check multiple possible field names
  const nested =
    userData.location ||
    userData.currentLocation ||
    userData.coordinates ||
    userData.deliveryLocation ||
    userData.deliveryAddress ||
    userData.storeLocation ||
    userData.shopLocation ||
    userData.geo ||
    userData.position ||
    userData.address?.coordinates ||
    userData.address?.location ||
    userData.geoLocation;

  if (nested && typeof nested === "object") {
    const nLat = toNumber(nested.lat ?? nested.latitude ?? nested.userLat ?? nested.userlat);
    const nLng = toNumber(nested.lng ?? nested.lon ?? nested.long ?? nested.longitude ?? nested.userLng ?? nested.userlng);
    if (nLat != null && nLng != null) return { lat: nLat, lng: nLng };
  }

  // Check if it's a GeoPoint-like object from Firestore
  if (userData._latitude != null && userData._longitude != null) {
    return {
      lat: toNumber(userData._latitude),
      lng: toNumber(userData._longitude),
    };
  }

  return null;
};

/**
 * Geocode an address string to get latitude/longitude coordinates
 * Uses Google Maps Geocoding API
 * @param {string} addressString - Full address to geocode
 * @returns {Promise<{lat: number, lng: number} | null>} Coordinates or null if not found
 */
export const geocodeAddress = async (addressString) => {
  if (!addressString || typeof addressString !== "string") return null;

  try {
    const apiKey = import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("⚠️  Google Maps API key not configured");
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&components=country:PH&region=ph&key=${apiKey}`
    );

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === "OK" && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      console.log(`✅ Geocoded address "${addressString}":`, { lat: location.lat, lng: location.lng });
      return {
        lat: location.lat,
        lng: location.lng,
      };
    } else {
      console.warn(`❌ Geocoding failed for "${addressString}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error("❌ Geocoding error:", error);
    return null;
  }
};
