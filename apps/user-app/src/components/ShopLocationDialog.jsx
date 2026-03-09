import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, useMediaQuery, useTheme } from "@mui/material";

const RECENT_SEARCHES_KEY = "shopRecentLocationSearches";

const getCityProvinceFromAddress = (address) => {
  if (!address) return "";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }

  return parts[0] || "";
};

const ShopLocationDialog = ({
  open,
  onClose,
  savedAddresses = [],
  onSelectAddress,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [searchTerm, setSearchTerm] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    if (!open) return;

    try {
      const cached = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      setRecentSearches(Array.isArray(cached) ? cached : []);
    } catch {
      setRecentSearches([]);
    }
  }, [open]);

  const pushRecentSearch = (address) => {
    if (!address) return;

    const deduped = [
      address,
      ...recentSearches.filter((entry) => entry.toLowerCase() !== address.toLowerCase()),
    ].slice(0, 8);

    setRecentSearches(deduped);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(deduped));
  };

  const filteredSavedAddresses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return savedAddresses;

    return savedAddresses.filter((address) => (address || "").toLowerCase().includes(term));
  }, [savedAddresses, searchTerm]);

  const filteredRecentSearches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recentSearches;

    return recentSearches.filter((entry) => (entry || "").toLowerCase().includes(term));
  }, [recentSearches, searchTerm]);

  const handleSelectAddress = (address) => {
    const cityProvince = getCityProvinceFromAddress(address);
    pushRecentSearch(address);
    onSelectAddress({ address, cityProvince });
  };

  const handleGetCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );

          if (!response.ok) {
            throw new Error("Failed reverse geocoding");
          }

          const data = await response.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.municipality ||
            data.address?.county ||
            "Location";
          const province = data.address?.state || data.address?.province || "";
          const cityProvince = province ? `${city}, ${province}` : city;

          const fullAddress =
            data.display_name ||
            [data.address?.road, data.address?.suburb, cityProvince].filter(Boolean).join(", ");

          pushRecentSearch(fullAddress);
          onSelectAddress({ address: fullAddress, cityProvince });
        } catch {
          const { latitude, longitude } = position.coords;
          const fallback = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
          pushRecentSearch(fallback);
          onSelectAddress({ address: fallback, cityProvince: "Coordinates" });
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location access denied. Please allow location permission and try again.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("Location unavailable. Please try again.");
        } else if (error.code === error.TIMEOUT) {
          setLocationError("Location request timed out. Please try again.");
        } else {
          setLocationError("Unable to get your location.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const openMapPicker = () => {
    onClose();
    navigate("/shop/add-address");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          m: 0,
          borderRadius: isMobile ? 0 : 3,
          height: isMobile ? "100dvh" : "85vh",
          backgroundColor: "#F8FAFC",
          overflow: "hidden",
        },
      }}
    >
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 h-full flex flex-col">
        <header className="bg-primary pt-9 pb-20 px-4 relative shrink-0 shadow-sm">
          <div className="flex items-center mb-5">
            <button
              type="button"
              onClick={onClose}
              className="text-white p-1 -ml-1 flex items-center justify-center rounded-full hover:bg-white/10 transition"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <h1 className="text-white text-[1.06rem] font-bold ml-2.5">Select Delivery Location</h1>
          </div>
          <div className="absolute -bottom-6 left-4 right-4 z-10">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg flex items-center px-4 py-3 border border-slate-100 dark:border-slate-700">
              <span className="material-symbols-outlined text-slate-400 mr-3">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full text-slate-600 dark:text-slate-300 p-0"
                placeholder="Search for area, street name..."
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </header>

        <main className="mt-10 px-4 flex-1 pb-3 overflow-y-auto no-scrollbar bg-slate-50/80 dark:bg-transparent">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={locationLoading}
            className="w-full flex items-center p-4 bg-white dark:bg-slate-800 rounded-2xl mb-6 border border-slate-100 dark:border-slate-700 shadow-sm disabled:opacity-60"
          >
            <div className="w-9 h-9 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 shadow-sm mr-3.5 shrink-0">
              <span className="material-symbols-outlined text-xl">
                {locationLoading ? "progress_activity" : "my_location"}
              </span>
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
                {locationLoading ? "Getting current location..." : "Use my current location"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Using GPS for better accuracy
              </p>
            </div>
          </button>

          {locationError && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
              {locationError}
            </div>
          )}

          <section className="mb-8">
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.08em] px-1 mb-3.5">
              Saved Addresses
            </h2>
            <div className="space-y-2">
              {filteredSavedAddresses.length === 0 ? (
                <div className="text-xs text-slate-500 px-2 py-2.5">
                  No saved addresses yet. Use "Set location on map" to add one.
                </div>
              ) : (
                filteredSavedAddresses.map((address, index) => {
                  const iconName = index === 0 ? "home" : index === 1 ? "work" : "location_on";
                  const label = index === 0 ? "Home" : index === 1 ? "Work" : `Address ${index + 1}`;

                  return (
                    <button
                      key={`${address}-${index}`}
                      type="button"
                      onClick={() => handleSelectAddress(address)}
                      className="w-full text-left flex items-start p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:border-slate-200 dark:hover:border-slate-600 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-500 mr-3.5 shrink-0">
                        <span className="material-symbols-outlined text-[20px]">{iconName}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate leading-tight">{label}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {address}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 text-base">more_vert</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="text-xs font-extrabold text-slate-500 uppercase tracking-[0.08em] px-1 mb-3.5">
              Recent Searches
            </h2>
            <div className="space-y-3 px-1">
              {filteredRecentSearches.length === 0 ? (
                <p className="text-xs text-slate-500">No recent searches yet.</p>
              ) : (
                filteredRecentSearches.map((entry, index) => (
                  <button
                    key={`${entry}-${index}`}
                    type="button"
                    onClick={() => handleSelectAddress(entry)}
                    className="w-full text-left flex items-center text-slate-600 dark:text-slate-300 rounded-xl px-1 py-1"
                  >
                    <span className="material-symbols-outlined text-slate-400 mr-4">history</span>
                    <p className="text-sm truncate">{entry}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </main>

        <div className="shrink-0 p-3.5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={openMapPicker}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition"
          >
            <span className="material-symbols-outlined text-xl">map</span>
            <span>Set location on map</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default ShopLocationDialog;
