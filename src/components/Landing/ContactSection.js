import React from "react";
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Stack,
  IconButton,
} from "@mui/material";
import RevealOnScroll from "../RevealOnScroll";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";
import YouTubeIcon from "@mui/icons-material/YouTube";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { MapContainer, TileLayer, Marker, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { motion } from "framer-motion";
import contactBg from "../../assets/contact.png"; 
import TelegramIcon from "@mui/icons-material/Telegram";
import SvgIcon from "@mui/material/SvgIcon";
// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Coordinates
const center = [7.4419, 125.8053];

const ContactSection = () => {
  const address = "Mabini St San Miguel Tagum Beside Mike Cafe Tagum City";

  const ViberIcon = (props) => (
  <SvgIcon {...props} viewBox="0 0 512 512">
    <path d="M256 0C114.624 0 0 114.624 0 256c0 70.688 28.672 134.72 75.392 181.376L0 512l74.944-76.8C122.368 483.968 188.608 512 256 512 397.376 512 512 397.376 512 256 512 114.624 397.376 0 256 0zm122.88 379.2c-1.024 6.656-5.632 12.224-12.096 14.848-8.192 3.072-18.944 7.168-35.328-2.048-19.456-11.264-33.792-21.824-57.344-45.44-23.552-23.616-34.112-37.952-45.376-57.408-9.216-16.416-5.12-27.136-2.048-35.328 2.688-6.464 8.192-11.136 14.784-12.16 15.36-2.304 39.04-5.44 64.64 19.2 25.6 24.64 21.888 49.28 19.168 64.64zM192 256c0 35.328 28.672 64 64 64s64-28.672 64-64-28.672-64-64-64-64 28.672-64 64z"/>
  </SvgIcon>
);
  return (
    <Box sx={{ position: "relative", overflow: "hidden" }}>
      {/* Background Image */}
      <Box
        component="img"
        src={contactBg}
        alt="Contact Background"
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.80, // adjust opacity here
          zIndex: 0,
        }}
      />

      <Container id="contact" sx={{ py: 2, position: "relative", zIndex: 1 }}>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
          {/* Left: Send us a message */}
          <RevealOnScroll>
            <Box
              sx={{
                  flex: 1,
                  p: 5,
                  borderRadius: 3,
                  backgroundColor: "rgba(249, 249, 249, 0.85)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
                  backdropFilter: "blur(8px)",
              }}
            >
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Send us a message
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Have questions about loans or financing? Trucapital Credit Lending
                Corporation is here to help! Send us a message and our team will
                guide you through simple, fast, and reliable financial solutions
                tailored just for you.
              </Typography>

              <Stack spacing={2} mt={2}>
                <Stack direction="row" spacing={2}>
                  <TextField label="Name" variant="outlined" fullWidth size="small" />
                  <TextField label="Company" variant="outlined" fullWidth size="small" />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <TextField label="Phone" variant="outlined" fullWidth size="small" />
                  <TextField label="Email" variant="outlined" fullWidth size="small" />
                </Stack>
                <TextField label="Subject" variant="outlined" fullWidth size="small" />
                <TextField
                  label="Message"
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={5}
                  size="small"
                />
                <Button
                  variant="contained"
                  fullWidth
                  sx={{
                    backgroundColor: "#6C63FF",
                    color: "#fff",
                    py: 1.8,
                    "&:hover": { backgroundColor: "#574fd6" },
                  }}
                >
                  Send Message
                </Button>
              </Stack>
            </Box>
          </RevealOnScroll>

          {/* Right: Get in touch */}
          <RevealOnScroll>
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ width: "100%" }}
            >
              <Box
                sx={{
                  flex: 1,
                  p: 5,
                  borderRadius: 3,
                  backgroundColor: "rgba(249, 249, 249, 0.85)",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.05)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  Get in touch
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Have questions or need assistance? Trucapital Credit Lending Corporation is here
                  to help. Reach out today, and our team will guide you with fast,
                  reliable, and personalized financial support.
                </Typography>

                <Stack spacing={2} mt={3}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocationOnIcon color="primary" />
                    <Typography>{address}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon color="primary" />
                    <Typography>zemmerocksminetrade@gmail.com</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <PhoneIcon color="primary" />
                    <Typography>09496711617</Typography>
                  </Stack>
                </Stack>

                <Box mt={4}>
  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
    Follow our social media
  </Typography>
  <Stack direction="row" spacing={2}>
    {[ 
      { icon: <FacebookIcon />, color: "#3b5998", link: "#" },
      { icon: <InstagramIcon />, color: "#E1306C", link: "#" },
      { icon: <YouTubeIcon />, color: "#FF0000", link: "#" },
      { icon: <TelegramIcon />, color: "#0088cc", link: "#" },
      { icon: <ViberIcon />, color: "#59267c", link: "#" },
    ].map((item, index) => (
      <motion.div
        key={index}
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <IconButton href={item.link} sx={{ color: item.color }}>
          {item.icon}
        </IconButton>
      </motion.div>
    ))}
  </Stack>
</Box>

                {/* Leaflet Map */}
                <Box mt={4}>
                  <MapContainer center={center} zoom={16} scrollWheelZoom={false}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={center}>
                      <Popup>{address}</Popup>
                    </Marker>
                    <Circle
                      center={center}
                      radius={100}
                      pathOptions={{ fillColor: "red", color: "red", fillOpacity: 0.2 }}
                    />
                  </MapContainer>
                </Box>
              </Box>
            </motion.div>
          </RevealOnScroll>
        </Box>
      </Container>
    </Box>
  );
};

export default ContactSection;