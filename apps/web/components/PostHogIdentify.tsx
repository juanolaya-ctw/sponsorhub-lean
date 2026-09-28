"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogIdentify({
  userId,
  email,
  rol,
}: {
  userId: string;
  email: string | null;
  rol: string;
}) {
  useEffect(() => {
    posthog.identify(userId, { email, rol });
  }, [userId, email, rol]);

  return null;
}
