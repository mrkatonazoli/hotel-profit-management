"use client";

import { createContext, useContext, useEffect, useRef } from "react";

export const HotelContext = createContext<string>("");

/** Returns the active hotel ID from context. Changes when user switches hotel. */
export function useActiveHotelId() {
  return useContext(HotelContext);
}

/**
 * Runs `callback` whenever the active hotel changes.
 * Use in pages to re-fetch hotel-specific data.
 */
export function useHotelChange(callback: () => void) {
  const hotelId = useActiveHotelId();
  const isFirst = useRef(true);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return; // skip initial render — the page already loads on mount
    }
    callbackRef.current();
  }, [hotelId]); // re-runs when hotel switches
}
