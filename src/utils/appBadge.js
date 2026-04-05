const getBadgeApi = () => {
  if (typeof navigator === "undefined") {
    return { set: null, clear: null };
  }

  return {
    set: typeof navigator.setAppBadge === "function" ? navigator.setAppBadge.bind(navigator) : null,
    clear: typeof navigator.clearAppBadge === "function" ? navigator.clearAppBadge.bind(navigator) : null,
  };
};

const notifyServiceWorkerBadge = async (count) => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const nextCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  const message = nextCount > 0
    ? { type: "SET_APP_BADGE", count: nextCount }
    : { type: "CLEAR_APP_BADGE" };

  try {
    const registration = await navigator.serviceWorker.ready;
    registration?.active?.postMessage?.(message);
    navigator.serviceWorker.controller?.postMessage?.(message);
  } catch {
    // Ignore service-worker badge sync failures.
  }
};

export const syncAppBadgeCount = async (count) => {
  const nextCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  const badgeApi = getBadgeApi();

  try {
    if (nextCount > 0) {
      if (badgeApi.set) {
        await badgeApi.set(nextCount);
      }
    } else if (badgeApi.clear) {
      await badgeApi.clear();
    } else if (badgeApi.set) {
      await badgeApi.set(0);
    }
  } catch {
    // Ignore unsupported/platform-specific badge failures.
  }

  await notifyServiceWorkerBadge(nextCount);
};