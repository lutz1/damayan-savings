/**
 * Delivery Pricing Calculation Utility
 * Implements sustainable business model for Amayan Savings
 * 
 * Customer: ₱50 base + ₱14/km
 * Rider: ₱30 base + ₱9/km
 * Platform margin: 24%
 */

// Pricing constants
export const DELIVERY_PRICING = {
  CUSTOMER: {
    BASE_FEE: 50,
    RATE_PER_KM: 14,
    RAIN_BOOST: 15,
  },
  RIDER: {
    BASE_FEE: 30,
    RATE_PER_KM: 9,
    RAIN_BOOST: 15,
  },
  PLATFORM: {
    MARGIN_PERCENT: 24,
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
 * Calculate customer delivery fee
 * @param {number} distanceKm - Distance in kilometers
 * @param {boolean} includeRainBoost - Whether to include rain boost
 * @returns {number} Delivery fee in pesos
 */
export const calculateCustomerDeliveryFee = (distanceKm, includeRainBoost = false) => {
  if (!distanceKm || distanceKm < 0) return 0;

  const { BASE_FEE, RATE_PER_KM, RAIN_BOOST } = DELIVERY_PRICING.CUSTOMER;
  const distanceCharge = Math.round((distanceKm * RATE_PER_KM + Number.EPSILON) * 100) / 100;
  const rainBoost = includeRainBoost ? RAIN_BOOST : 0;
  
  return BASE_FEE + distanceCharge + rainBoost;
};

/**
 * Calculate rider earnings
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

  const { BASE_FEE, RATE_PER_KM, RAIN_BOOST } = DELIVERY_PRICING.RIDER;
  const distanceCharge = Math.round((totalDistanceKm * RATE_PER_KM + Number.EPSILON) * 100) / 100;
  const peakBonus = isPeakHours ? Math.round((BASE_FEE * 0.15 + Number.EPSILON) * 100) / 100 : 0;
  const rainBoost = includeRainBoost ? RAIN_BOOST : 0;
  
  return BASE_FEE + distanceCharge + bonusAmount + peakBonus + rainBoost;
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
 * Format delivery fee breakdown for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {object} Breakdown with base fee and distance charge
 */
export const getDeliveryFeeBreakdown = (distanceKm) => {
  const { BASE_FEE, RATE_PER_KM } = DELIVERY_PRICING.CUSTOMER;
  const distanceCharge = Math.round((distanceKm * RATE_PER_KM + Number.EPSILON) * 100) / 100;
  const totalFee = BASE_FEE + distanceCharge;

  return {
    baseFee: BASE_FEE,
    distance: distanceKm,
    distanceCharge,
    rainBoost: 0,
    totalFee,
  };
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
