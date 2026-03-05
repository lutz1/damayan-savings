import React, { useMemo, useState } from "react";
import { Dialog, useMediaQuery, useTheme } from "@mui/material";
import OFWVoucherSuccessScreen from "./OFWVoucherSuccessScreen";

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

const OFW_REWARDS = [
  {
    id: "ofw_remittance",
    title: "Remittance Rewards",
    description: "Earn points on every remittance transaction",
    icon: "account_balance_wallet",
    color: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    id: "ofw_insurance",
    title: "Insurance Coverage",
    description: "Comprehensive health and life insurance benefits",
    icon: "health_and_safety",
    color: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    id: "ofw_investment",
    title: "Investment Options",
    description: "Grow your savings with profitable investment vehicles",
    icon: "trending_up",
    color: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    id: "ofw_credit",
    title: "Credit Access",
    description: "Easy access to loans and credit facilities",
    icon: "credit_card",
    color: "bg-purple-50",
    borderColor: "border-purple-200",
  },
];

const OFWRewardsDialog = ({ open, onClose, onConfirmDone, saving = false, onDone, onViewVouchers }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [confirmedStatusLabel, setConfirmedStatusLabel] = useState("OFW");
  const [generatedVoucherCode, setGeneratedVoucherCode] = useState("VCR-0000-0000-OFW-X");
  const [voucherIssuedAt, setVoucherIssuedAt] = useState(new Date());
  const [pendingVoucherPayload, setPendingVoucherPayload] = useState(null);

  const handleConfirmOFW = async () => {
    if (saving) return;
    setConfirmedStatusLabel("OFW");
    const issuedAt = new Date();
    const voucherCode = buildVoucherCode({
      status: "OFW",
      branchKind: "OFW",
    });
    setGeneratedVoucherCode(voucherCode);
    setVoucherIssuedAt(issuedAt);
    setPendingVoucherPayload({
      voucherType: "OFW",
      branchId: null,
      branchName: "OFW Rewards Program",
      branchAddress: "Online",
      branchEmail: "",
      voucherCode,
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
          <OFWVoucherSuccessScreen
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
                  className="text-slate-700 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
                  OFW Rewards
                </h2>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto hide-scrollbar pb-40 relative z-10">
              <div className="px-4 py-6">
                <div className="mb-6">
                  <h3 className="text-slate-900 text-xl font-bold tracking-tight mb-2">Your Benefits</h3>
                  <p className="text-slate-600 text-sm">Access exclusive rewards and financial services as an OFW member</p>
                </div>

                <div className="space-y-3">
                  {OFW_REWARDS.map((reward) => (
                    <div
                      key={reward.id}
                      className={`rounded-2xl p-4 border-2 ${reward.color} ${reward.borderColor} relative group`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white border border-slate-200 shadow-sm">
                            <span className="material-symbols-outlined text-slate-600 text-2xl">{reward.icon}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-slate-900 font-bold text-base leading-tight">{reward.title}</h4>
                          <p className="text-slate-600 text-xs mt-1">{reward.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-2xl bg-white/70 border border-slate-200/50 backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-2xl flex-shrink-0 mt-0.5">info</span>
                    <div className="flex-1">
                      <p className="text-slate-900 font-bold text-sm">Exclusive OFW Program</p>
                      <p className="text-slate-600 text-xs mt-1">Specially designed for overseas Filipino workers seeking secure remittance and investment solutions.</p>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <div className="sticky bottom-0 z-20 p-4 border-t border-slate-200 bg-white/90 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),1rem)]">
              <button
                type="button"
                disabled={saving || submittingAction}
                onClick={handleConfirmOFW}
                className="w-full h-12 rounded-2xl bg-[#111827] text-white font-semibold text-sm hover:bg-[#1f2937] disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors shadow-[0_8px_20px_rgba(17,24,39,0.2)]"
              >
                {saving ? "Saving..." : "Confirm OFW Selection"}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};

export default OFWRewardsDialog;
