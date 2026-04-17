export const DELIVERY_STATUS = {
  NEW: "NEW",
  ASSIGNED: "ASSIGNED",
  ACCEPTED: "ACCEPTED",
  RIDER_PICKUP: "RIDER_PICKUP",
  ARRIVED_MERCHANT: "ARRIVED_MERCHANT",
  ORDER_PICKED_UP: "ORDER_PICKED_UP",
  IN_DELIVERY: "IN_DELIVERY",
  ARRIVED_CUSTOMER: "ARRIVED_CUSTOMER",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
};

const LEGACY_ALIASES = {
  pending: DELIVERY_STATUS.NEW,
  assigned: DELIVERY_STATUS.ASSIGNED,
  in_transit: DELIVERY_STATUS.IN_DELIVERY,
  completed: DELIVERY_STATUS.DELIVERED,
};

export const normalizeDeliveryStatus = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const alias = LEGACY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;

  return raw.toUpperCase();
};
