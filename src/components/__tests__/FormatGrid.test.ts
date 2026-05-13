import { describe, expect, it } from 'vitest'
import { shouldUseFormatDocument } from '../FormatGrid'
import { ensureProjectFormatDocuments } from '../../lib/formatDocuments'
import { newProject } from '../../lib/defaults'

describe('FormatGrid document routing', () => {
  it('keeps normal preview on generated scene while document is not edited', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('grid-unedited-doc'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    expect(document.isEdited).toBe(false)
    expect(shouldUseFormatDocument(document, undefined)).toBeUndefined()
  })

  it('uses document objects only after explicit edit', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('grid-edited-doc'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = { ...project.formatDocuments!['vk-square']!, isEdited: true }

    expect(shouldUseFormatDocument(document, undefined)).toBe(document)
    expect(shouldUseFormatDocument(document, { title: { x: 10 } })).toBe(document)
  })
})
