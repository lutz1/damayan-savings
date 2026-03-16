import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { collection, doc, getDocs, getDoc, query, setDoc, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  Assignment,
  Navigation,
  AccountBalanceWallet,
  Home,
  Explore,
  Person,
  RadioButtonChecked,
} from "@mui/icons-material";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";
import { DELIVERY_STATUS, normalizeDeliveryStatus } from "../utils/deliveryStatus";
import plezzIcon from "../../../../src/assets/plezzicon.png";

const { auth, db } = createFirebaseClients("RiderApp");
const MAP_LIBRARIES = ["marker"];

const isValidGoogleMapId = (value) => {
  const mapId = String(value || "").trim();
  if (!mapId) return false;
  if (mapId === "DEMO_MAP_ID") return false;
  if (mapId === "your_real_map_id_here") return false;
  if (mapId === "YOUR_GOOGLE_MAPS_MAP_ID_HERE") return false;
  return mapId.length >= 8;
};

const AdvancedMarker = ({ map, position, title, makeContent }) => {
  useEffect(() => {
    if (!map || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) {
      return undefined;
    }

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title,
      content: typeof makeContent === "function" ? makeContent() : undefined,
    });

    return () => {
      marker.map = null;
    };
  }, [map, position?.lat, position?.lng, title, makeContent]);

  return null;
};

const RiderLiveMap = ({
  googleMapsApiKey,
  googleMapId,
  useAdvancedMarkers,
  mapContainerStyle,
  mapCenter,
  riderCoords,
  destinationCoords,
  routePath,
  createRiderMarkerContent,
  createDestinationMarkerContent,
}) => {
  const [mapRef, setMapRef] = useState(null);
  const { isLoaded } = useJsApiLoader({
    id: "rider-dashboard-map-script",
    googleMapsApiKey,
    libraries: MAP_LIBRARIES,
  });

  if (!riderCoords) {
    return (
      <Box sx={{ p: 2, textAlign: "center", color: "#334155", fontSize: 13, bgcolor: "#f1f5f9", borderRadius: 2 }}>
        Waiting for your GPS location...
      </Box>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ p: 2, textAlign: "center", color: "#334155", fontSize: 13, bgcolor: "#f1f5f9", borderRadius: 2 }}>
        Loading map...
      </Box>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={mapCenter}
      zoom={15}
      onLoad={(map) => setMapRef(map)}
      onUnmount={() => setMapRef(null)}
      options={{
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        mapId: useAdvancedMarkers ? googleMapId : undefined,
      }}
    >
      {useAdvancedMarkers && riderCoords && (
        <AdvancedMarker
          map={mapRef}
          position={riderCoords}
          title="Your Location"
          makeContent={createRiderMarkerContent}
        />
      )}
      {useAdvancedMarkers && destinationCoords && (
        <AdvancedMarker
          map={mapRef}
          position={destinationCoords}
          title="Delivery Destination"
          makeContent={createDestinationMarkerContent}
        />
      )}
      {!useAdvancedMarkers && riderCoords && (
        <MarkerF
          position={riderCoords}
          title="Your Location"
          icon={{
            url: plezzIcon,
            scaledSize: window.google ? new window.google.maps.Size(44, 44) : undefined,
          }}
        />
      )}
      {!useAdvancedMarkers && destinationCoords && (
        <MarkerF position={destinationCoords} title="Delivery Destination" />
      )}
      {routePath.length === 2 && (
        <PolylineF
          path={routePath}
          options={{ strokeColor: "#3b82f6", strokeOpacity: 0.9, strokeWeight: 4 }}
        />
      )}
    </GoogleMap>
  );
};

const RiderDashboard = () => {
  const navigate = useNavigate();
  const googleMapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
    "";
  const rawGoogleMapId =
    import.meta.env.REACT_APP_GOOGLE_MAPS_MAP_ID ||
    import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
    import.meta.env.VITE_GOOGLE_MAP_ID ||
    "";
  const useAdvancedMarkers = isValidGoogleMapId(rawGoogleMapId);
  const googleMapId = useAdvancedMarkers ? rawGoogleMapId : "";
  const mapContainerStyle = { width: "100%", height: "220px", borderRadius: "14px" };
  const [riderData, setRiderData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    totalEarnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deliveryDialog, setDeliveryDialog] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [updateNote, setUpdateNote] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [riderUid, setRiderUid] = useState("");

  const riderCoords = riderData && typeof riderData.lat === "number" && typeof riderData.lng === "number" ? { lat: riderData.lat, lng: riderData.lng } : null;
  const activeDelivery = deliveries.find((d) => normalizeDeliveryStatus(d.status) !== DELIVERY_STATUS.DELIVERED && normalizeDeliveryStatus(d.status) !== DELIVERY_STATUS.CANCELLED);
  const destinationCoords = activeDelivery && activeDelivery.dropoffLocation && typeof activeDelivery.dropoffLocation.lat === "number" && typeof activeDelivery.dropoffLocation.lng === "number" ? { lat: activeDelivery.dropoffLocation.lat, lng: activeDelivery.dropoffLocation.lng } : null;
  const routePath = riderCoords && destinationCoords ? [riderCoords, destinationCoords] : [];
  const mapCenter = riderCoords || destinationCoords || { lat: 13.0827, lng: 80.2707 };

  const createRiderMarkerContent = () => {
    const wrap = document.createElement("div");
    wrap.style.width = "500px";
    wrap.style.height = "500px";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";

    const img = document.createElement("img");
    img.src = plezzIcon;
    img.alt = "Rider";
    img.width = 500;
    img.height = 500;
    img.style.objectFit = "contain";
    img.style.filter = "drop-shadow(0 3px 8px rgba(0,0,0,0.3))";

    wrap.appendChild(img);
    return wrap;
  };

  const createDestinationMarkerContent = () => {
    if (window.google?.maps?.marker?.PinElement) {
      const pin = new window.google.maps.marker.PinElement({
        background: "#ef4444",
        borderColor: "#ffffff",
        glyphColor: "#ffffff",
      });
      return pin.element;
    }

    const dot = document.createElement("div");
    dot.style.width = "18px";
    dot.style.height = "18px";
    dot.style.borderRadius = "50%";
    dot.style.background = "#ef4444";
    dot.style.border = "2px solid #ffffff";
    return dot;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setRiderUid("");
        setRiderData(null);
        setDeliveries([]);
        setStats({
          totalDeliveries: 0,
          completedDeliveries: 0,
          pendingDeliveries: 0,
          totalEarnings: 0,
        });
        setLoading(false);
        return;
      }

      setRiderUid(user.uid);
      loadRiderData(user.uid);
    });

    return () => unsubscribe();
  }, []);

  const loadRiderData = async (uid) => {
    try {
      setLoading(true);
      if (!uid) {
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const riderProfile = userSnap.data();
        setRiderData(riderProfile);
        if (typeof riderProfile.onlineStatus === "boolean") {
          setIsOnline(riderProfile.onlineStatus);
        }
      }

      const deliveriesRef = collection(db, "deliveries");
      const q = query(deliveriesRef, where("riderId", "==", uid));
      const querySnapshot = await getDocs(q);
      const deliveriesList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setDeliveries(deliveriesList);

      const completed = deliveriesList.filter((d) => normalizeDeliveryStatus(d.status) === DELIVERY_STATUS.DELIVERED).length;
      const pending = deliveriesList.filter((d) => {
        const status = normalizeDeliveryStatus(d.status);
        return status && status !== DELIVERY_STATUS.DELIVERED && status !== DELIVERY_STATUS.CANCELLED;
      }).length;
      const totalEarnings = deliveriesList
        .filter((d) => normalizeDeliveryStatus(d.status) === DELIVERY_STATUS.DELIVERED)
        .reduce((sum, d) => sum + (d.deliveryFee || 0), 0);

      setStats({
        totalDeliveries: deliveriesList.length,
        completedDeliveries: completed,
        pendingDeliveries: pending,
        totalEarnings: totalEarnings,
      });

      setLoading(false);
    } catch (error) {
      console.error("Error loading rider data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    const uid = riderUid || auth.currentUser?.uid;
    if (!uid) return;

    const syncOnlineState = async () => {
      try {
        const payload = {
          onlineStatus: isOnline,
          availability: isOnline ? "AVAILABLE" : "OFFLINE",
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, "users", uid), payload);
        await setDoc(doc(db, "riders", uid), payload, { merge: true });
      } catch (error) {
        console.error("Error syncing online state:", error);
      }
    };

    syncOnlineState();
  }, [isOnline, riderUid]);

  useEffect(() => {
    const uid = riderUid || auth.currentUser?.uid;
    if (!uid || !isOnline) return;

    let active = true;

    const pushLocation = () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!active) return;

          const lat = Number(position.coords.latitude);
          const lng = Number(position.coords.longitude);
          const isoNow = new Date().toISOString();

          try {
            const riderPayload = {
              name: riderData?.name || "Rider",
              phone: riderData?.phone || riderData?.contactNumber || "",
              onlineStatus: true,
              status: "ONLINE",
              availability: "AVAILABLE",
              lat,
              lng,
              currentLocation: { lat, lng },
              currentOrder: activeDelivery?.id || null,
              earningsToday: Number(stats?.totalEarnings || 0),
              lastLocationUpdate: isoNow,
              lastActive: isoNow,
              updatedAt: isoNow,
            };

            const userPayload = {
              name: riderPayload.name,
              phone: riderPayload.phone,
              onlineStatus: riderPayload.onlineStatus,
              availability: riderPayload.availability,
              lat,
              lng,
              currentLocation: { lat, lng },
              lastLocationUpdate: isoNow,
              lastActive: isoNow,
              updatedAt: isoNow,
            };

            await updateDoc(doc(db, "users", uid), userPayload);
            await setDoc(doc(db, "riders", uid), riderPayload, { merge: true });

            const riderDeliveriesSnap = await getDocs(
              query(collection(db, "deliveries"), where("riderId", "==", uid))
            );

            const activeDeliveries = riderDeliveriesSnap.docs.filter((snap) => {
              const status = normalizeDeliveryStatus(snap.data()?.status);
              return status && status !== DELIVERY_STATUS.DELIVERED && status !== DELIVERY_STATUS.CANCELLED;
            });

            await Promise.all(
              activeDeliveries.map((snap) =>
                updateDoc(doc(db, "deliveries", snap.id), {
                  lat,
                  lng,
                  currentLocation: { lat, lng },
                  lastLocationUpdate: isoNow,
                  lastUpdated: isoNow,
                })
              )
            );
          } catch (error) {
            console.error("Error pushing rider location:", error);
          }
        },
        (error) => {
          console.error("Geolocation error:", error?.message || error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 4000 }
      );
    };

    pushLocation();
    const intervalId = window.setInterval(pushLocation, 5000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [riderUid, isOnline]);

  const handleDeliveryClick = (delivery) => {
    setSelectedDelivery(delivery);
    setDeliveryDialog(true);
  };

  const handleUpdateDelivery = async (newStatus) => {
    try {
      if (!selectedDelivery) return;

      const deliveryRef = doc(db, "deliveries", selectedDelivery.id);
      await updateDoc(deliveryRef, {
        status: newStatus,
        [`status_${newStatus}_at`]: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        notes: updateNote || selectedDelivery.notes || "",
      });

      setDeliveryDialog(false);
      setUpdateNote("");
      loadRiderData(auth.currentUser?.uid);
    } catch (error) {
      console.error("Error updating delivery:", error);
    }
  };

  const getStatusColor = (status) => {
    const normalizedStatus = normalizeDeliveryStatus(status);

    switch (normalizedStatus) {
      case DELIVERY_STATUS.DELIVERED:
        return "success";
      case DELIVERY_STATUS.IN_DELIVERY:
      case DELIVERY_STATUS.ORDER_PICKED_UP:
        return "info";
      case DELIVERY_STATUS.ASSIGNED:
      case DELIVERY_STATUS.ACCEPTED:
      case DELIVERY_STATUS.RIDER_PICKUP:
      case DELIVERY_STATUS.ARRIVED_MERCHANT:
        return "warning";
      case DELIVERY_STATUS.NEW:
        return "secondary";
      default:
        return "default";
    }
  };

  const formatCurrency = (value) => `P${Number(value || 0).toFixed(2)}`;

  const metricCircle = (label, value, color, progress) => (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 78,
          height: 78,
          borderRadius: "50%",
          bgcolor: "#fff",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 10px rgba(15,23,42,0.08)",
        }}
      >
        <CircularProgress
          variant="determinate"
          value={100}
          size={78}
          thickness={4}
          sx={{ color: `${color}33`, position: "absolute", inset: 0 }}
        />
        <CircularProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          size={78}
          thickness={4}
          sx={{ color, position: "absolute", inset: 0 }}
        />
        <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{value}</Typography>
      </Box>
      <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: "#64748b" }}>
        {label}
      </Typography>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f8f6", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: "center", width: "100%", maxWidth: 380 }}>
          <CircularProgress size={40} sx={{ mb: 2, color: "#5bec13" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Loading Rider Dashboard
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Fetching your profile and deliveries...
          </Typography>
        </Paper>
      </Box>
    );
  }

  const onlineHours = isOnline ? "Online" : "Offline";

  return (
    <>
      <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f8f6", color: "#0f172a" }}>
        <Box sx={{ maxWidth: 430, mx: "auto", minHeight: "100dvh", bgcolor: "#f6f8f6", position: "relative", boxShadow: "0 10px 30px rgba(15,23,42,0.10)" }}>
          <Box
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.5,
              backdropFilter: "blur(8px)",
              bgcolor: "rgba(255,255,255,0.85)",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Welcome back,</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{riderData?.name || "Rider"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: "#64748b", letterSpacing: 0.8 }}>
                {isOnline ? "ONLINE" : "OFFLINE"}
              </Typography>
              <Switch checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#5bec13" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#5bec13" } }} />
            </Box>
          </Box>

          <Box sx={{ px: 2, pt: 2, pb: 18 }}>
            <Card sx={{ bgcolor: "#0f172a", color: "#fff", borderRadius: 3, p: 2, mb: 2.5, position: "relative", overflow: "hidden" }}>
              <Box sx={{ position: "absolute", right: -18, top: -18, opacity: 0.08, fontSize: 120, fontWeight: 700 }}>$</Box>
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <AccountBalanceWallet sx={{ color: "#5bec13", fontSize: 20 }} />
                  <Typography sx={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>Wallet Balance</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "end", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{formatCurrency(stats.totalEarnings)}</Typography>
                  <Button onClick={() => navigate("/wallet")} sx={{ bgcolor: "#5bec13", color: "#0f172a", fontWeight: 800, borderRadius: 2, px: 2, py: 1, "&:hover": { bgcolor: "#4dd90f" } }}>
                    Cash Out
                  </Button>
                </Box>
              </Box>
            </Card>

            <Box sx={{ mb: 2.5 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, mb: 1.5 }}>Today's Performance</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.2 }}>
                {metricCircle("EARNINGS", formatCurrency(stats.totalEarnings), "#5bec13", Math.min(100, stats.totalEarnings > 0 ? 78 : 8))}
                {metricCircle("ORDERS", String(stats.totalDeliveries), "#3b82f6", Math.min(100, stats.totalDeliveries * 10 || 8))}
                {metricCircle("STATUS", onlineHours, "#f59e0b", isOnline ? 72 : 20)}
              </Box>
            </Box>

            <Box sx={{ mb: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Live Tracking Map</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.7, bgcolor: "#e0f2fe", px: 1.2, py: 0.5, borderRadius: 1.2 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#38bdf8" }} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, color: "#0369a1" }}>LIVE</Typography>
                </Box>
              </Box>
              <Box sx={{ height: 220, borderRadius: 3, overflow: "hidden", position: "relative", border: "1px solid #e2e8f0", bgcolor: "#cbd5e1" }}>
                {!googleMapsApiKey ? (
                  <Box sx={{ p: 2, textAlign: "center", color: "#b45309", fontSize: 13, bgcolor: "#fef3c7", borderRadius: 2 }}>
                    Google Maps API key is missing. Set <b>VITE_GOOGLE_MAPS_API_KEY</b> or <b>REACT_APP_GOOGLE_MAPS_API_KEY</b> to enable live map tracking.
                  </Box>
                ) : (
                  <RiderLiveMap
                    googleMapsApiKey={googleMapsApiKey}
                    googleMapId={googleMapId}
                    useAdvancedMarkers={useAdvancedMarkers}
                    mapContainerStyle={mapContainerStyle}
                    mapCenter={mapCenter}
                    riderCoords={riderCoords}
                    destinationCoords={destinationCoords}
                    routePath={routePath}
                    createRiderMarkerContent={createRiderMarkerContent}
                    createDestinationMarkerContent={createDestinationMarkerContent}
                  />
                )}
              </Box>
            </Box>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
                <Assignment sx={{ mr: 1, color: "#334155" }} />
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Recent Deliveries</Typography>
              </Box>

              {deliveries.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 2 }}>
                  No deliveries assigned yet.
                </Typography>
              ) : (
                <Box>
                  {deliveries.map((delivery) => (
                    <Card
                      key={delivery.id}
                      sx={{ mb: 1.3, p: 1.5, cursor: "pointer", borderRadius: 2, "&:hover": { boxShadow: 2 }, transition: "all 0.2s ease" }}
                      onClick={() => handleDeliveryClick(delivery)}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 1.2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Order #{delivery.orderId || delivery.id.slice(0, 8)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.3 }}>
                            Pickup: {delivery.pickupLocation?.address || "N/A"}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                            Dropoff: {delivery.dropoffLocation?.address || "N/A"}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Chip label={normalizeDeliveryStatus(delivery.status) || DELIVERY_STATUS.NEW} color={getStatusColor(delivery.status)} size="small" sx={{ mb: 0.8 }} />
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(delivery.deliveryFee)}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>

          <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 88, width: "90%", maxWidth: 380, zIndex: 35 }}>
            <Box sx={{ bgcolor: "rgba(91,236,19,0.95)", borderRadius: 2.5, px: 2, py: 1.2, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 8px 22px rgba(91,236,19,0.28)", border: "1px solid rgba(255,255,255,0.4)" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <RadioButtonChecked sx={{ fontSize: 12, color: "#0f172a" }} />
                <Typography sx={{ color: "#0f172a", fontSize: 13, fontWeight: 800 }}>
                  {isOnline ? "Ready for orders" : "Currently offline"}
                </Typography>
              </Box>
              <Explore sx={{ color: "#0f172a", fontSize: 20 }} />
            </Box>
          </Box>

          <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 430, bgcolor: "rgba(255,255,255,0.96)", borderTop: "1px solid #e2e8f0", px: 1.5, pt: 1, pb: 2, zIndex: 30 }}>
            <Box sx={{ display: "flex", justifyContent: "space-around" }}>
              <Button onClick={() => navigate("/dashboard")} sx={{ minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <Home sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: "none" }}>Home</Typography>
              </Button>
              <Button onClick={() => navigate("/orders")} sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <Assignment sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Orders</Typography>
              </Button>
              <Button onClick={() => navigate("/wallet")} sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <AccountBalanceWallet sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Wallet</Typography>
              </Button>
              <Button onClick={() => navigate("/profile")} sx={{ minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2 }}>
                <Person sx={{ fontSize: 28 }} />
                <Typography sx={{ fontSize: 10, fontWeight: 600, textTransform: "none" }}>Profile</Typography>
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog open={deliveryDialog} onClose={() => setDeliveryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Delivery #{selectedDelivery?.orderId || selectedDelivery?.id?.slice(0, 8)}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedDelivery && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Status: <Chip label={normalizeDeliveryStatus(selectedDelivery.status) || DELIVERY_STATUS.NEW} size="small" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Pickup:</strong> {selectedDelivery.pickupLocation?.address || "N/A"}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Dropoff:</strong> {selectedDelivery.dropoffLocation?.address || "N/A"}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Delivery Fee:</strong> ₱{selectedDelivery.deliveryFee?.toFixed(2) || "0.00"}
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Add Notes"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeliveryDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleUpdateDelivery(DELIVERY_STATUS.IN_DELIVERY)}
            disabled={
              normalizeDeliveryStatus(selectedDelivery?.status) === DELIVERY_STATUS.IN_DELIVERY ||
              normalizeDeliveryStatus(selectedDelivery?.status) === DELIVERY_STATUS.DELIVERED
            }
          >
            Mark In Transit
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleUpdateDelivery(DELIVERY_STATUS.DELIVERED)}
            disabled={normalizeDeliveryStatus(selectedDelivery?.status) === DELIVERY_STATUS.DELIVERED}
          >
            Complete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RiderDashboard;
