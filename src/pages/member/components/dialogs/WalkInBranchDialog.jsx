import React, { useEffect, useMemo, useState } from "react";
import { Dialog, useMediaQuery, useTheme } from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import CapitalShareVoucherSuccessScreen from "./CapitalShareVoucherSuccessScreen";

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
  },
  {
    id: "merchant_rice_fallback",
    merchantId: null,
    email: "gerlypagantian6@gmail.com",
    kind: "Rice",
    name: "Rice Store",
    address: "Location not set",
    schedule: "Mon - Sat • 08:00 - 18:00",
  },
];

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

const WalkInBranchDialog = ({ open, onClose, onConfirmDone, saving = false, onDone, onViewVouchers }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchTerm, setSearchTerm] = useState("");
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const [selectedBranchId, setSelectedBranchId] = useState(FALLBACK_BRANCHES[0].id);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmedStatusLabel, setConfirmedStatusLabel] = useState("WALK-IN");
  const [generatedVoucherCode, setGeneratedVoucherCode] = useState("VCR-0000-0000-WALK-X");
  const [voucherIssuedAt, setVoucherIssuedAt] = useState(new Date());
  const [pendingVoucherPayload, setPendingVoucherPayload] = useState(null);

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
          };
        });

        setBranches(nextBranches);
        setSelectedBranchId(nextBranches[0]?.id || "");
        setShowSuccessScreen(false);
      } catch (error) {
        console.error("Failed to load merchant branches:", error);
        setBranches(FALLBACK_BRANCHES);
        setSelectedBranchId(FALLBACK_BRANCHES[0].id);
        setShowSuccessScreen(false);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchMerchantBranches();
  }, [open]);

  const filteredBranches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return branches;

    return branches.filter((branch) => {
      return (
        branch.name.toLowerCase().includes(term) ||
        branch.address.toLowerCase().includes(term) ||
        (branch.kind || "").toLowerCase().includes(term)
      );
    });
  }, [branches, searchTerm]);

  const selectedBranch = useMemo(() => {
    return filteredBranches.find((branch) => branch.id === selectedBranchId) || filteredBranches[0] || null;
  }, [filteredBranches, selectedBranchId]);

  const mapQuery = selectedBranch?.address || "Metro Manila";
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;

  const openDirections = (address) => {
    if (!address || address === "Location not set") return;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  const handleConfirmWalkIn = async () => {
    if (!selectedBranch || saving) return;
    setConfirmedStatusLabel("WALK-IN");
    const issuedAt = new Date();
    const voucherCode = buildVoucherCode({
      status: "WALK-IN",
      branchKind: selectedBranch?.kind,
    });
    setGeneratedVoucherCode(voucherCode);
    setVoucherIssuedAt(issuedAt);
    setPendingVoucherPayload({
      branchId: selectedBranch?.merchantId || null,
      branchName: selectedBranch?.name || "",
      branchAddress: selectedBranch?.address || "",
      branchEmail: selectedBranch?.email || "",
      voucherCode,
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
                  <iframe
                    title="Branch map"
                    src={mapSrc}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>

              <div className="px-4 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 text-lg font-bold tracking-tight">Nearby Branches</h3>
              <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white/80 border border-slate-200 rounded-full">
                {filteredBranches.length} Found
              </span>
            </div>

            <div className="space-y-4 pb-6">
              {loadingBranches && (
                <div className="text-xs text-slate-500 px-1">Loading merchant branches...</div>
              )}

              {filteredBranches.map((branch) => (
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
                      <span className={branch.id === selectedBranchId
                        ? "material-symbols-outlined text-background-dark"
                        : "material-symbols-outlined text-slate-500"
                      }>store</span>
                    </div>
                    <div className={branch.id === selectedBranchId ? "flex-1 pr-16" : "flex-1"}>
                      <h4 className="text-slate-900 font-bold text-base leading-tight">{branch.name}</h4>
                      <p className="text-primary text-[11px] font-bold uppercase tracking-wide mt-1">{branch.kind} Merchant</p>
                      <p className="text-slate-500 text-xs mt-1 leading-relaxed">{branch.address}</p>
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
              ))}
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