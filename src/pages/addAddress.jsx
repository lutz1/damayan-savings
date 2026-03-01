import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const DEFAULT_CENTER = { lat: 7.4474, lng: 125.8077 };

const parseNominatimAddress = (payload) => {
  if (!payload) {
    return {
      line1: "Pinned location",
      line2: "Move the map to adjust",
      fullAddress: "Pinned location",
      cityProvince: "",
    };
  }

  const address = payload.address || {};
  const city = address.city || address.town || address.municipality || address.county || "";
  const province = address.state || address.province || "";
  const country = address.country || "";

  const houseNumber = address.house_number || "";
  const road = address.road || address.pedestrian || address.footway || "";
  const suburb = address.suburb || address.village || address.neighbourhood || "";

  const line1 =
    [houseNumber, road].filter(Boolean).join(" ") ||
    address.amenity ||
    address.building ||
    suburb ||
    city ||
    "Pinned location";

  const line2 = [city, province, country].filter(Boolean).join(", ") || "Move the map to adjust";
  const cityProvince = [city, province].filter(Boolean).join(", ");

  return {
    line1,
    line2,
    fullAddress: payload.display_name || [line1, line2].filter(Boolean).join(", "),
    cityProvince,
  };
};

const AddAddress = () => {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerMoveDebounceRef = useRef(null);
  const dragStartYRef = useRef(null);
  const draggingSheetRef = useRef(false);
  const pinRef = useRef(null);
  const draggingPinRef = useRef(false);
  const pinDragMetaRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const pinOffsetRef = useRef({ x: 0, y: 0 });

  const [searchText, setSearchText] = useState("");
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [resolving, setResolving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const [pinDragging, setPinDragging] = useState(false);
  const [pinLifted, setPinLifted] = useState(false);
  const [pinOffset, setPinOffset] = useState({ x: 0, y: 0 });
  const [pinDropPulse, setPinDropPulse] = useState(0);
  const [addressInfo, setAddressInfo] = useState({
    line1: "Pinned location",
    line2: "Move the map to adjust",
    fullAddress: "Pinned location",
    cityProvince: "",
  });
  const [addressExtra, setAddressExtra] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    pinOffsetRef.current = pinOffset;
  }, [pinOffset]);

  const loadLeaflet = useCallback(async () => {
    if (typeof window === "undefined") return null;

    if (window.L) return window.L;

    await new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      css.onload = resolve;
      css.onerror = reject;
      document.head.appendChild(css);
    });

    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });

    return window.L;
  }, []);

  const reverseGeocode = useCallback(async (lat, lng) => {
    setResolving(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      if (!response.ok) throw new Error("Failed reverse geocoding");
      const data = await response.json();
      setAddressInfo(parseNominatimAddress(data));
      setErrorMessage("");
    } catch {
      setAddressInfo({
        line1: "Pinned location",
        line2: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        cityProvince: "",
      });
      setErrorMessage("Unable to resolve address. You can still confirm this pinned location.");
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (!active || !mapContainerRef.current || !L) return;

        const map = L.map(mapContainerRef.current, {
          center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map);

        map.on("moveend", () => {
          const c = map.getCenter();
          const nextCenter = { lat: c.lat, lng: c.lng };
          setCenter(nextCenter);

          if (markerMoveDebounceRef.current) {
            window.clearTimeout(markerMoveDebounceRef.current);
          }

          markerMoveDebounceRef.current = window.setTimeout(() => {
            reverseGeocode(nextCenter.lat, nextCenter.lng);
          }, 250);
        });

        mapRef.current = map;
        reverseGeocode(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      } catch {
        setErrorMessage("Failed to load map. Please refresh and try again.");
      }
    };

    initMap();

    return () => {
      active = false;
      if (markerMoveDebounceRef.current) {
        window.clearTimeout(markerMoveDebounceRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loadLeaflet, reverseGeocode]);

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query) return;

    setSearching(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        setErrorMessage("Address not found. Try a more specific keyword.");
        return;
      }

      const best = data[0];
      const nextCenter = { lat: Number(best.lat), lng: Number(best.lon) };
      setCenter(nextCenter);
      mapRef.current?.setView([nextCenter.lat, nextCenter.lng], 17);
      reverseGeocode(nextCenter.lat, nextCenter.lng);
    } catch {
      setErrorMessage("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCenter(nextCenter);
        mapRef.current?.setView([nextCenter.lat, nextCenter.lng], 18);
        reverseGeocode(nextCenter.lat, nextCenter.lng);
        setLocating(false);
      },
      () => {
        setErrorMessage("Unable to access your current location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(Math.min(mapRef.current.getZoom() + 1, 19));
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() - 1, 3));
  };

  const handlePinPointerDown = (event) => {
    const currentOffset = pinOffsetRef.current;
    draggingPinRef.current = true;
    pinDragMetaRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: currentOffset.x,
      startOffsetY: currentOffset.y,
    };
    setPinDragging(true);
    setPinLifted(true);
    if (mapRef.current) {
      mapRef.current.dragging.disable();
    }
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePinPointerMove = useCallback((event) => {
    if (!pinDragMetaRef.current.active) return;

    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    const rect = mapContainer.getBoundingClientRect();
    const maxX = Math.max(48, rect.width * 0.36);
    const maxY = Math.max(72, rect.height * 0.28);

    const moveX = event.clientX - pinDragMetaRef.current.startX;
    const moveY = event.clientY - pinDragMetaRef.current.startY;

    const nextX = Math.max(
      -maxX,
      Math.min(maxX, pinDragMetaRef.current.startOffsetX + moveX)
    );
    const nextY = Math.max(
      -maxY,
      Math.min(maxY, pinDragMetaRef.current.startOffsetY + moveY)
    );

    setPinOffset({ x: nextX, y: nextY });
  }, []);

  const handlePinPointerUp = useCallback(() => {
    if (!pinDragMetaRef.current.active) return;

    pinDragMetaRef.current.active = false;
    draggingPinRef.current = false;
    setPinDragging(false);
    setPinLifted(false);
    setPinDropPulse((prev) => prev + 1);

    const map = mapRef.current;
    const mapContainer = mapContainerRef.current;
    const latestOffset = pinOffsetRef.current;

    if (map) {
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const pointX = rect.width / 2 + latestOffset.x;
        const pointY = rect.height / 2 + latestOffset.y;
        const latLng = map.containerPointToLatLng([pointX, pointY]);
        const nextCenter = { lat: latLng.lat, lng: latLng.lng };

        setCenter(nextCenter);
        map.setView([nextCenter.lat, nextCenter.lng], map.getZoom(), { animate: true });
        reverseGeocode(nextCenter.lat, nextCenter.lng);
      }

      mapRef.current.dragging.enable();
    }

    setPinOffset({ x: 0, y: 0 });
  }, [reverseGeocode]);

  const handleAddExtra = () => {
    const detail = window.prompt("Add building / floor / apartment details", addressExtra || "");
    if (detail !== null) {
      setAddressExtra(detail.trim());
    }
  };

  const handleSheetPointerDown = (event) => {
    draggingSheetRef.current = true;
    dragStartYRef.current = event.clientY;
    setDragDeltaY(0);
    if (event.currentTarget?.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handleSheetPointerMove = useCallback(
    (event) => {
      if (!draggingSheetRef.current || dragStartYRef.current == null) return;

      const delta = event.clientY - dragStartYRef.current;
      if (sheetExpanded) {
        setDragDeltaY(Math.max(0, delta));
      } else {
        setDragDeltaY(Math.min(0, delta));
      }
    },
    [sheetExpanded]
  );

  const handleSheetPointerUp = useCallback(() => {
    if (!draggingSheetRef.current) return;

    draggingSheetRef.current = false;
    const threshold = 50;

    if (!sheetExpanded && dragDeltaY < -threshold) {
      setSheetExpanded(true);
    } else if (sheetExpanded && dragDeltaY > threshold) {
      setSheetExpanded(false);
    }

    setDragDeltaY(0);
    dragStartYRef.current = null;
  }, [sheetExpanded, dragDeltaY]);

  const finalAddress = useMemo(() => {
    const base = [addressInfo.line1, addressInfo.line2].filter(Boolean).join(", ");
    if (!addressExtra) return base || addressInfo.fullAddress;
    return `${base || addressInfo.fullAddress} (${addressExtra})`;
  }, [addressInfo, addressExtra]);

  const handleConfirm = () => {
    if (!finalAddress) return;

    const existing = JSON.parse(localStorage.getItem("savedAddresses") || "[]");
    const normalized = finalAddress.toLowerCase();
    const deduped = [
      finalAddress,
      ...existing.filter((entry) => (entry || "").toLowerCase() !== normalized),
    ].slice(0, 20);

    localStorage.setItem("savedAddresses", JSON.stringify(deduped));
    localStorage.setItem("selectedDeliveryAddress", finalAddress);

    const cityProvince =
      addressInfo.cityProvince ||
      [addressInfo.line2]
        .filter(Boolean)
        .join(", ")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");

    if (cityProvince) {
      localStorage.setItem("selectedDeliveryAddressCityProvince", cityProvince);
    }

    navigate(-1);
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display overflow-hidden">
      <div className="relative h-screen w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-800" />

        {/* Center pin overlay - draggable */}
        <div
          ref={pinRef}
          className={`pin-overlay absolute top-1/2 left-1/2 pointer-events-auto z-20 flex flex-col items-center cursor-grab active:cursor-grabbing select-none ${
            pinDragging ? "" : "fp-pin-idle"
          }`}
          style={{
            transform: `translate(calc(-50% + ${pinOffset.x}px), calc(-100% + ${pinOffset.y + (pinLifted ? -14 : 0)}px)) rotate(${pinDragging ? Math.max(-8, Math.min(8, pinOffset.x / 8)) : 0}deg) scale(${pinLifted ? 1.08 : 1})`,
            transition: pinDragging ? "none" : "transform 220ms cubic-bezier(0.2, 0.7, 0, 1)",
          }}
          onPointerDown={handlePinPointerDown}
          onPointerMove={handlePinPointerMove}
          onPointerUp={handlePinPointerUp}
          onPointerCancel={handlePinPointerUp}
        >
          <div
            className={`fp-pin-halo ${pinLifted ? "fp-pin-halo-lift" : ""}`}
            key={`halo-${pinDropPulse}`}
          />
          <div
            key={`core-${pinDropPulse}`}
            className={`fp-pin-core ${pinDragging ? "fp-pin-core-drag" : "fp-pin-drop"}`}
          >
            <div className="fp-pin-dot" />
          </div>
          <div className={`fp-pin-stem ${pinLifted ? "fp-pin-stem-lift" : ""}`} />
          <div className={`fp-pin-shadow ${pinLifted ? "fp-pin-shadow-lift" : ""}`} />
        </div>

        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-md text-slate-900 dark:text-slate-100 flex items-center justify-center flex-shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
            </button>
            <div className="flex-1 min-w-0">
              <label className="flex items-center bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-full shadow-md border border-slate-100 dark:border-slate-800">
                <span className="material-symbols-outlined text-[#2b8cee] mr-2 flex-shrink-0 text-[20px]">search</span>
                <input
                  className="bg-transparent border-none focus:ring-0 w-full text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="Search for address"
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </label>
            </div>
          </div>
          {searching && <p className="text-xs text-white/90 font-medium px-1">Searching address...</p>}
        </div>

        <div className="absolute right-4 bottom-[calc(55vh+40px)] z-20 flex flex-col items-end gap-2.5">
          <button
            type="button"
            onClick={handleLocateMe}
            className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-lg text-slate-900 dark:text-slate-100 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Use my location"
            disabled={locating}
          >
            <span className={`material-symbols-outlined text-xl ${locating ? "animate-spin" : ""}`}>
              {locating ? "progress_activity" : "my_location"}
            </span>
          </button>
          <div className="flex flex-col rounded-full bg-white dark:bg-slate-900 shadow-lg overflow-hidden border border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2.5 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 transition-colors text-xl"
              title="Zoom in"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2.5 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xl"
              title="Zoom out"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
        </div>

        <div
          className="absolute left-0 right-0 bottom-0 z-30 w-full bg-white dark:bg-slate-900 rounded-t-2xl shadow-[0_-10px_40px_rgb(0,0,0,0.15)] px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overflow-hidden transition-all duration-200 ease-out"
          style={{
            maxHeight: sheetExpanded ? "70vh" : "55vh",
            transform: `translateY(${dragDeltaY}px)`,
          }}
        >
          <div
            className="flex justify-center mb-4 cursor-grab active:cursor-grabbing select-none"
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
            onClick={() => {
              if (Math.abs(dragDeltaY) < 5) {
                setSheetExpanded((prev) => !prev);
              }
            }}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>

          <div className={`flex flex-col ${sheetExpanded ? "overflow-y-auto" : "overflow-hidden"} ${sheetExpanded ? "max-h-[calc(70vh-36px)]" : ""} pr-1`}>
            <div className="flex items-start gap-3 mb-4 flex-shrink-0">
              <div className="bg-[#2b8cee]/10 p-2.5 rounded-full text-[#2b8cee] flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">location_on</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-900 dark:text-slate-100 font-bold text-base leading-snug truncate">
                  {addressInfo.line1 || "Pinned location"}
                </h3>
                <p className={`text-slate-500 dark:text-slate-400 text-sm ${sheetExpanded ? "line-clamp-3" : "line-clamp-1"}`}>
                  {addressInfo.line2 || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`}
                </p>
                {(resolving || errorMessage) && (
                  <p className={`text-xs mt-1 font-medium ${errorMessage ? "text-red-500" : "text-amber-600"}`}>
                    {errorMessage || "Resolving address..."}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2.5 flex-shrink-0">
              {sheetExpanded && (
                <button
                  type="button"
                  onClick={handleAddExtra}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 rounded-lg font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">domain</span>
                  {addressExtra ? "Edit (building / floor / apt)" : "Add building / floor / apt"}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!finalAddress}
                className="w-full bg-[#2b8cee] text-white py-3.5 rounded-lg font-bold text-base shadow-lg shadow-[#2b8cee]/30 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .fp-pin-idle {
          animation: fp-pin-float 1.9s ease-in-out infinite;
        }

        .fp-pin-halo {
          position: absolute;
          top: 10px;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(43, 140, 238, 0.22) 0%, rgba(43, 140, 238, 0.08) 55%, rgba(43, 140, 238, 0) 75%);
          animation: fp-pin-halo 1.8s ease-in-out infinite;
          pointer-events: none;
        }

        .fp-pin-halo-lift {
          transform: scale(1.08);
          opacity: 0.9;
        }

        .fp-pin-core {
          width: 38px;
          height: 38px;
          border-radius: 50% 50% 50% 0;
          background: linear-gradient(165deg, #4da4f5 0%, #2b8cee 60%, #1677db 100%);
          border: 3px solid #ffffff;
          box-shadow: 0 10px 22px rgba(22, 119, 219, 0.34);
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fp-pin-core-drag {
          box-shadow: 0 16px 28px rgba(22, 119, 219, 0.42);
        }

        .fp-pin-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.22);
          transform: rotate(45deg);
        }

        .fp-pin-stem {
          width: 3px;
          height: 18px;
          margin-top: -4px;
          border-radius: 999px;
          background: linear-gradient(180deg, #2b8cee 0%, #1f7ed8 100%);
          transition: all 150ms ease;
        }

        .fp-pin-stem-lift {
          height: 23px;
        }

        .fp-pin-shadow {
          width: 18px;
          height: 7px;
          margin-top: 2px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.22);
          filter: blur(3px);
          transition: all 150ms ease;
        }

        .fp-pin-shadow-lift {
          width: 26px;
          opacity: 0.5;
        }

        .fp-pin-drop {
          animation: fp-pin-drop 300ms cubic-bezier(0.2, 0.75, 0.25, 1.2);
        }

        @keyframes fp-pin-halo {
          0%, 100% { transform: scale(0.94); opacity: 0.7; }
          50% { transform: scale(1.03); opacity: 1; }
        }

        @keyframes fp-pin-float {
          0%, 100% { transform: translate(-50%, -100%) translateY(0); }
          50% { transform: translate(-50%, -100%) translateY(-4px); }
        }

        @keyframes fp-pin-drop {
          0% { transform: translateY(-12px) scale(1.06); }
          65% { transform: translateY(2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AddAddress;
