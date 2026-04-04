export const memberPageTopInset = "calc(env(safe-area-inset-top, 0px) + 16px)";

export const memberStickyHeaderInset = "calc(env(safe-area-inset-top, 0px) + 8px)";

export const memberShellBackground = `
	radial-gradient(circle at 12% 8%, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0) 26%),
	radial-gradient(circle at 88% 10%, rgba(74, 128, 255, 0.22) 0%, rgba(74, 128, 255, 0) 34%),
	linear-gradient(180deg, #06132e 0%, #0b1f5e 38%, #123887 74%, #1a4ea8 100%)
`;

export const memberHeroBackground =
	"linear-gradient(145deg, rgba(8,23,52,0.96) 0%, rgba(16,42,99,0.94) 46%, rgba(33,86,201,0.88) 100%)";

export const memberGlassPanelSx = {
	background: "linear-gradient(145deg, rgba(10,24,54,0.92) 0%, rgba(16,42,99,0.88) 52%, rgba(33,86,201,0.78) 100%)",
	border: "1px solid rgba(255,255,255,0.12)",
	boxShadow: "0 20px 40px rgba(6,18,45,0.20)",
	color: "#ffffff",
};

export const memberSoftPanelSx = {
	background: "linear-gradient(145deg, rgba(255,255,255,0.90) 0%, rgba(248,250,255,0.96) 70%, rgba(244,238,216,0.94) 100%)",
	border: "1px solid rgba(11,31,94,0.08)",
	boxShadow: "0 16px 30px rgba(11,31,94,0.10)",
};