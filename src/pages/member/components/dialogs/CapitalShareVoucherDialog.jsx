import React, { useState, useRef } from "react";
import {
  Slide,
  Dialog,
  DialogContent,
} from "@mui/material";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import PublicIcon from "@mui/icons-material/Public";
import CheckIcon from "@mui/icons-material/Check";
import VerifiedIcon from "@mui/icons-material/Verified";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const CapitalShareVoucherDialog = ({
  open,
  onClose,
  voucherType,
  onVoucherTypeChange,
  onWalkInClick,
  onOfwClick,
}) => {
  const [touchStart, setTouchStart] = useState(null);
  const [translateY, setTranslateY] = useState(0);
  const dialogRef = useRef(null);
  const SWIPE_THRESHOLD = 80; // pixels

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientY);
    setTranslateY(0);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart;
    
    // Only allow downward swipe (positive diff)
    if (diff > 0) {
      setTranslateY(diff);
    }
  };

  const handleTouchEnd = (e) => {
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - touchStart;

    if (diff > SWIPE_THRESHOLD) {
      onClose();
    }
    
    setTranslateY(0);
    setTouchStart(null);
  };
  return (
    <Dialog
      open={open}
      TransitionComponent={Transition}
      ref={dialogRef}
      sx={{
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-end', sm: 'center' },
        },
      }}
      onClose={(_, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        onClose();
      }}
      disableEscapeKeyDown
      fullWidth
      maxWidth="sm"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(0,0,0,0.6)",
          },
        },
      }}
      PaperProps={{
        sx: {
          background: "linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%)",
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          borderTop: "1px solid rgba(148,163,184,0.35)",
          borderLeft: "1px solid rgba(148,163,184,0.2)",
          borderRight: "1px solid rgba(148,163,184,0.2)",
          overflow: "hidden",
          m: { xs: 0, sm: 2.5 },
          width: { xs: "100%", sm: "auto" },
          maxWidth: { xs: "100%", sm: "600px" },
          borderBottomLeftRadius: { xs: 0, sm: 32 },
          borderBottomRightRadius: { xs: 0, sm: 32 },
          boxShadow: "0 20px 50px rgba(15,23,42,0.28)",
          transform: `translateY(${translateY}px)`,
          transition: translateY === 0 ? "transform 0.3s ease-out" : "none",
        },
      }}
    >
      <div 
        className="flex flex-col items-center pt-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-1.5 w-12 rounded-full bg-slate-300"></div>
      </div>

      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, pt: 1.5, pb: 1 }}>
        <h1 className="text-slate-900 text-2xl font-extrabold text-center mb-8 leading-tight">
          Select Your <span className="text-primary">Status</span>
        </h1>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              onVoucherTypeChange("WALK_IN");
              if (onWalkInClick) onWalkInClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onVoucherTypeChange("WALK_IN");
                if (onWalkInClick) onWalkInClick();
              }
            }}
            className={`group relative w-full text-left flex items-center gap-5 p-5 rounded-2xl transition-all active:scale-[0.98] ${
              voucherType === "WALK_IN"
                ? "bg-primary/10 border-2 border-primary shadow-[0_8px_24px_rgba(48,232,110,0.18)]"
                : "bg-white/80 border-2 border-slate-200 hover:bg-white"
            }`}
          >
            <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
              voucherType === "WALK_IN" ? "bg-primary text-slate-900" : "bg-slate-100 text-emerald-600"
            }`}>
              <DirectionsWalkIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="flex-1">
              <p className="text-slate-900 text-lg font-bold leading-none mb-1.5">Walk-In</p>
              <p className="text-slate-500 text-sm font-medium">Redeem at our physical branch</p>
            </div>
            {voucherType === "WALK_IN" && (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary absolute -top-2 -right-2 border-4 border-white shadow-md">
                <CheckIcon sx={{ color: "#0f172a", fontSize: 14 }} />
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onVoucherTypeChange("OFW");
              if (onOfwClick) onOfwClick();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onVoucherTypeChange("OFW");
                if (onOfwClick) onOfwClick();
              }
            }}
            className={`group relative w-full text-left flex items-center gap-5 p-5 rounded-2xl transition-all active:scale-[0.98] ${
              voucherType === "OFW"
                ? "bg-primary/10 border-2 border-primary shadow-[0_8px_24px_rgba(48,232,110,0.18)]"
                : "bg-white/80 border-2 border-slate-200 hover:bg-white"
            }`}
          >
            <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
              voucherType === "OFW" ? "bg-primary text-slate-900" : "bg-slate-100 text-amber-500"
            }`}>
              <PublicIcon sx={{ fontSize: 32 }} />
            </div>
            <div className="flex-1">
              <p className="text-slate-900 text-lg font-bold leading-none mb-1.5">OFW</p>
              <p className="text-slate-500 text-sm font-medium">Redeem through our overseas partners</p>
            </div>
            {voucherType === "OFW" && (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary absolute -top-2 -right-2 border-4 border-white shadow-md">
                <CheckIcon sx={{ color: "#0f172a", fontSize: 14 }} />
              </div>
            )}
          </button>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/70 rounded-xl border border-slate-200">
            <VerifiedIcon sx={{ color: "#d4af37", fontSize: 20 }} />
            <span className="text-xs text-slate-700 font-semibold uppercase tracking-wider">Secure Referral</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-white/70 rounded-xl border border-slate-200">
            <TrendingUpIcon sx={{ color: "#d4af37", fontSize: 20 }} />
            <span className="text-xs text-slate-700 font-semibold uppercase tracking-wider">Growth Hub</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CapitalShareVoucherDialog;