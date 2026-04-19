export function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveCart(nextCart) {
  localStorage.setItem("cart", JSON.stringify(nextCart));
}

export function cartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
}

export function cartCount(cart) {
  return cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

export function merchantCount(cart) {
  const uniqueMerchants = new Set(cart.map((item) => item.merchantId).filter(Boolean));
  return uniqueMerchants.size;
}
