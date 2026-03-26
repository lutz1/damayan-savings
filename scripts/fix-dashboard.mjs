import { readFileSync, writeFileSync } from 'fs';

const path = 'src/pages/admin/adminDashboard.jsx';
let c = readFileSync(path, 'utf8');
// Normalize CRLF -> LF so our \n patterns work correctly
c = c.replace(/\r\n/g, '\n');

// 1) Remove Google Maps import
c = c.replace("import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';\n", '');

// 2) Remove userLocations/selectedMarker/GOOGLE_MAPS_API_KEY/useJsApiLoader
c = c.replace(/  const \[userLocations[\s\S]*?const \[totalRevenue/, '  const [totalRevenue');

// 3) Add memberActivityDist state
c = c.replace(
  "  const [previousRevenue, setPreviousRevenue] = useState(0);\n\n  const handleToggleSidebar",
  "  const [previousRevenue, setPreviousRevenue] = useState(0);\n  const [memberActivityDist, setMemberActivityDist] = useState({ MasterMD: { codes: 0, shares: 0 }, MD: { codes: 0, shares: 0 }, MS: { codes: 0, shares: 0 }, MI: { codes: 0, shares: 0 }, Agent: { codes: 0, shares: 0 } });\n\n  const handleToggleSidebar"
);

// 4) Add updateMemberDist function before updateRecentActivities
const updateMemberDistFn = `    const updateMemberDist = () => {
      const distRoles = ["MasterMD", "MD", "MS", "MI", "Agent"];
      const dist = {};
      distRoles.forEach(r => { dist[r] = { codes: 0, shares: 0 }; });
      allActivities.purchaseCodes.forEach(code => {
        const role = code.role || code.userRole || code.memberRole;
        if (role && dist[role] !== undefined) dist[role].codes++;
      });
      [...allActivities.capitalShareVouchers, ...allActivities.capitalShareEntries].forEach(v => {
        const role = v.role || v.userRole || v.memberRole;
        if (role && dist[role] !== undefined) dist[role].shares++;
      });
      setMemberActivityDist(dist);
    };

    `;
c = c.replace('    const updateRecentActivities = () => {', updateMemberDistFn + '    const updateRecentActivities = () => {');

// 5) Change activity slice from 10 to 50
c = c.replace(
  '.sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))\n        .slice(0, 10);',
  '.sort((a, b) => (b.createdAt?.toDate?.() || new Date()) - (a.createdAt?.toDate?.() || new Date()))\n        .slice(0, 50);'
);

// 6) updateMemberDist in capitalShareEntries listener
c = c.replace(
  "allActivities.capitalShareEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n    });\n    unsubscribers.push(unsubCapitalShare);",
  "allActivities.capitalShareEntries = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n      updateMemberDist();\n    });\n    unsubscribers.push(unsubCapitalShare);"
);

// 7) updateMemberDist in purchaseCodes listener
c = c.replace(
  "allActivities.purchaseCodes = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n    });\n    unsubscribers.push(unsubCodes);",
  "allActivities.purchaseCodes = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n      updateMemberDist();\n    });\n    unsubscribers.push(unsubCodes);"
);

// 8) updateMemberDist in capitalShareVouchers listener
c = c.replace(
  "allActivities.capitalShareVouchers = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n    });\n    unsubscribers.push(unsubVouchers);",
  "allActivities.capitalShareVouchers = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));\n      updateRecentActivities();\n      updateMemberDist();\n    });\n    unsubscribers.push(unsubVouchers);"
);

// 9) Remove async from usersQ listener
c = c.replace('onSnapshot(usersQ, async snapshot => {', 'onSnapshot(usersQ, snapshot => {');

// 10) Remove geocoding block from users listener
c = c.replace(
  /          setUserMap\(userMapObj\);\n\n          \/\/ Geocode addresses[\s\S]*?setUserLocations\(locs\.filter\(Boolean\)\);\n        \}\)\n      \);/,
  '          setUserMap(userMapObj);\n        })\n      );'
);

// 11) Top Earners: Direct Invite Reward only
c = c.replace(
  "// Only count Direct Invite Reward and Network Bonus\n          const filtered = rewards.filter(r => r.type === 'Direct Invite Reward' || r.type === 'Network Bonus');",
  "// Only count Direct Invite Reward\n          const filtered = rewards.filter(r => r.type === 'Direct Invite Reward');"
);

// ---------- JSX CHANGES ----------

// 12) Fix Revenue Chart subtitle encoding (Â· -> ·)
c = c.replace('Daily updates \u00C2\u00B7 current period', 'Daily updates \u00B7 current period');

// 13) Fix ₱ encoding (â‚± -> ₱) everywhere
// The garbled seq is U+00E2 U+201A U+00B1
const garbledPeso = '\u00E2\u201A\u00B1';
const correctPeso = '\u20B1';
while (c.includes(garbledPeso)) {
  c = c.replace(garbledPeso, correctPeso);
}

// 14) Fix em-dash encoding (â€" -> —)
const garbledDash = '\u00E2\u20AC\u201C';
const correctDash = '\u2014';
while (c.includes(garbledDash)) {
  c = c.replace(garbledDash, correctDash);
}

// 15) Metric ribbon -> Grid layout
const oldRibbon = `        <Box
          sx={{
            overflowX: "auto",
            display: "flex",
            gap: 2,
            pb: 1,
            mb: 4,
            mx: { xs: -2, sm: -3.5 },
            px: { xs: 2, sm: 3.5 },
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >`;

const newGrid = `        <Grid container spacing={2} sx={{ mb: 4 }}>`;

c = c.replace(oldRibbon, newGrid);

// Replace each map item: wrap in Grid item instead of motion.div directly
c = c.replace(
  `          ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
              <Box
                sx={{
                  minWidth: 160,
                  bgcolor: "#ffffff",
                  p: 2.5,
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: 128,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                  transition: "box-shadow 0.2s",
                  "&:hover": { boxShadow: "0 4px 18px rgba(0,0,0,0.12)" },
                }}
              >`,
  `          ].map((item, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.08 }}>
                <Box
                  sx={{
                    bgcolor: "#ffffff",
                    p: 2.5,
                    borderRadius: "16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 112,
                    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    transition: "box-shadow 0.2s",
                    "&:hover": { boxShadow: "0 4px 18px rgba(0,0,0,0.12)" },
                  }}
                >`
);

// Fix inner Box -> indented Box content (justify/icon/label)
c = c.replace(
  `                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "'Material Symbols Outlined'",
                      fontSize: 26,
                      color: "#497cff",
                      fontVariationSettings: "'FILL' 1, 'wght' 400",
                      userSelect: "none",
                      lineHeight: 1,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box
                    sx={{
                      bgcolor: item.positive ? "rgba(0,150,104,0.12)" : "rgba(186,26,26,0.12)",
                      px: 1,
                      py: 0.25,
                      borderRadius: "4px",
                      fontSize: 10,
                      fontWeight: 700,
                      color: item.positive ? "#009668" : "#ba1a1a",
                    }}
                  >
                    {item.badge}
                  </Box>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#54647a" }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mt: 0.5 }}>
                    {item.value}
                  </Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Box>`,
  `                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Box
                      component="span"
                      sx={{
                        fontFamily: "'Material Symbols Outlined'",
                        fontSize: 26,
                        color: "#497cff",
                        fontVariationSettings: "'FILL' 1, 'wght' 400",
                        userSelect: "none",
                        lineHeight: 1,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Box
                      sx={{
                        bgcolor: item.positive ? "rgba(0,150,104,0.12)" : "rgba(186,26,26,0.12)",
                        px: 1,
                        py: 0.25,
                        borderRadius: "4px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: item.positive ? "#009668" : "#ba1a1a",
                      }}
                    >
                      {item.badge}
                    </Box>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#54647a" }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mt: 0.5 }}>
                      {item.value}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>`
);

// 16) Member Distribution: replace content to use memberActivityDist
const oldMemberDist = `            <Card sx={{ bgcolor: "#f2f4f6", borderRadius: "16px", p: 3, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", height: "100%" }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mb: 3 }}>
                Member Distribution
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {Object.entries(userCounts).map(([role, count]) => {
                  const total = Math.max(Object.values(userCounts).reduce((a, b) => a + b, 0), 1);
                  const pct = Math.round((count / total) * 100);
                  return (
                    <Box key={role}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#191c1e" }}>{role}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#497cff" }}>{pct}%</Typography>
                      </Box>
                      <Box sx={{ width: "100%", bgcolor: "#e0e3e5", height: 8, borderRadius: 99, overflow: "hidden" }}>
                        <Box sx={{ bgcolor: "#191c1e", height: "100%", width: \`\${pct}%\`, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Card>`;

const newMemberDist = `            <Card sx={{ bgcolor: "#f2f4f6", borderRadius: "16px", p: 3, boxShadow: "0 1px 6px rgba(0,0,0,0.06)", height: "100%" }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: "'Manrope', sans-serif", color: "#191c1e", mb: 1.5 }}>
                Member Distribution
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, bgcolor: "#0053db", borderRadius: "2px", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 10, color: "#54647a", fontWeight: 600 }}>Invite Codes</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, bgcolor: "#009668", borderRadius: "2px", flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 10, color: "#54647a", fontWeight: 600 }}>Capital Shares</Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {["MasterMD", "MD", "MS", "MI", "Agent"].map((role) => {
                  const data = memberActivityDist[role] || { codes: 0, shares: 0 };
                  const totalCodes = Math.max(Object.values(memberActivityDist).reduce((a, b) => a + b.codes, 0), 1);
                  const totalShares = Math.max(Object.values(memberActivityDist).reduce((a, b) => a + b.shares, 0), 1);
                  const codePct = Math.round((data.codes / totalCodes) * 100);
                  const sharePct = Math.round((data.shares / totalShares) * 100);
                  return (
                    <Box key={role}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#191c1e" }}>{role}</Typography>
                        <Typography sx={{ fontSize: 10, color: "#76777d" }}>{data.codes} \u00B7 {data.shares}</Typography>
                      </Box>
                      <Box sx={{ width: "100%", bgcolor: "#e0e3e5", height: 6, borderRadius: 99, overflow: "hidden", mb: 0.75 }}>
                        <Box sx={{ bgcolor: "#0053db", height: "100%", width: \`\${codePct}%\`, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </Box>
                      <Box sx={{ width: "100%", bgcolor: "#e0e3e5", height: 6, borderRadius: 99, overflow: "hidden" }}>
                        <Box sx={{ bgcolor: "#009668", height: "100%", width: \`\${sharePct}%\`, borderRadius: 99, transition: "width 0.8s ease" }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Card>`;

c = c.replace(oldMemberDist, newMemberDist);

// 17) Activity Logs: remove slice, fix totalShown
c = c.replace(
  'recentActivities.slice(0, 10).map((act, idx) => {\n                const totalShown = Math.min(recentActivities.length, 10);',
  'recentActivities.map((act, idx) => {\n                const totalShown = recentActivities.length;'
);

// 18) Remove User Locations JSX block - use index approach to avoid regex issues with special chars
const mapStart = c.indexOf('\n        {isLoaded && userLocations');
const mapEnd = c.indexOf('\n        {/* PLACEHOLDER_END');
if (mapStart >= 0 && mapEnd >= 0) {
  c = c.slice(0, mapStart) + c.slice(mapEnd);
  console.log('Map block removed OK');
} else {
  console.warn('Map block not found', {mapStart, mapEnd});
}

writeFileSync(path, c, 'utf8');

// Verify key changes
const checks = {
  'memberActivityDist state': c.includes('const [memberActivityDist'),
  'updateMemberDist fn': c.includes('const updateMemberDist'),
  'slice 50 (not 10) in updateRecent': c.includes('.slice(0, 50);'),
  'Direct Invite Reward only': c.includes("filter(r => r.type === 'Direct Invite Reward');"),
  'Network Bonus removed': !c.includes("'Network Bonus'"),
  'userLocations removed': !c.includes('const [userLocations'),
  'GoogleMap removed': !c.includes('GoogleMap'),
  'isLoaded removed': !c.includes('isLoaded'),
  'Grid container for metrics': c.includes('<Grid container spacing={2} sx={{ mb: 4 }}>'),
  'Grid item for metric cards': c.includes('<Grid item xs={6} sm={3} key={i}>'),
  'memberActivityDist in JSX': c.includes('memberActivityDist[role]'),
  'activity logs no slice': c.includes('recentActivities.map((act, idx)'),
  'peso fixed': c.includes('\u20B1'),
  'garbled peso gone': !c.includes('\u00E2\u201A\u00B1'),
};

console.log('Results:');
Object.entries(checks).forEach(([k, v]) => console.log(v ? '  \u2713' : '  \u2717', k));
console.log('Total lines:', c.split('\n').length);
