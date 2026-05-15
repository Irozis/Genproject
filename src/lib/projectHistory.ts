import { parseStoredProject } from './storage'
import type { Project, ProjectHistoryItem } from './types'

const KEY = 'adaptive-graphics:project-history:v1'

type RawProjectHistoryItem = Omit<ProjectHistoryItem, 'project'> & {
  project: unknown
}

export function saveProjectToHistory(project: Project): ProjectHistoryItem {
  const now = new Date().toISOString()
  const items = readHistory()
  const existing = items.find((item) => item.id === project.id)
  const next: ProjectHistoryItem = {
    id: project.id,
    name: displayProjectName(project),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    thumbnail: projectThumbnail(project),
    project,
  }
  writeHistory(upsertHistoryItem(items, next))
  return next
}

export function listProjectHistory(): ProjectHistoryItem[] {
  return readHistory().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadProjectFromHistory(id: string): Project | null {
  return readHistory().find((item) => item.id === id)?.project ?? null
}

export function deleteProjectFromHistory(id: string): void {
  writeHistory(readHistory().filter((item) => item.id !== id))
}

export function duplicateProjectFromHistory(id: string): ProjectHistoryItem | null {
  const item = readHistory().find((entry) => entry.id === id)
  if (!item) return null
  const now = new Date().toISOString()
  const nextId = createId('project')
  const project: Project = {
    ...cloneProject(item.project),
    id: nextId,
    name: `${item.project.name || item.name} copy`,
  }
  const duplicate: ProjectHistoryItem = {
    id: nextId,
    name: displayProjectName(project),
    createdAt: now,
    updatedAt: now,
    thumbnail: projectThumbnail(project),
    project,
  }
  writeHistory([duplicate, ...readHistory()])
  return duplicate
}

export function updateProjectHistoryItem(id: string, project: Project): ProjectHistoryItem | null {
  const items = readHistory()
  const existing = items.find((item) => item.id === id)
  if (!existing) return null
  const now = new Date().toISOString()
  const next: ProjectHistoryItem = {
    ...existing,
    name: displayProjectName(project),
    updatedAt: now,
    thumbnail: projectThumbnail(project),
    project: { ...project, id },
  }
  writeHistory(upsertHistoryItem(items, next))
  return next
}

function readHistory(): ProjectHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const items = parsed
      .map(parseHistoryItem)
      .filter((item): item is ProjectHistoryItem => item !== null)
    if (items.length !== parsed.length) writeHistory(items)
    return items
  } catch {
    return []
  }
}

function writeHistory(items: ProjectHistoryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // quota or privacy mode - silently ignore in MVP
  }
}

function parseHistoryItem(raw: unknown): ProjectHistoryItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as RawProjectHistoryItem
  if (
    typeof item.id !== 'string' ||
    typeof item.name !== 'string' ||
    typeof item.createdAt !== 'string' ||
    typeof item.updatedAt !== 'string'
  ) {
    return null
  }
  const project = parseStoredProject(item.project)
  if (!project) return null
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(typeof item.thumbnail === 'string' ? { thumbnail: item.thumbnail } : {}),
    project,
  }
}

function upsertHistoryItem(items: ProjectHistoryItem[], item: ProjectHistoryItem): ProjectHistoryItem[] {
  return [item, ...items.filter((entry) => entry.id !== item.id)]
}

function displayProjectName(project: Project): string {
  return project.name.trim() || 'Untitled project'
}

function projectThumbnail(project: Project): string | undefined {
  return project.imageSrc ?? project.master.image?.src ?? project.logoSrc ?? undefined
}

function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project)) as Project
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000).toString(36)}`
}
