import React, { useEffect, useMemo, useState } from "react";
import { Dialog, useMediaQuery, useTheme, Box, Button as MUIButton } from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { GoogleMap, MarkerF, InfoWindowF, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import CapitalShareVoucherSuccessScreen from "./CapitalShareVoucherSuccessScreen";
import merchantIcon from "../../../../assets/merchanticon.png";

const TARGET_MERCHANTS = [
  { email: "jumamoyime@gmail.com", kind: "Meat", schedule: "Mon - Sat • 08:00 - 18:00" },
  { email: "gerlypagantian6@gmail.com", kind: "Rice", schedule: "Mon - Sat • 08:00 - 18:00" },
];

const FALLBACK_BRANCHES = [
  {
    id: "merchant_meat_fallback",
    merchantId: null,
    email: "jumamoyime@gmail.com",
    kind: "Meat",
    name: "Meat Store",
    address: "Location not set",
    schedule: "Mon - Sat • 08:00 - 18:00",
    lat: 14.3520,
    lng: 121.0125,
  },
  {
    id: "merchant_rice_fallback",
    merchantId: null,
    email: "gerlypagantian6@gmail.com",
    kind: "Rice",
    name: "Rice Store",
    address: "Location not set",
    schedule: "Mon - Sat • 08:00 - 18:00",
    lat: 14.3520,
    lng: 121.0125,
  },
];

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Reverse geocode coordinates to get city name
const getAddressFromCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.address?.city || data.address?.county || data.address?.state || "Unknown Location";
  } catch (error) {
    console.error("Geocoding error:", error);
    return "Unknown Location";
  }
};

const resolveMerchantName = (data, fallback) => {
  return data.storeName || data.businessName || data.name || fallback;
};

const resolveMerchantAddress = (data) => {
  return data.location || [data.address, data.city].filter(Boolean).join(", ") || "Location not set";
};

const buildVoucherCode = ({ status, branchKind }) => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  const statusToken = status === "OFW" ? "OFW" : "WALK";
  const kindToken = (branchKind || "GEN").slice(0, 1).toUpperCase();
  return `VCR-${day}${hour}${minute}-${random}-${statusToken}-${kindToken}`;
};

const normalizeVoucherKind = (kind) => String(kind || "").trim().toUpperCase();

const prettifyVoucherKind = (kind) => {
  const normalized = normalizeVoucherKind(kind);
  if (!normalized) return "Voucher";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
};

const resolveDefaultSplitBranch = (targetKind, branches) => {
  const normalizedKind = normalizeVoucherKind(targetKind);
  const matchedBranch = (branches || []).find(
    (branch) => normalizeVoucherKind(branch.kind) === normalizedKind
  );

  if (matchedBranch) {
    return {
      branchId: matchedBranch.merchantId || null,
      branchName: matchedBranch.name || `${prettifyVoucherKind(normalizedKind)} Store`,
      branchAddress: matchedBranch.address || "Location not set",
      branchEmail: matchedBranch.email || "",
    };
  }

  const fallbackBranch = FALLBACK_BRANCHES.find(
    (branch) => normalizeVoucherKind(branch.kind) === normalizedKind
  );

  return {
    branchId: fallbackBranch?.merchantId || null,
    branchName: fallbackBranch?.name || `${prettifyVoucherKind(normalizedKind)} Store`,
    branchAddress: fallbackBranch?.address || "Location not set",
    branchEmail: fallbackBranch?.email || "",
  };
};

const WalkInBranchDialog = ({
  open,
  onClose,
  onConfirmDone,
  saving = false,
  onDone,
  onViewVouchers,
  adminRewardConfigs = [],
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  // Location and Map states
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 }); // Default to Philippines
  const [userCity, setUserCity] = useState(null);
  
  // Branch and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState(FALLBACK_BRANCHES[0].id);
  const [loadingBranches, setLoadingBranches] = useState(false);
  
  // Voucher states
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmedStatusLabel, setConfirmedStatusLabel] = useState("WALK-IN");
  const [generatedVoucherCode, setGeneratedVoucherCode] = useState("VCR-0000-0000-WALK-X");
  const [voucherIssuedAt, setVoucherIssuedAt] = useState(new Date());
  const [pendingVoucherPayload, setPendingVoucherPayload] = useState(null);
  
  // Voucher selection states
  const [showVoucherSelectionModal, setShowVoucherSelectionModal] = useState(false);
  const [selectedVouchers, setSelectedVouchers] = useState([]);
  const [availableVoucherKinds, setAvailableVoucherKinds] = useState(new Set());
  
  // InfoWindow state for marker labels
  const [infoWindowOpen, setInfoWindowOpen] = useState(null); // Track which marker's info window is open
  const [directionsResult, setDirectionsResult] = useState(null); // Store directions result
  const [directionsService, setDirectionsService] = useState(null);
  
  // Google Maps loader
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ["places"],
  });

  // Request location permission
  const requestLocationAccess = async () => {
    setLocationLoading(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setMapCenter({ lat: latitude, lng: longitude });
        
        // Get city name from reverse geocoding
        try {
          const city = await getAddressFromCoordinates(latitude, longitude);
          setUserCity(city);
          // Auto-filter branches by city if found
          setSearchTerm(city);
        } catch (error) {
          console.error("Failed to get city:", error);
        }
        
        setLocationLoading(false);
        setShowLocationPrompt(false);
        // Show voucher selection modal after location is enabled
        setShowVoucherSelectionModal(true);
      },
      (error) => {
        let errorMessage = "Unable to get your location.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Location access denied. Please enable location in your browser/app settings.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Location unavailable. Please try again.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Location request timed out. Please try again.";
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  useEffect(() => {
    if (!open) return;

    const fetchMerchantBranches = async () => {
      try {
        setLoadingBranches(true);
        const emails = TARGET_MERCHANTS.map((item) => item.email);
        const q = query(collection(db, "users"), where("email", "in", emails));
        const snapshot = await getDocs(q);

        const byEmail = new Map();
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data?.email) return;
          byEmail.set(String(data.email).toLowerCase(), { id: docSnap.id, ...data });
        });

        const nextBranches = TARGET_MERCHANTS.map((target) => {
          const merchant = byEmail.get(target.email);
          if (!merchant) {
            return {
              id: `merchant_${target.kind.toLowerCase()}_fallback`,
              merchantId: null,
              email: target.email,
              kind: target.kind,
              name: `${target.kind} Store`,
              address: "Location not set",
              schedule: target.schedule,
              lat: FALLBACK_BRANCHES.find(b => b.email === target.email)?.lat || 14.3520,
              lng: FALLBACK_BRANCHES.find(b => b.email === target.email)?.lng || 121.0125,
            };
          }

          return {
            id: merchant.id,
            merchantId: merchant.id,
            email: target.email,
            kind: target.kind,
            name: resolveMerchantName(merchant, `${target.kind} Store`),
            address: resolveMerchantAddress(merchant),
            schedule: target.schedule,
            lat: merchant.latitude || merchant.lat || 14.3520,
            lng: merchant.longitude || merchant.lng || 121.0125,
          };
        });

        setBranches(nextBranches);
        setSelectedBranchId(nextBranches[0]?.id || "");
        setShowSuccessScreen(false);
        setSelectedVouchers([]); // Reset voucher selections when dialog opens
        
        // Show location prompt on initial load
        if (!userLocation) {
          setShowLocationPrompt(true);
        }
      } catch (error) {
        console.error("Failed to load merchant branches:", error);
        setBranches(FALLBACK_BRANCHES);
        setSelectedBranchId(FALLBACK_BRANCHES[0].id);
        setShowSuccessScreen(false);
        setSelectedVouchers([]); // Reset voucher selections on error too
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchMerchantBranches();
  }, [open]);

  const filteredBranches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    
    let filtered = branches;
    
    // Filter by search term (city, name, or kind)
    if (term) {
      filtered = branches.filter((branch) => {
        return (
          branch.name.toLowerCase().includes(term) ||
          branch.address.toLowerCase().includes(term) ||
          (branch.kind || "").toLowerCase().includes(term)
        );
      });
    }
    
    // Sort by distance if user location is available
    if (userLocation && userLocation.lat && userLocation.lng) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          a.lat || 0,
          a.lng || 0
        );
        const distB = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          b.lat || 0,
          b.lng || 0
        );
        return distA - distB;
      });
    }
    
    return filtered;
  }, [branches, searchTerm, userLocation]);

  const selectedBranch = useMemo(() => {
    return filteredBranches.find((branch) => branch.id === selectedBranchId) || filteredBranches[0] || null;
  }, [filteredBranches, selectedBranchId]);

  // Update available voucher kinds based on branches in user's area
  useEffect(() => {
    if (!userLocation || !filteredBranches.length) return;
    
    const kindsInArea = new Set();
    filteredBranches.forEach((branch) => {
      if (branch.kind) {
        kindsInArea.add(branch.kind);
      }
    });
    setAvailableVoucherKinds(kindsInArea);
  }, [userLocation, filteredBranches]);

  const openDirections = (address) => {
    if (!address || address === "Location not set") return;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  // Calculate directions when branch is selected
  useEffect(() => {
    if (!userLocation || !selectedBranch || !isLoaded) return;

    if (!directionsService && window.google) {
      setDirectionsService(new window.google.maps.DirectionsService());
    }

    if (directionsService && selectedBranch.lat && selectedBranch.lng) {
      directionsService.route(
        {
          origin: userLocation,
          destination: { lat: selectedBranch.lat, lng: selectedBranch.lng },
          travelMode: window.google?.maps?.TravelMode?.DRIVING,
        },
        (result, status) => {
          if (status === window.google?.maps?.DirectionsStatus?.OK) {
            setDirectionsResult(result);
          } else {
            console.error("Directions request failed:", status);
          }
        }
      );
    }
  }, [userLocation, selectedBranch, isLoaded, directionsService]);

  const handleConfirmWalkIn = async () => {
    if (!selectedBranch || saving) return;
    setConfirmedStatusLabel("WALK-IN");
    const issuedAt = new Date();
    
    // Generate voucher code for the selected branch
    const voucherCode = buildVoucherCode({
      status: "WALK-IN",
      branchKind: selectedBranch?.kind,
    });
    
    // Generate codes for all selected vouchers
    const voucherCodes = selectedVouchers.map((type) =>
      buildVoucherCode({
        status: "WALK-IN",
        branchKind: type.includes("POINTS") ? "POINTS" : type,
      })
    );
    
    setGeneratedVoucherCode(voucherCode);
    setVoucherIssuedAt(issuedAt);
    setPendingVoucherPayload({
      branchId: selectedBranch?.merchantId || null,
      branchName: selectedBranch?.name || "",
      branchAddress: selectedBranch?.address || "",
      branchEmail: selectedBranch?.email || "",
      voucherCode,
      voucherCodes, // All selected vouchers
      selectedVoucherTypes: selectedVouchers, // Track which types were selected
      voucherType: "WALK_IN",
      voucherIssuedAt: issuedAt,
      voucherStatus: "ACTIVE",
    });
    setShowSuccessScreen(true);
  };

  const handleDone = async () => {
    if (submittingAction) return;
    setSubmittingAction(true);
    try {
      if (pendingVoucherPayload && onConfirmDone) {
        const success = await onConfirmDone(pendingVoucherPayload);
        if (!success) return;
      }
      if (onDone) onDone();
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleViewVouchers = async () => {
    if (submittingAction) return;
    setSubmittingAction(true);
    try {
      if (pendingVoucherPayload && onConfirmDone) {
        const success = await onConfirmDone(pendingVoucherPayload);
        if (!success) return;
      }
      if (onViewVouchers) {
        onViewVouchers();
        return;
      }
      if (onDone) onDone();
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDialogClose = () => {
    if (submittingAction) return;
    if (onClose) onClose();
  };
  
  const toggleVoucher = (voucherType) => {
    setSelectedVouchers((prev) => {
      if (prev.includes(voucherType)) {
        return prev.filter((v) => v !== voucherType);
      } else if (prev.length < 2) {
        return [...prev, voucherType];
      }
      return prev;
    });
  };
  
  const hasAdminConfiguredRewards = Array.isArray(adminRewardConfigs) && adminRewardConfigs.length > 0;

  const adminVoucherKindMap = useMemo(() => {
    const map = new Map();
    adminRewardConfigs.forEach((cfg) => {
      if (String(cfg?.rewardType || "").toUpperCase() !== "VOUCHER") return;
      const key = normalizeVoucherKind(cfg.voucherKind);
      if (key) {
        map.set(key, cfg);
      }
    });
    return map;
  }, [adminRewardConfigs]);

  const handleVoucherSelectionConfirm = () => {
    if (selectedVouchers.length !== 2) return;

    if (hasAdminConfiguredRewards) {
      const selectedOptions = voucherOptions.filter((option) => selectedVouchers.includes(option.type));
      if (!selectedOptions.length) return;

      const issuedAt = new Date();
      const generatedCodes = [];
      const selectedRewards = [];

      selectedOptions.forEach((option, optionIndex) => {
        if (option.rewardType === "POINTS_SPLIT") {
          const splitTargets = Array.isArray(option.splitTargets) ? option.splitTargets : [];
          if (!splitTargets.length) {
            return;
          }

          const mappedSplitTargets = splitTargets.map((target, targetIndex) => {
            const targetKind = normalizeVoucherKind(target.voucherKind);
            const matchedVoucherCfg = adminVoucherKindMap.get(targetKind);
            const fallbackBranch = resolveDefaultSplitBranch(targetKind, branches);
            const voucherCode = buildVoucherCode({
              status: "WALK-IN",
              branchKind: targetKind || "POINTS",
            });
            const claimablePercent = Number(target.claimablePercent || 0);
            const pointsConvertPercent = Number(target.pointsConvertPercent ?? 100 - claimablePercent);

            generatedCodes.push(voucherCode);
            return {
              voucherCode,
              voucherKind: targetKind,
              claimablePercent,
              pointsConvertPercent,
              voucherStatus: String(target.voucherStatus || "HOLD").toUpperCase(),
              holdReason: `${option.label || "Points Reward"}: ${pointsConvertPercent}% points convert + ${claimablePercent}% claimable ${prettifyVoucherKind(targetKind)} voucher`,
              branchId: matchedVoucherCfg?.branchId || fallbackBranch.branchId || null,
              branchName: matchedVoucherCfg?.branchName || fallbackBranch.branchName || "",
              branchAddress: matchedVoucherCfg?.branchAddress || fallbackBranch.branchAddress || "",
              branchEmail: matchedVoucherCfg?.branchEmail || fallbackBranch.branchEmail || "",
              targetKey: `${option.id || optionIndex}_${targetKind}_${targetIndex}`,
            };
          });

          selectedRewards.push({
            configId: option.configId || option.id,
            rewardType: "POINTS_SPLIT",
            label: option.label,
            splitTargets: mappedSplitTargets,
          });
          return;
        }

        const voucherKind = normalizeVoucherKind(option.voucherKind);
        const voucherCode = buildVoucherCode({
          status: "WALK-IN",
          branchKind: voucherKind,
        });

        generatedCodes.push(voucherCode);
        selectedRewards.push({
          configId: option.id,
          rewardType: "VOUCHER",
          label: option.label,
          voucherCode,
          voucherKind,
          voucherStatus: "ACTIVE",
          claimablePercent: 100,
          branchId: option.branchId || selectedBranch?.merchantId || null,
          branchName: option.branchName || selectedBranch?.name || "",
          branchAddress: option.branchAddress || selectedBranch?.address || "",
          branchEmail: option.branchEmail || selectedBranch?.email || "",
        });
      });

      if (!selectedRewards.length) {
        return;
      }

      setPendingVoucherPayload({
        voucherType: "WALK_IN",
        voucherIssuedAt: issuedAt,
        voucherStatus: "ACTIVE",
        selectedRewards,
        selectedVoucherTypes: selectedVouchers,
      });

      setGeneratedVoucherCode(generatedCodes[0] || buildVoucherCode({ status: "WALK-IN", branchKind: "GEN" }));
      setVoucherIssuedAt(issuedAt);
      setConfirmedStatusLabel("REWARDS SELECTED");
      setShowVoucherSelectionModal(false);
      setShowSuccessScreen(true);
      return;
    }
    
    // If both merchants are unavailable, skip branch selection and go directly to success
    if (unavailableMerchantCount === 2) {
      const issuedAt = new Date();
      const voucherCodes = selectedVouchers.map((type) =>
        buildVoucherCode({
          status: "WALK-IN",
          branchKind: type.includes("POINTS") ? "POINTS" : type,
        })
      );
      
      setPendingVoucherPayload({
        branchId: null,
        branchName: "Points Reward - No Local Merchant",
        branchAddress: "Claim when merchants open in your area",
        branchEmail: null,
        voucherCodes,
        voucherTypes: selectedVouchers,
        voucherType: "WALK_IN_POINTS",
        voucherIssuedAt: issuedAt,
        voucherStatus: "ACTIVE",
      });
      
      setGeneratedVoucherCode(voucherCodes[0]);
      setVoucherIssuedAt(issuedAt);
      setConfirmedStatusLabel("POINTS REWARD");
      setShowVoucherSelectionModal(false);
      setShowSuccessScreen(true);
      return;
    }
    
    // Otherwise, proceed to branch selection
    setShowVoucherSelectionModal(false);
  };
  
  // Check if a merchant voucher kind is available in the area
  const isMerchantAvailable = (kind) => {
    return availableVoucherKinds.has(kind);
  };
  
  // Determine voucher options based on merchant availability in the area
  const riceAvailable = isMerchantAvailable("Rice");
  const meatAvailable = isMerchantAvailable("Meat");
  const unavailableMerchantCount = (riceAvailable ? 0 : 1) + (meatAvailable ? 0 : 1);
  
  const voucherOptions = [];

  if (hasAdminConfiguredRewards) {
    adminRewardConfigs.forEach((configDoc, index) => {
      const rewardType = String(configDoc.rewardType || "VOUCHER").toUpperCase();
      const configId = configDoc.id || `reward_${index}`;

      if (rewardType === "POINTS_SPLIT") {
        const splitTargets = Array.isArray(configDoc.splitTargets)
          ? configDoc.splitTargets
          : [];

        if (!splitTargets.length) return;

        splitTargets.forEach((target, targetIndex) => {
          const targetKind = normalizeVoucherKind(target.voucherKind);
          const claimablePercent = Number(target.claimablePercent || 0);
          if (!targetKind || claimablePercent <= 0) return;

          const pointsConvertPercent = Number(target.pointsConvertPercent ?? 100 - claimablePercent);

          voucherOptions.push({
            id: `${configId}_${targetKind}_${targetIndex}`,
            configId,
            type: `POINTS_SPLIT_${configId}_${targetKind}_${targetIndex}`,
            rewardType: "POINTS_SPLIT",
            voucherKind: targetKind,
            label: `${configDoc.label || "Points Reward"} - ${prettifyVoucherKind(targetKind)}`,
            icon: configDoc.icon || "card_giftcard",
            color: configDoc.color || "bg-blue-50 border-blue-200",
            description: `${pointsConvertPercent}% points + ${claimablePercent}% ${prettifyVoucherKind(targetKind)} voucher`,
            splitTargets: [
              {
                ...target,
                voucherKind: targetKind,
                claimablePercent,
                pointsConvertPercent,
                targetKey: `${configId}_${targetKind}_${targetIndex}`,
              },
            ],
          });
        });
        return;
      }

      const voucherKind = normalizeVoucherKind(configDoc.voucherKind || configDoc.kind);
      voucherOptions.push({
        id: configId,
        type: `VOUCHER_${configId}`,
        rewardType: "VOUCHER",
        voucherKind,
        label: configDoc.label || `${prettifyVoucherKind(voucherKind)} Voucher`,
        icon: configDoc.icon || "confirmation_number",
        color: configDoc.color || "bg-amber-50 border-amber-200",
        branchId: configDoc.branchId || null,
        branchName: configDoc.branchName || "",
        branchAddress: configDoc.branchAddress || "",
        branchEmail: configDoc.branchEmail || "",
      });
    });
  }
  
  // Add merchant vouchers only if available in the area
  if (!hasAdminConfiguredRewards && riceAvailable) {
    voucherOptions.push({
      type: "RICE",
      label: "Rice Voucher",
      icon: "local_grocery_store",
      color: "bg-amber-50 border-amber-200",
    });
  }
  
  if (!hasAdminConfiguredRewards && meatAvailable) {
    voucherOptions.push({
      type: "MEAT",
      label: "Meat Voucher",
      icon: "restaurant",
      color: "bg-red-50 border-red-200",
    });
  }
  
  // Add Points Reward options for unavailable merchants
  if (!hasAdminConfiguredRewards && unavailableMerchantCount === 1) {
    // One merchant missing - show 1 Points Reward (50% now, 50% later)
    voucherOptions.push({
      type: "POINTS",
      label: "Points Reward",
      icon: "card_giftcard",
      color: "bg-blue-50 border-blue-200",
      description: "50% claimable now, 50% when merchant opens nearby",
    });
  } else if (!hasAdminConfiguredRewards && unavailableMerchantCount === 2) {
    // Both merchants missing - show 2 Points Rewards
    voucherOptions.push({
      type: "POINTS_1",
      label: "Points Reward",
      icon: "card_giftcard",
      color: "bg-blue-50 border-blue-200",
      description: "Claim when merchants open nearby",
    });
    voucherOptions.push({
      type: "POINTS_2",
      label: "Points Reward",
      icon: "card_giftcard",
      color: "bg-blue-50 border-blue-200",
      description: "Claim when merchants open nearby",
    });
  }
  
  // Voucher selection modal
  if (showVoucherSelectionModal && !showSuccessScreen && userLocation) {
    return (
      <Dialog
        open={open}
        onClose={handleDialogClose}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            m: 0,
            borderRadius: isMobile ? 0 : 4,
            height: isMobile ? "100dvh" : "auto",
            overflow: "hidden",
            background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
          },
        }}
      >
        <div className="font-display text-slate-900 h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-sm w-full">
            {/* Close button */}
            <button
              type="button"
              onClick={handleDialogClose}
              className="absolute -top-12 left-0 text-slate-700 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary">card_giftcard</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
              Select Your Rewards
            </h2>
            <p className="text-slate-600 text-center mb-8">
              {hasAdminConfiguredRewards
                ? "Choose 2 rewards configured by Admin"
                : unavailableMerchantCount === 2 
                ? "Choose 2 points rewards (claim when merchants arrive)"
                : "Choose 2 vouchers to receive today"
              }
            </p>

            {/* Voucher options */}
            <div className="space-y-3 mb-8">
              {voucherOptions.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => toggleVoucher(option.type)}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${ selectedVouchers.includes(option.type)
                    ? "border-primary bg-primary/10 shadow-lg"
                    : `border-slate-200 ${option.color} hover:border-slate-300`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${ selectedVouchers.includes(option.type)
                      ? "bg-primary text-white"
                      : "bg-white/80"
                    }`}>
                      {selectedVouchers.includes(option.type) ? (
                        <span className="material-symbols-outlined text-lg">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-lg">{option.icon}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">{option.label}</h3>
                      {option.description && <p className="text-xs text-slate-600 leading-snug">{option.description}</p>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selection counter */}
            <p className="text-xs text-slate-500 text-center mb-6">
              {selectedVouchers.length}/2 selected
            </p>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleVoucherSelectionConfirm}
              disabled={selectedVouchers.length !== 2}
              className="w-full px-6 py-3 rounded-xl bg-primary text-slate-900 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Branches
            </button>

            {/* Info note */}
            <p className="text-xs text-slate-500 text-center mt-6">
              {hasAdminConfiguredRewards
                ? "Your selected rewards will be saved to your voucher wallet"
                : unavailableMerchantCount === 2 
                ? "Points will be credited when merchants open in your area" 
                : "You'll select a specific branch location after this"
              }
            </p>
          </div>
        </div>
      </Dialog>
    );
  }
  
  // Location permission modal
  if (showLocationPrompt && !showSuccessScreen) {
    return (
      <Dialog
        open={open}
        onClose={handleDialogClose}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            m: 0,
            borderRadius: isMobile ? 0 : 4,
            height: isMobile ? "100dvh" : "auto",
            overflow: "hidden",
            background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
          },
        }}
      >
        <div className="font-display text-slate-900 h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-sm w-full">
            {/* Close button */}
            <button
              type="button"
              onClick={handleDialogClose}
              className="absolute -top-12 left-0 text-slate-700 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Location icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary">location_on</span>
              </div>
            </div>

            {/* Title and description */}
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">
              Enable Location Access
            </h2>
            <p className="text-slate-600 text-center mb-6">
              We'll help you find the nearest merchant branches in your area. Share your location to see branches close to you.
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-slate-200">
                <span className="material-symbols-outlined text-primary text-xl">map</span>
                <span className="text-sm text-slate-700">See branches near you</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-slate-200">
                <span className="material-symbols-outlined text-primary text-xl">near_me</span>
                <span className="text-sm text-slate-700">Get accurate directions</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-slate-200">
                <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                <span className="text-sm text-slate-700">Find open branches now</span>
              </div>
            </div>

            {/* Error message */}
            {locationError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{locationError}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={requestLocationAccess}
                disabled={locationLoading}
                className="w-full px-6 py-3 rounded-xl bg-primary text-slate-900 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">location_on</span>
                {locationLoading ? "Getting your location..." : "Enable Location Access"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocationPrompt(false);
                  setShowVoucherSelectionModal(true);
                }}
                className="w-full px-6 py-3 rounded-xl bg-slate-200 text-slate-900 font-bold text-sm hover:bg-slate-300 transition-colors"
              >
                Use Default Location
              </button>
            </div>

            {/* Privacy note */}
            <p className="text-xs text-slate-500 text-center mt-6">
              Your location is only used to find nearby branches and won't be stored.
            </p>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          m: 0,
          borderRadius: isMobile ? 0 : 4,
          height: isMobile ? "100dvh" : "90vh",
          overflow: "hidden",
          background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
        },
      }}
    >
      <div className="font-display text-slate-900 h-full flex flex-col relative overflow-hidden">
        <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sky-200/40 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl pointer-events-none" />
        {showSuccessScreen ? (
          <CapitalShareVoucherSuccessScreen
            statusLabel={confirmedStatusLabel}
            voucherCode={generatedVoucherCode}
            issuedAt={voucherIssuedAt}
            onClose={() => {
              if (submittingAction) return;
              setShowSuccessScreen(false);
              setPendingVoucherPayload(null);
            }}
            onDone={handleDone}
            onViewVouchers={handleViewVouchers}
            isProcessing={submittingAction || saving}
          />
        ) : (
          <>
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 pt-[max(env(safe-area-inset-top),0px)]">
          <div className="flex items-center p-4 justify-between">
            <button
              type="button"
              onClick={handleDialogClose}
              disabled={submittingAction}
              className="text-slate-700 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
              Branch Locations
            </h2>
          </div>

          <div className="px-4 pb-4">
            <label className="flex flex-col w-full group">
              <div className="flex w-full items-stretch rounded-2xl h-12 bg-white/85 border border-slate-200 focus-within:border-sky-300 shadow-sm transition-all">
                <div className="text-slate-500 flex items-center justify-center pl-4">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </div>
                <input
                  className="flex w-full min-w-0 flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder:text-slate-400 px-3 text-sm font-medium"
                  placeholder="Search by City or Branch Name"
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </label>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar pb-40 relative z-10">
            <>
              <div className="px-4 py-2">
                <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-slate-100 border border-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                  {isLoaded ? (
                    <GoogleMap
                      center={userLocation || mapCenter}
                      zoom={15}
                      mapContainerStyle={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "1.5rem",
                      }}
                      options={{
                        mapTypeControl: false,
                        fullscreenControl: false,
                        streetViewControl: false,
                        clickableIcons: false,
                      }}
                    >
                      {/* User location marker */}
                      {userLocation && (
                        <MarkerF
                          position={userLocation}
                          title="Your Location"
                          icon={{
                            path: window.google?.maps?.SymbolPath?.CIRCLE,
                            scale: 8,
                            fillColor: "#3b82f6",
                            fillOpacity: 1,
                            strokeColor: "#ffffff",
                            strokeWeight: 2,
                          }}
                        />
                      )}
                      
                      {/* Directions route */}
                      {directionsResult && (
                        <DirectionsRenderer
                          directions={directionsResult}
                          options={{
                            polylineOptions: {
                              strokeColor: "#30e86e",
                              strokeOpacity: 0.8,
                              strokeWeight: 3,
                            },
                            markerOptions: {
                              visible: false,
                            },
                          }}
                        />
                      )}
                      
                      {/* Distance and duration display */}
                      {userLocation && selectedBranch && directionsResult && (
                        <div style={{
                          position: "absolute",
                          bottom: "20px",
                          right: "20px",
                          background: "white",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                          fontSize: "14px",
                          fontWeight: "500",
                          color: "#0f172a",
                          zIndex: 10,
                        }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <span style={{ color: "#f97316" }}>●</span>
                            <span>
                              {((directionsResult.routes[0]?.legs[0]?.distance?.value || 0) / 1000).toFixed(1)} km
                            </span>
                            <span style={{ color: "#94a3b8" }}>•</span>
                            <span>
                              {Math.round((directionsResult.routes[0]?.legs[0]?.duration?.value || 0) / 60)} min
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Branch markers */}
                      {filteredBranches.map((branch) => (
                        <React.Fragment key={branch.id}>
                          <MarkerF
                            position={{ lat: branch.lat || 0, lng: branch.lng || 0 }}
                            title={branch.name}
                            icon={{
                              url: merchantIcon,
                              scaledSize: window.google ? new window.google.maps.Size(40, 40) : undefined,
                              origin: window.google ? new window.google.maps.Point(0, 0) : undefined,
                              anchor: window.google ? new window.google.maps.Point(20, 40) : undefined,
                            }}
                            onClick={() => {
                              setSelectedBranchId(branch.id);
                              setInfoWindowOpen(branch.id);
                            }}
                            options={{
                              opacity: branch.id === selectedBranchId ? 1 : 0.6,
                              zIndex: branch.id === selectedBranchId ? 100 : 50,
                            }}
                          />
                          
                          {/* InfoWindow for branch name */}
                          {infoWindowOpen === branch.id && (
                            <InfoWindowF
                              position={{ lat: branch.lat || 0, lng: branch.lng || 0 }}
                              onCloseClick={() => setInfoWindowOpen(null)}
                              options={{
                                pixelOffset: new window.google.maps.Size(0, -30),
                              }}
                            >
                              <div style={{
                                background: "white",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                boxShadow: "0 2px 7px rgba(0,0,0,0.2)",
                                maxWidth: "200px",
                              }}>
                                <p style={{
                                  margin: "0 0 4px 0",
                                  fontWeight: "bold",
                                  fontSize: "14px",
                                  color: "#0f172a",
                                }}>
                                  {branch.name}
                                </p>
                                <p style={{
                                  margin: "0 0 4px 0",
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}>
                                  {branch.kind} Merchant
                                </p>
                                <p style={{
                                  margin: "0",
                                  fontSize: "11px",
                                  color: "#94a3b8",
                                  lineHeight: "1.3",
                                }}>
                                  {branch.address}
                                </p>
                              </div>
                            </InfoWindowF>
                          )}
                        </React.Fragment>
                      ))}
                    </GoogleMap>
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-slate-200">
                      <span className="text-slate-600">Loading map...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900 text-lg font-bold tracking-tight">Nearby Branches</h3>
                {userLocation && <p className="text-xs text-slate-500 mt-1">{userCity || "Your Location"}</p>}
              </div>
              <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white/80 border border-slate-200 rounded-full">
                {filteredBranches.length} Found
              </span>
            </div>

            <div className="space-y-4 pb-6">
              {loadingBranches && (
                <div className="text-xs text-slate-500 px-1">Loading merchant branches...</div>
              )}

              {filteredBranches.map((branch) => {
                const distance = userLocation
                  ? calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      branch.lat || 0,
                      branch.lng || 0
                    )
                  : null;

                return (
                  <div
                    key={branch.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBranchId(branch.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedBranchId(branch.id);
                      }
                    }}
                    className={branch.id === selectedBranchId
                      ? "bg-white rounded-2xl p-5 border-2 border-primary shadow-[0_8px_24px_rgba(48,232,110,0.2)] relative"
                      : "bg-white/85 rounded-2xl p-5 border border-slate-200 hover:border-sky-300 transition-all shadow-sm"
                    }
                  >
                    {branch.id === selectedBranchId && (
                      <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-primary px-2.5 py-1 rounded-full">
                        <span className="material-symbols-outlined text-[14px] text-background-dark fill-current">check_circle</span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-background-dark">Selected</span>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <div className={branch.id === selectedBranchId
                        ? "size-12 rounded-xl bg-primary flex items-center justify-center shrink-0"
                        : "size-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"
                      }>
                        <img 
                          src={merchantIcon} 
                          alt={branch.kind}
                          className={branch.id === selectedBranchId
                            ? "w-6 h-6 invert"
                            : "w-6 h-6"
                          }
                        />
                      </div>
                      <div className={branch.id === selectedBranchId ? "flex-1 pr-16" : "flex-1"}>
                        <h4 className="text-slate-900 font-bold text-base leading-tight">{branch.name}</h4>
                        <p className="text-primary text-[11px] font-bold uppercase tracking-wide mt-1">{branch.kind} Merchant</p>
                        <p className="text-slate-500 text-xs mt-1 leading-relaxed">{branch.address}</p>
                        {distance !== null && (
                          <p className="text-primary text-[11px] font-bold uppercase tracking-wide mt-1">
                            📍 {distance.toFixed(1)} km away
                          </p>
                        )}
                      </div>
                      {branch.id !== selectedBranchId && (
                        <div className="text-right">
                          <span className="text-xs font-bold text-sky-600">Tap to view</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">schedule</span>
                        <span className="text-xs text-slate-500">{branch.schedule}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDirections(branch.address);
                        }}
                        className={branch.id === selectedBranchId
                          ? "flex items-center gap-1.5 px-4 py-2 bg-primary text-background-dark font-bold text-xs rounded-xl hover:bg-primary/90 transition-colors"
                          : "flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors"
                        }
                      >
                        <span className="material-symbols-outlined text-sm">directions</span>
                        Get Directions
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
              </div>
            </>
        </main>

        <div className="sticky bottom-0 z-20 p-4 border-t border-slate-200 bg-white/90 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            type="button"
            disabled={!selectedBranch || saving || submittingAction}
            onClick={handleConfirmWalkIn}
            className="w-full h-12 rounded-2xl bg-[#111827] text-white font-semibold text-sm hover:bg-[#1f2937] transition-colors shadow-[0_8px_20px_rgba(17,24,39,0.2)]"
          >
            {saving ? "Saving..." : "Confirm Walk-In Selection"}
          </button>
        </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default WalkInBranchDialog;