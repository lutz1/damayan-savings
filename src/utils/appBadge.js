const canUseAppBadge = () => {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.setAppBadge === "function" && typeof navigator.clearAppBadge === "function";
};

export const syncAppBadgeCount = async (count) => {
  if (!canUseAppBadge()) return;

  const nextCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;

  try {
    if (nextCount > 0) {
      await navigator.setAppBadge(nextCount);
      return;
    }

    await navigator.clearAppBadge();
  } catch {
    // Ignore unsupported/platform-specific badge failures.
  }
};