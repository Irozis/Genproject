import { parseBrandSnapshotList } from './serialize'
import type { BrandKit, BrandSnapshot } from './types'

const KEY = 'ag:brandSnapshots'

function readAll(): BrandSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return parseBrandSnapshotList(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeAll(items: BrandSnapshot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // Ignore quota / privacy failures in MVP.
  }
}

export function listSnapshots(): BrandSnapshot[] {
  return readAll()
}

export function saveSnapshot(name: string, kit: BrandKit): BrandSnapshot {
  const snap: BrandSnapshot = {
    id: `${Date.now()}`,
    name: name.trim() || 'Untitled brand',
    brandKit: kit,
    createdAt: Date.now(),
  }
  const items = readAll()
  writeAll([snap, ...items])
  return snap
}

export function applySnapshot(id: string): BrandKit | null {
  const snap = readAll().find((s) => s.id === id)
  return snap ? snap.brandKit : null
}

export function deleteSnapshot(id: string): void {
  const items = readAll()
  writeAll(items.filter((s) => s.id !== id))
}
