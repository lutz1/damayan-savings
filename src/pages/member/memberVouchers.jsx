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

const resolveVoucherTitle = (voucherType, branchName) => {
  if (voucherType === "OFW") return "OFW Reward";
  if (branchName) return `${branchName} Voucher`;
  return "Walk-In Voucher";
};

const resolveVoucherIcon = (voucherType, branchName) => {
  const name = (branchName || "").toLowerCase();
  if (voucherType === "OFW") return "public";
  if (name.includes("rice")) return "grass";
  if (name.includes("meat")) return "restaurant";
  return "confirmation_number";
};

const MemberVouchers = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [voucher, setVoucher] = useState(null);
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
          setVoucher(null);
          return;
        }

        const data = voucherSnap.data();
        const issuedAt = data.voucherIssuedAt?.toDate ? data.voucherIssuedAt.toDate() : (data.voucherIssuedAt ? new Date(data.voucherIssuedAt) : null);
        const expiresAt = issuedAt ? new Date(issuedAt.getTime() + (30 * 24 * 60 * 60 * 1000)) : null;
        const voucherStatus = data.voucherStatus || "ACTIVE";

        setVoucher({
          ...data,
          voucherStatus,
          issuedAt,
          expiresAt,
          title: resolveVoucherTitle(data.voucherType, data.branchName),
          icon: resolveVoucherIcon(data.voucherType, data.branchName),
        });
      } catch (error) {
        console.error("Failed to load vouchers:", error);
        setVoucher(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const qrUrl = useMemo(() => {
    if (!voucher?.voucherCode) return "";
    const qrPayload = `DAMAYAN_VOUCHER|CODE:${voucher.voucherCode}|STATUS:${voucher.voucherType}|ISSUED:${voucher.issuedAt?.toISOString?.() || ""}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
  }, [voucher]);

  const mapQuery = voucher?.branchAddress || voucher?.branchName || "Metro Manila";
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;

  const openDirections = (address) => {
    if (!address || address === "Location not set") return;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  const matchesActiveTab = (item) => {
    if (!item) return false;
    if (activeTab === "ACTIVE") return item.voucherStatus === "ACTIVE";
    return item.voucherStatus !== "ACTIVE";
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
          ) : matchesActiveTab(voucher) ? (
            <>
              <div className="p-4 rounded-3xl bg-white/80 border border-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                <div className="flex gap-4">
                  <div className="h-16 w-16 flex-shrink-0 rounded-2xl flex items-center justify-center border border-slate-200 bg-slate-50">
                    <span className="material-symbols-outlined text-sky-600 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{voucher.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-900 font-bold text-lg leading-tight truncate">{voucher.title}</h3>
                    <p className="text-slate-500 text-xs mt-1 uppercase tracking-wide truncate">ID: {voucher.voucherCode || "N/A"}</p>
                    <p className="text-slate-600 text-xs mt-1">Issued: {formatDate(voucher.issuedAt)}</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                      <span className="text-[11px] text-slate-700 font-extrabold uppercase tracking-wider">{voucher.voucherStatus || "ACTIVE"}</span>
                    </div>
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
                    onClick={() => qrUrl && setQrPreviewOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-bold uppercase tracking-wide transition-colors"
                  >
                    {voucher?.voucherType === "OFW" ? "View Rewards" : "View QR"}
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {voucher?.voucherType === "OFW" ? "card_giftcard" : "qr_code_2"}
                    </span>
                  </button>
                </div>
              </div>

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
                  {voucher?.voucherType === "OFW" ? "OFW Rewards" : "Voucher QR"}
                </h2>
                <button
                  type="button"
                  onClick={() => setQrPreviewOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-100"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {voucher?.voucherType === "OFW" ? (
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
                <div className="bg-white rounded-2xl p-4 mx-auto w-fit">
                  <img
                    alt="Voucher QR Code"
                    className="w-64 h-64"
                    src={qrUrl}
                  />
                </div>
              )}

              <p className="text-center text-slate-700 text-xs mt-4 font-semibold tracking-wide uppercase">
                {voucher?.voucherCode || "N/A"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberVouchers;
