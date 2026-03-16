import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";

const OFW_PERKS = [
  {
    id: "perk_remittance",
    title: "Remittance Rewards",
    description: "Earn points on every remittance transaction",
    icon: "account_balance_wallet",
    color: "bg-blue-100",
    borderColor: "border-blue-300",
    textColor: "text-blue-700",
  },
  {
    id: "perk_insurance",
    title: "Insurance Coverage",
    description: "Comprehensive health and life insurance benefits",
    icon: "health_and_safety",
    color: "bg-green-100",
    borderColor: "border-green-300",
    textColor: "text-green-700",
  },
  {
    id: "perk_investment",
    title: "Investment Options",
    description: "Grow your savings with profitable investment vehicles",
    icon: "trending_up",
    color: "bg-amber-100",
    borderColor: "border-amber-300",
    textColor: "text-amber-700",
  },
  {
    id: "perk_credit",
    title: "Credit Access",
    description: "Easy access to loans and credit facilities",
    icon: "credit_card",
    color: "bg-purple-100",
    borderColor: "border-purple-300",
    textColor: "text-purple-700",
  },
];

const formatDate = (date) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const prettifyVoucherKind = (kind) => {
  const normalized = String(kind || "").trim().toUpperCase();
  if (!normalized) return "Voucher";
  return normalized.charAt(0) + normalized.slice(1).toLowerCase();
};

const resolveVoucherTitle = (voucherType, branchName, voucherKind, claimablePercent, pointsConvertPercent) => {
  if (voucherType === "OFW") return "OFW Reward";
  if (voucherType === "WALK_IN_POINTS") return "Points Reward";
  if (Number(claimablePercent || 100) < 100 || Number(pointsConvertPercent || 0) > 0) {
    return `${prettifyVoucherKind(voucherKind)} Voucher QR`;
  }
  if (branchName) return `${branchName} Voucher`;
  return "Walk-In Voucher";
};

const resolveVoucherIcon = (voucherType, branchName) => {
  const name = (branchName || "").toLowerCase();
  if (voucherType === "OFW") return "public";
  if (voucherType === "WALK_IN_POINTS") return "card_giftcard";
  if (name.includes("rice")) return "grass";
  if (name.includes("meat")) return "restaurant";
  return "confirmation_number";
};

const getStatusPill = (status) => {
  const normalized = String(status || "ACTIVE").toUpperCase();
  if (normalized === "HOLD") {
    return "bg-amber-100 border-amber-200 text-amber-800";
  }
  if (normalized === "USED" || normalized === "REDEEMED") {
    return "bg-slate-200 border-slate-300 text-slate-700";
  }
  return "bg-emerald-100 border-emerald-200 text-emerald-800";
};

const getSplitVoucherSummary = (voucher) => {
  const claimablePercent = Number(voucher?.claimablePercent || 100);
  const pointsConvertPercent = Number(voucher?.pointsConvertPercent || 0);

  if (claimablePercent >= 100 && pointsConvertPercent <= 0) {
    return "";
  }

  return `${claimablePercent}% ${prettifyVoucherKind(voucher?.voucherKind)} voucher QR • ${pointsConvertPercent}% points converted`;
};

const MemberVouchers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState([]); // Array of all vouchers
  const [selectedVoucherIndex, setSelectedVoucherIndex] = useState(0); // Track which voucher is selected
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setVoucher(null);
        setLoading(false);
        return;
      }

      try {
        const voucherRef = doc(db, "capitalShareVouchers", currentUser.uid);
        const voucherSnap = await getDoc(voucherRef);
        if (!voucherSnap.exists()) {
          setVouchers([]);
          setSelectedVoucherIndex(0);
          return;
        }

        const data = voucherSnap.data();
        // Get all vouchers from the array, or fallback to top-level voucher for backward compatibility
        const vouchersList = data.vouchers && Array.isArray(data.vouchers) ? data.vouchers : [];
        
        if (vouchersList.length === 0 && data.voucherCode) {
          // Backward compatibility: old single-voucher format
          const issuedAt = data.voucherIssuedAt?.toDate ? data.voucherIssuedAt.toDate() : (data.voucherIssuedAt ? new Date(data.voucherIssuedAt) : null);
          const expiresAt = issuedAt ? new Date(issuedAt.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;
          const voucherStatus = data.voucherStatus || "ACTIVE";
          vouchersList.push({
            ...data,
            voucherStatus,
            issuedAt,
            expiresAt,
            title: resolveVoucherTitle(
              data.voucherType,
              data.branchName,
              data.voucherKind,
              data.claimablePercent,
              data.pointsConvertPercent
            ),
            icon: resolveVoucherIcon(data.voucherType, data.branchName),
          });
        } else {
          // Process all vouchers in the array
          const processedVouchers = vouchersList.map((v) => {
            const issuedAt = v.voucherIssuedAt?.toDate ? v.voucherIssuedAt.toDate() : (v.voucherIssuedAt ? new Date(v.voucherIssuedAt) : null);
            const expiresAt = issuedAt ? new Date(issuedAt.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;
            const voucherStatus = v.voucherStatus || "ACTIVE";
            return {
              ...v,
              voucherStatus,
              issuedAt,
              expiresAt,
              title: resolveVoucherTitle(
                v.voucherType,
                v.branchName,
                v.voucherKind,
                v.claimablePercent,
                v.pointsConvertPercent
              ),
              icon: resolveVoucherIcon(v.voucherType, v.branchName),
            };
          });
          setVouchers(processedVouchers);
          setSelectedVoucherIndex(0);
          return;
        }
        
        setVouchers(vouchersList);
        setSelectedVoucherIndex(0);
      } catch (error) {
        console.error("Failed to load vouchers:", error);
        setVouchers([]);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Get currently selected voucher
  const currentVoucher = vouchers.length > 0 ? vouchers[selectedVoucherIndex] : null;

  const qrUrl = useMemo(() => {
    if (!currentVoucher?.voucherCode) return "";
    const qrPayload = `DAMAYAN_VOUCHER|CODE:${currentVoucher.voucherCode}|STATUS:${currentVoucher.voucherType}|ISSUED:${currentVoucher.issuedAt?.toISOString?.() || ""}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
  }, [currentVoucher]);

  const mapQuery = currentVoucher?.branchAddress || currentVoucher?.branchName || "Metro Manila";
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;

  const openDirections = (address) => {
    if (!address || address === "Location not set") return;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  const matchesActiveTab = (item) => {
    if (!item) return false;
    const status = String(item.voucherStatus || "ACTIVE").toUpperCase();
    if (activeTab === "ACTIVE") return status === "ACTIVE" || status === "HOLD";
    return status !== "ACTIVE" && status !== "HOLD";
  };

  return (
    <div className="font-display text-slate-900 min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)]">
      <div className="relative flex h-screen max-w-md mx-auto flex-col overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] border-x border-slate-200/70 shadow-xl">
        <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-sky-200/35 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-emerald-200/35 blur-3xl pointer-events-none" />

        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 pt-[max(env(safe-area-inset-top),0px)]">
          <div className="flex items-center p-4 justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-slate-700 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">My Vouchers</h1>
          </div>

          <div className="flex px-4 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("ACTIVE")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab === "ACTIVE" ? "text-sky-600 border-b-2 border-sky-500" : "text-slate-500"}`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ARCHIVED")}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors ${activeTab !== "ACTIVE" ? "text-sky-600 border-b-2 border-sky-500" : "text-slate-500"}`}
          >
            Used / Expired
          </button>
        </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-10">
          {loading ? (
            <div className="text-center text-slate-500 text-sm py-12">Loading vouchers...</div>
          ) : vouchers.length > 0 && vouchers.some((v) => matchesActiveTab(v)) ? (
            <>
              {/* Display all vouchers matching active tab */}
              {vouchers.map((voucher, index) => 
                matchesActiveTab(voucher) && (
                  <div key={index} className="p-4 rounded-3xl bg-white/80 border border-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                    <div className="flex gap-4">
                      <div className="h-16 w-16 flex-shrink-0 rounded-2xl flex items-center justify-center border border-slate-200 bg-slate-50">
                        <span className="material-symbols-outlined text-sky-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{voucher.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-slate-900 font-bold text-lg leading-tight truncate">{voucher.title}</h3>
                        <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide truncate">ID: {voucher.voucherCode || "N/A"}</p>
                        <p className="text-slate-600 text-xs mt-1">Issued: {formatDate(voucher.issuedAt)}</p>
                        <div className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusPill(voucher.voucherStatus)}`}>
                          <span className="text-[11px] font-extrabold uppercase tracking-wider">{voucher.voucherStatus || "ACTIVE"}</span>
                        </div>
                        {!!getSplitVoucherSummary(voucher) && (
                          <p className="text-[11px] text-amber-700 font-bold mt-2">
                            {getSplitVoucherSummary(voucher)}
                          </p>
                        )}
                        {voucher?.holdReason && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {voucher.holdReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      {voucher?.branchAddress && voucher.branchAddress !== "Location not set" && (
                        <button
                          type="button"
                          onClick={() => openDirections(voucher.branchAddress)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-bold uppercase tracking-wide transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">location_on</span>
                          Get Directions
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVoucherIndex(index);
                          setQrPreviewOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-bold uppercase tracking-wide transition-colors"
                      >
                        {voucher?.voucherType === "OFW" ? "View Rewards" : "View QR"}
                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {voucher?.voucherType === "OFW" ? "card_giftcard" : "qr_code_2"}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              )}
            </>
          ) : (
            <div className="text-center text-slate-500 text-sm py-12">
              {activeTab === "ACTIVE" ? "No active vouchers found." : "No used or expired vouchers yet."}
            </div>
          )}

          <div className="pt-6 text-center">
            <p className="text-slate-500 text-[11px] font-medium tracking-wide">
              Don&apos;t see your voucher?{" "}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-sky-700 font-bold underline decoration-sky-300 underline-offset-4"
              >
                Refresh list
              </button>
            </p>
          </div>
        </div>

        {qrPreviewOpen && (
          <div className="absolute inset-0 z-40">
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setQrPreviewOpen(false)}
              className="absolute inset-0 bg-black/45"
            />

            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white/95 border-t border-slate-200 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur-xl shadow-2xl">
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-slate-900 font-bold text-base">
                  {currentVoucher?.voucherType === "OFW"
                    ? "OFW Rewards"
                    : currentVoucher?.title || "Voucher QR"}
                </h2>
                <button
                  type="button"
                  onClick={() => setQrPreviewOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {currentVoucher?.voucherType === "OFW" ? (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  <p className="text-slate-700 font-bold text-sm mb-3">Your OFW Perks</p>
                  {OFW_PERKS.map((perk) => (
                    <div
                      key={perk.id}
                      className={`p-3 rounded-xl border-2 ${perk.color} ${perk.borderColor} backdrop-blur-sm`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${perk.color} border ${perk.borderColor}`}>
                          <span className={`material-symbols-outlined text-lg ${perk.textColor}`}>{perk.icon}</span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-bold text-xs text-slate-900`}>{perk.title}</p>
                          <p className="text-slate-600 text-[11px] mt-0.5">{perk.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
                    <img
                      alt="Voucher QR Code"
                      className="w-64 h-64"
                      src={qrUrl}
                    />
                  </div>

                  {!!getSplitVoucherSummary(currentVoucher) && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                      <p className="text-amber-800 text-xs font-bold uppercase tracking-wide">Split Reward</p>
                      <p className="text-amber-900 text-sm font-semibold mt-1">
                        {getSplitVoucherSummary(currentVoucher)}
                      </p>
                      {currentVoucher?.holdReason && (
                        <p className="text-amber-700 text-xs mt-2">{currentVoucher.holdReason}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-center text-slate-700 text-xs mt-4 font-semibold tracking-wide uppercase">
                {currentVoucher?.voucherCode || "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberVouchers;
