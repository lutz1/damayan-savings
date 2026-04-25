const STATUS_LABELS = {
  NEW: "Pending",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  RIDER_PICKUP: "Rider pickup",
  ARRIVED_MERCHANT: "Arrived at store",
  ORDER_PICKED_UP: "Picked up",
  IN_DELIVERY: "On the way",
  ARRIVED_CUSTOMER: "Arrived",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS = {
  NEW: "secondary",
  ASSIGNED: "warning",
  ACCEPTED: "warning",
  RIDER_PICKUP: "info",
  ARRIVED_MERCHANT: "warning",
  ORDER_PICKED_UP: "info",
  IN_DELIVERY: "info",
  ARRIVED_CUSTOMER: "info",
  DELIVERED: "success",
  CANCELLED: "error",
};

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
  accepted: DELIVERY_STATUS.ACCEPTED,
  preparing: DELIVERY_STATUS.ACCEPTED,
  ready_for_pickup: DELIVERY_STATUS.RIDER_PICKUP,
  rider_pickup: DELIVERY_STATUS.RIDER_PICKUP,
  rider_assigned: DELIVERY_STATUS.ASSIGNED,
  picked_up: DELIVERY_STATUS.ORDER_PICKED_UP,
  order_picked_up: DELIVERY_STATUS.ORDER_PICKED_UP,
  out_for_delivery: DELIVERY_STATUS.IN_DELIVERY,
  in_transit: DELIVERY_STATUS.IN_DELIVERY,
  on_the_way: DELIVERY_STATUS.IN_DELIVERY,
  arrived: DELIVERY_STATUS.ARRIVED_CUSTOMER,
  arrived_customer: DELIVERY_STATUS.ARRIVED_CUSTOMER,
  completed: DELIVERY_STATUS.DELIVERED,
  delivered: DELIVERY_STATUS.DELIVERED,
  cancelled: DELIVERY_STATUS.CANCELLED,
  rejected: DELIVERY_STATUS.CANCELLED,
};

export const normalizeDeliveryStatus = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const alias = LEGACY_ALIASES[raw.toLowerCase()];
  if (alias) return alias;

  const upper = raw.toUpperCase();
  if (DELIVERY_STATUS[upper]) return DELIVERY_STATUS[upper];

  return upper;
};

export const getDeliveryStatusLabel = (value) => {
  const normalized = normalizeDeliveryStatus(value);
  return STATUS_LABELS[normalized] || normalized || "Unknown";
};

export const getDeliveryStatusColor = (value) => {
  const normalized = normalizeDeliveryStatus(value);
  return STATUS_COLORS[normalized] || "default";
};
