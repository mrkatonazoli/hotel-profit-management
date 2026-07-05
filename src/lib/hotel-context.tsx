"use client";

import { createContext, useContext, useEffect, useRef } from "react";

interface HotelCtx {
  hotelId: string;
  setHotelId: (id: string) => void;
}

export const HotelContext = createContext<HotelCtx>({ hotelId: "", setHotelId: () => {} });

export function useActiveHotelId() {
  return useContext(HotelContext).hotelId;
}

export function useSetHotelId() {
  return useContext(HotelContext).setHotelId;
}

export function useHotelChange(callback: () => void) {
  const hotelId = useActiveHotelId();
  const isFirst = useRef(true);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    callbackRef.current();
  }, [hotelId]);
}
