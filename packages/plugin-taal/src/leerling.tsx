"use client";

import { useEffect } from "react";
import type { PluginCall } from "@imprint/runtime-admin";
import { koppel } from "./opslag";

/**
 * On a prerendered page: asks in the browser who is looking, so a member's
 * results and choice of forms come from (and go to) the account. Shows
 * nothing; without `call` or without a session nothing happens.
 */
export function Leerling({ call }: { call?: PluginCall }) {
  useEffect(() => {
    void koppel(call);
  }, [call]);
  return null;
}
