import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Fab,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const TypingIndicator = () => (
  <Box sx={{ display: "flex", gap: 0.5, mb: 1, ml: 1, alignItems: "center" }}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        component="span"
        sx={{
          width: 6,
          height: 6,
          backgroundColor: "gray",
          borderRadius: "50%",
          display: "inline-block",
          animation: `typing-dot 1.4s infinite ${i * 0.2}s`,
        }}
      />
    ))}
    <style>
      {`
        @keyframes typing-dot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}
    </style>
  </Box>
);

const ChatBot = () => {
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hello! I’m Damayan Assistant 🤖. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const chatBodyRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  // Tooltip animation
  useEffect(() => {
    if (!open) {
      const timer = setInterval(() => setShowTooltip((prev) => !prev), 4000);
      return () => clearInterval(timer);
    }
  }, [open]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { from: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:5000/api/chat", {
        messages: [
          ...messages.map((m) => ({
            role: m.from === "user" ? "user" : "assistant",
            content: m.text,
          })),
          { role: "user", content: input },
        ],
      });
      const botReply = response.data.choices[0].message.content.trim();
      setMessages((prev) => [...prev, { from: "bot", text: botReply }]);
    } catch (error) {
      console.error("ChatBot error:", error);
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Oops! Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ position: "fixed", bottom: 10, right: 10, zIndex: 2000 }}>
      {/* Bot Icon Floating (when closed) */}
      {!open && (
        <motion.div
          initial={{ x: 150, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 50 }}
          style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}
        >
          {/* Tooltip Bubble */}
          <AnimatePresence>
            {showTooltip && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4 }}
                style={{
                  backgroundColor: "#1976d2",
                  color: "white",
                  padding: "8px 14px",
                  borderRadius: "20px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  position: "absolute",
                  right: 70,
                  bottom: 10,
                  whiteSpace: "nowrap",
                  fontSize: "0.9rem",
                }}
              >
                💬 Need some assistance? Click me!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bot Avatar Button */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
              borderRadius: ["10%", "50%", "10%"],
              boxShadow: [
                "0 0 0px rgba(25,118,210,0.3)",
                "0 0 12px rgba(25,118,210,0.6)",
                "0 0 0px rgba(25,118,210,0.3)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Fab
              color="primary"
              size="large"
              onClick={() => setOpen(true)}
              sx={{
                width: 60,
                height: 60,
                boxShadow: 5,
              }}
            >
              <SmartToyIcon sx={{ fontSize: 32 }} />
            </Fab>
          </motion.div>
        </motion.div>
      )}

       {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-window"
            initial={{ x: 350, opacity: 0 }}      // start off-screen to the right
            animate={{ x: 0, opacity: 1 }}       // slide in smoothly
            exit={{ x: 350, opacity: 0 }}        // slide out right
            transition={{
              type: "tween",
              ease: "easeInOut",
              duration: 0.4,                     // fast but smooth
            }}
            style={{
              position: "fixed",
              bottom: 150,
              right: 30,
              zIndex: 2100,
            }}
          >
            <Paper
              sx={{
                p: 2,
                width: 320,
                height: 420,
                display: "flex",
                flexDirection: "column",
                boxShadow: 8,
                borderRadius: "16px 0 0 16px",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  🤖 Damayan Assistant
                </Typography>
                <IconButton size="small" onClick={() => setOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              {/* Chat body */}
              <Box
                ref={chatBodyRef}
                sx={{
                  flex: 1,
                  overflowY: "auto",
                  mb: 1,
                  px: 1,
                  "&::-webkit-scrollbar": { width: 4 },
                }}
              >
                {messages.map((m, i) => (
                  <Typography
                    key={i}
                    align={m.from === "user" ? "right" : "left"}
                    color={m.from === "user" ? "primary" : "text.primary"}
                    sx={{
                      mb: 1,
                      backgroundColor:
                        m.from === "user" ? "#E3F2FD" : "#F5F5F5",
                      p: 1,
                      borderRadius: 2,
                      display: "inline-block",
                      maxWidth: "80%",
                      wordBreak: "break-word",
                    }}
                  >
                    {m.text}
                  </Typography>
                ))}
                {loading && <TypingIndicator />}
              </Box>

              {/* Input */}
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <TextField
                  size="small"
                  fullWidth
                  variant="outlined"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                />
                <IconButton color="primary" onClick={handleSend}>
                  <SendIcon />
                </IconButton>
              </Box>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default ChatBot;