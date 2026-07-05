"use client";

import { useEffect } from "react";

/**
 * Runs `callback` whenever the active hotel changes (hotel-changed event).
 * Pages use this to re-fetch hotel-specific data without a full page reload.
 */
export function useHotelChange(callback: () => void) {
  useEffect(() => {
    window.addEventListener("hotel-changed", callback);
    return () => window.removeEventListener("hotel-changed", callback);
  }, [callback]);
}
