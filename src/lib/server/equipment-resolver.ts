import "server-only";
import { z } from "zod";
import { findInverter, findPvModule } from "@/data/demo-catalog";
import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";
import { findPublishedInverter, findPublishedPvModule } from "./datasheet-repository";

const uuidSchema = z.string().uuid();
const allowDemo =
  process.env.NODE_ENV !== "production" ||
  (process.env.CI === "true" && process.env.EASYSOLAR_E2E_ALLOW_DEMO === "true");

// Demo ids are scaffold fixtures. Any UUID must resolve to a Published revision, so an
// unpublished or draft product can never reach the sizing engine.
export async function resolvePvModule(id: string): Promise<PvModuleSpec | null> {
  const demo = allowDemo ? findPvModule(id) : null;
  if (demo) return demo;
  if (!uuidSchema.safeParse(id).success) return null;
  return findPublishedPvModule(id);
}

export async function resolveInverter(id: string): Promise<InverterSpec | null> {
  const demo = allowDemo ? findInverter(id) : null;
  if (demo) return demo;
  if (!uuidSchema.safeParse(id).success) return null;
  return findPublishedInverter(id);
}
