"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const VisitorTracker = () => {
  const pathname = usePathname();

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
    const startTime = Date.now();

    const sendTelemetry = (durationSec = 0) => {
      try {
        const payload = JSON.stringify({
          pagePath: pathname,
          durationSeconds: Math.floor(durationSec),
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        });

        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon(`${API_BASE}/api/analytics/track`, payload);
        } else {
          fetch(`${API_BASE}/api/analytics/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Telemetry error:", err);
      }
    };

    // Initial ping on page load
    sendTelemetry(0);

    // Heartbeat duration ping every 15 seconds
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      sendTelemetry(elapsedSec);
    }, 15000);

    // Unload ping
    const handleUnload = () => {
      const elapsedSec = (Date.now() - startTime) / 1000;
      sendTelemetry(elapsedSec);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      const finalSec = (Date.now() - startTime) / 1000;
      sendTelemetry(finalSec);
    };
  }, [pathname]);

  return null;
};
