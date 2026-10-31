import "server-only";
import { z } from "zod";
import { findInverter, findPvModule } from "@/data/demo-catalog";
import type { InverterSpec, PvModuleSpec } from "@/domain/catalog/types";
import { findPublishedInverter, findPublishedPvModule } from "./datasheet-repository";

const uuidSchema = z.string().uuid();

// Demo ids are scaffold fixtures. Any UUID must resolve to a Published revision, so an
// unpublished or draft product can never reach the sizing engine.
export async function resolvePvModule(id: string): Promise<PvModuleSpec | null> {
  const demo = findPvModule(id);
  if (demo) return demo;
  if (!uuidSchema.safeParse(id).success) return null;
  return findPublishedPvModule(id);
}

export async function resolveInverter(id: string): Promise<InverterSpec | null> {
  const demo = findInverter(id);
  if (demo) return demo;
  if (!uuidSchema.safeParse(id).success) return null;
  return findPublishedInverter(id);
}
