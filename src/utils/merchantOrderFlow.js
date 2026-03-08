import { DELIVERY_STATUS, normalizeDeliveryStatus } from "./deliveryStatus";

export const MERCHANT_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const MERCHANT_ORDER_STATUS = {
  NEW: "NEW",
  ACCEPTED: "ACCEPTED",
  PREPARING: "PREPARING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  ORDER_PICKED_UP: DELIVERY_STATUS.ORDER_PICKED_UP,
  IN_DELIVERY: DELIVERY_STATUS.IN_DELIVERY,
  DELIVERED: DELIVERY_STATUS.DELIVERED,
  CANCELLED: DELIVERY_STATUS.CANCELLED,
};

const ALIASES = {
  pending: MERCHANT_ORDER_STATUS.NEW,
  confirmed: MERCHANT_ORDER_STATUS.ACCEPTED,
  processing: MERCHANT_ORDER_STATUS.PREPARING,
  picked_up: MERCHANT_ORDER_STATUS.ORDER_PICKED_UP,
  out_for_delivery: MERCHANT_ORDER_STATUS.IN_DELIVERY,
  completed: MERCHANT_ORDER_STATUS.DELIVERED,
};

export const normalizeMerchantOrderStatus = (value) => {
  const deliveryNormalized = normalizeDeliveryStatus(value);
  if (deliveryNormalized) return deliveryNormalized;

  const raw = String(value || "").trim();
  if (!raw) return "";

  const alias = ALIASES[raw.toLowerCase()];
  if (alias) return alias;

  return raw.toUpperCase();
};

export const isMerchantOrderNew = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.NEW;
};

export const isMerchantOrderPreparing = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.ACCEPTED || normalized === MERCHANT_ORDER_STATUS.PREPARING;
};

export const isMerchantOrderReady = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.READY_FOR_PICKUP;
};

export const isMerchantOrderInDelivery = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.ORDER_PICKED_UP || normalized === MERCHANT_ORDER_STATUS.IN_DELIVERY;
};

export const isMerchantOrderCompleted = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.DELIVERED;
};

export const isMerchantOrderTerminal = (status) => {
  const normalized = normalizeMerchantOrderStatus(status);
  return normalized === MERCHANT_ORDER_STATUS.DELIVERED || normalized === MERCHANT_ORDER_STATUS.CANCELLED;
};
