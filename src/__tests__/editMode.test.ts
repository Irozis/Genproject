import { describe, expect, it } from 'vitest'
import { enterFormatEditMode, exitFormatEditMode } from '../App'
import { newProject } from '../lib/defaults'
import { ensureProjectFormatDocuments, selectDocumentObject } from '../lib/formatDocuments'
import { getFormat } from '../lib/formats'
import type { FormatKey } from '../lib/types'

describe('format edit mode state', () => {
  it('sets activeFormatKey when entering edit mode', () => {
    const project = newProject('edit-entry')
    const next = enterFormatEditMode(project, 'vk-stories')

    expect(next.activeFormatKey).toBe('vk-stories')
    expect(next.editorMode).toBe('edit')
    expect(next.activeObjectId).toBe(next.formatDocuments?.['vk-stories']?.activeObjectId)
  })

  it('refreshes an unedited generated document with the selected composition', () => {
    const generated = ensureProjectFormatDocuments(
      { ...newProject('edit-selected-composition'), selectedFormats: ['vk-square'], imageSrc: 'data:image/png;base64,image' },
      new Date('2026-05-14T00:00:00.000Z'),
    )
    const next = enterFormatEditMode(
      { ...generated, formatOverrides: { 'vk-square': 'text-dominant' } },
      'vk-square',
      true,
    )

    expect(generated.formatDocuments?.['vk-square']?.scene.image).toBeDefined()
    expect(next.formatDocuments?.['vk-square']?.scene.image).toBeUndefined()
  })

  it('exposes the active format name and size', () => {
    const project = enterFormatEditMode(newProject('edit-active-format'), 'vk-stories')
    const active = getFormat(project.activeFormatKey! as FormatKey, project.customFormats)

    expect(active.label).toBe('VK История')
    expect(`${active.width}×${active.height}`).toBe('1080×1920')
  })

  it('exits edit mode from the back action', () => {
    const project = enterFormatEditMode(newProject('edit-back'), 'vk-stories')
    const next = exitFormatEditMode(project)

    expect(next.activeFormatKey).toBeUndefined()
    expect(next.activeObjectId).toBeUndefined()
    expect(next.editorMode).toBe('preview')
  })

  it('selecting a layer makes its object available for properties', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('edit-layer-select'), selectedFormats: ['vk-stories'] },
      new Date('2026-05-14T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-stories']!
    const selectable = document.objects.find((object) => object.type === 'title') ?? document.objects[0]!
    const selected = selectDocumentObject(document, selectable.id)
    const activeObject = selected.objects.find((object) => object.id === selected.activeObjectId)

    expect(activeObject?.id).toBe(selectable.id)
    expect(activeObject).toMatchObject({
      id: selectable.id,
      name: selectable.name,
      type: selectable.type,
    })
  })
})
