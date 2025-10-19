import React, { useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";

const RevealOnScroll = ({
  children,
  delay = 0.2,
  duration = 0.8,
  repeat = true, // ✅ allow repeated animations
  threshold = 0.2, // ✅ how much of the element should be visible to trigger
}) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: !repeat, // trigger only once if repeat=false
    threshold,
  });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    } else if (repeat) {
      controls.start("hidden");
    }
  }, [controls, inView, repeat]);

  const variants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: "easeOut" },
    },
  };

  return (
    <motion.div ref={ref} initial="hidden" animate={controls} variants={variants}>
      {children}
    </motion.div>
  );
};

export default RevealOnScroll;