"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    if (!target) {
      setValue(0);
      return;
    }
    startTime.current = null;

    function step(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        animFrame.current = requestAnimationFrame(step);
      }
    }

    animFrame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame.current);
  }, [target, duration]);

  return value;
}
