import { beforeEach, describe, expect, it, vi } from 'vitest'
import { newProject } from '../defaults'
import {
  deleteProjectFromHistory,
  duplicateProjectFromHistory,
  listProjectHistory,
  loadProjectFromHistory,
  saveProjectToHistory,
  updateProjectHistoryItem,
} from '../projectHistory'

const HISTORY_KEY = 'adaptive-graphics:project-history:v1'

class MemoryStorage {
  private store = new Map<string, string>()

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

describe('projectHistory', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  it('saves, lists, loads, and deletes projects', () => {
    const project = { ...newProject('history-one'), name: 'History One' }

    const item = saveProjectToHistory(project)

    expect(item.id).toBe(project.id)
    expect(listProjectHistory()).toHaveLength(1)
    expect(loadProjectFromHistory(project.id)?.name).toBe('History One')

    deleteProjectFromHistory(project.id)

    expect(listProjectHistory()).toEqual([])
    expect(loadProjectFromHistory(project.id)).toBeNull()
  })

  it('duplicates with a new item id and project id', () => {
    const project = { ...newProject('source'), name: 'Source' }
    saveProjectToHistory(project)

    const duplicate = duplicateProjectFromHistory(project.id)

    expect(duplicate).not.toBeNull()
    expect(duplicate!.id).not.toBe(project.id)
    expect(duplicate!.project.id).toBe(duplicate!.id)
    expect(duplicate!.project.name).toBe('Source copy')
    expect(listProjectHistory().map((item) => item.id)).toContain(project.id)
  })

  it('round-trips stored projects through existing project validation and migration', () => {
    const oldProject = {
      ...newProject('legacy'),
      selectedFormats: ['marketplace-card'],
      activeFormatKey: 'marketplace-card',
    }
    storage.setItem(
      HISTORY_KEY,
      JSON.stringify([
        {
          id: oldProject.id,
          name: oldProject.name,
          createdAt: '2026-05-13T00:00:00.000Z',
          updatedAt: '2026-05-13T00:00:00.000Z',
          project: oldProject,
        },
      ]),
    )

    const loaded = loadProjectFromHistory(oldProject.id)

    expect(loaded?.selectedFormats).toEqual(['vk-square'])
    expect(loaded?.activeFormatKey).toBe('vk-square')
  })

  it('updates an existing item without changing its createdAt timestamp', () => {
    const project = { ...newProject('update-source'), name: 'Before' }
    const original = saveProjectToHistory(project)
    const updated = updateProjectHistoryItem(project.id, { ...project, name: 'After' })

    expect(updated?.createdAt).toBe(original.createdAt)
    expect(loadProjectFromHistory(project.id)?.name).toBe('After')
    expect(listProjectHistory()[0]?.name).toBe('After')
  })

  it('keeps the current project in history before switching to an older project', () => {
    const current = { ...newProject('current-project'), name: 'Current Project' }
    const old = { ...newProject('old-project'), name: 'Old Project' }
    saveProjectToHistory(old)

    saveProjectToHistory(current)
    const switched = loadProjectFromHistory(old.id)

    expect(switched?.name).toBe('Old Project')
    expect(listProjectHistory().map((item) => item.id)).toEqual(
      expect.arrayContaining([current.id, old.id]),
    )
    expect(loadProjectFromHistory(current.id)?.name).toBe('Current Project')
  })
})
