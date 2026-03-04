import React from "react";

const CapitalShareVoucherSuccessScreen = ({
  statusLabel = "WALK-IN",
  voucherCode,
  issuedAt,
  onClose,
  onDone,
  onViewVouchers,
}) => {
  const qrPayload = `DAMAYAN_VOUCHER|CODE:${voucherCode}|STATUS:${statusLabel}|ISSUED:${issuedAt.toISOString()}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload)}`;

  const formatDate = (date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(date);
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #eef4ff 0%, #f7f9fc 55%, #edf2fb 100%)",
      }}
    >
      <div className="absolute -top-20 -right-16 h-52 w-52 rounded-full bg-[#7dd3fc]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-[#a7f3d0]/30 blur-3xl pointer-events-none" />

      <div className="flex items-center p-6 justify-between relative z-10">
        <button
          type="button"
          onClick={onClose}
          className="text-slate-600 hover:bg-black/5 p-2 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <h2 className="text-slate-800 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Confirmation</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative z-10">
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-[#34d399]/30 blur-3xl rounded-full" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/75 border-2 border-[#a7f3d0] shadow-[0_12px_35px_rgba(17,24,39,0.12)] backdrop-blur-md">
            <span className="material-symbols-outlined text-[#22c55e] text-5xl font-bold">check_circle</span>
          </div>
        </div>

        <h1 className="text-slate-900 text-4xl font-extrabold tracking-tight mb-2">Success!</h1>
        <div className="space-y-2">
          <p className="text-slate-600 text-base leading-relaxed font-medium">Your voucher selection has been confirmed.</p>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 border border-slate-300 shadow-sm">
            <span className="text-slate-700 text-xs font-extrabold uppercase tracking-widest">STATUS: {statusLabel}</span>
          </div>
        </div>

        <div className="w-full mt-8 p-6 rounded-3xl bg-white/70 border border-white/70 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
          <div className="flex flex-col items-center gap-5">
            <div className="bg-white p-3 rounded-xl shadow-inner">
              <img
                alt="Redemption QR Code"
                className="w-40 h-40"
                src={qrImageUrl}
              />
            </div>
            <div className="text-slate-700 font-mono text-sm tracking-[0.12em] font-semibold uppercase break-all">{voucherCode}</div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-300/70 text-xs uppercase tracking-wider text-center">
            <span className="text-slate-500">Issued: </span>
            <span className="text-slate-700 font-semibold">{formatDate(issuedAt)}</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-12 space-y-3 relative z-10">
        <button
          type="button"
          onClick={onDone || onClose}
          className="w-full bg-[#111827] hover:bg-[#1f2937] text-white font-semibold py-4 rounded-2xl transition-all active:scale-[0.98] shadow-[0_8px_20px_rgba(17,24,39,0.25)]"
        >
          Done
        </button>
        <button
          type="button"
          onClick={onViewVouchers || onClose}
          className="w-full py-2"
        >
          <span className="text-slate-600 hover:text-slate-800 font-semibold transition-colors">View My Vouchers</span>
        </button>
      </div>
    </div>
  );
};

export default CapitalShareVoucherSuccessScreen;