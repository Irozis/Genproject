import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SceneRenderer } from '../../renderers/SceneRenderer'
import { DEFAULT_MASTER, newProject } from '../defaults'
import {
  ensureProjectFormatDocuments,
  moveLayer,
  selectDocumentObject,
  sceneFromFormatDocument,
  sceneToObjects,
  sortLayers,
  updateObjectProperties,
} from '../formatDocuments'
import type { Project, SceneObject } from '../types'

describe('project format documents', () => {
  it('new project has no formatDocuments by default', () => {
    expect(newProject('docs-default').formatDocuments).toBeUndefined()
  })

  it('creates a ProjectFormatDocument for each selected format after generation', () => {
    const project: Project = {
      ...newProject('docs-created'),
      selectedFormats: ['vk-square', 'instagram-story'],
    }
    const next = ensureProjectFormatDocuments(project, new Date('2026-05-13T00:00:00.000Z'))

    expect(Object.keys(next.formatDocuments ?? {}).sort()).toEqual(['instagram-story', 'vk-square'])
    expect(next.formatDocuments?.['vk-square']?.createdFromGeneration).toBe(true)
    expect(next.formatDocuments?.['vk-square']?.scene.title).toBeDefined()
    expect(next.formatDocuments?.['vk-square']?.objects.some((object) => object.type === 'title')).toBe(true)
  })

  it('does not overwrite an existing ProjectFormatDocument during regeneration', () => {
    const project: Project = {
      ...newProject('docs-preserve'),
      selectedFormats: ['vk-square'],
    }
    const generated = ensureProjectFormatDocuments(project, new Date('2026-05-13T00:00:00.000Z'))
    const document = generated.formatDocuments!['vk-square']!
    const editedScene = {
      ...document.scene,
      title: document.scene.title ? { ...document.scene.title, text: 'Manual title' } : undefined,
    }
    const edited: Project = {
      ...generated,
      formatDocuments: {
        ...generated.formatDocuments,
        'vk-square': {
          ...document,
          scene: editedScene,
          objects: sceneToObjects(editedScene),
          updatedAt: '2026-05-13T01:00:00.000Z',
        },
      },
    }

    const regenerated = ensureProjectFormatDocuments(edited, new Date('2026-05-13T02:00:00.000Z'))

    expect(regenerated.formatDocuments?.['vk-square']?.scene.title?.text).toBe('Manual title')
    expect(regenerated.formatDocuments?.['vk-square']?.updatedAt).toBe('2026-05-13T01:00:00.000Z')
  })

  it('sceneToObjects creates expected title/subtitle/cta/image/background objects', () => {
    const scene = {
      ...DEFAULT_MASTER,
      image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,image' } : undefined,
    }
    const objects = sceneToObjects(scene)

    expect(objects.map((object) => object.type)).toEqual(
      expect.arrayContaining(['background', 'title', 'subtitle', 'cta', 'image']),
    )
    expect(objects.find((object) => object.type === 'background')).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
    })
    expect(objects.find((object) => object.type === 'title')?.text).toBe(scene.title?.text)
    expect(objects.find((object) => object.type === 'cta')?.borderRadius).toBe(scene.cta?.rx)
    expect(objects.find((object) => object.type === 'image')?.fit).toBe(scene.image?.fit)
  })

  it('renders from document objects without mutating the base scene', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-render'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!
    const edited = {
      ...document,
      objects: document.objects.map((object) =>
        object.type === 'title' ? { ...object, text: 'Object title', x: object.x + 3 } : object,
      ),
    }

    const scene = sceneFromFormatDocument(edited)

    expect(scene.title?.text).toBe('Object title')
    expect(scene.title?.x).toBe((document.scene.title?.x ?? 0) + 3)
    expect(document.scene.title?.text).not.toBe('Object title')
  })

  it('sorts layers by zIndex descending', () => {
    const objects: SceneObject[] = [
      { id: 'background', type: 'background', name: 'Background', visible: true, x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
      { id: 'title', type: 'title', name: 'Title', visible: true, x: 0, y: 0, width: 50, height: 10, zIndex: 40 },
      { id: 'logo', type: 'logo', name: 'Logo', visible: true, x: 0, y: 0, width: 10, height: 10, zIndex: 70 },
    ]

    expect(sortLayers([...objects]).map((object) => object.id)).toEqual(['logo', 'title', 'background'])
  })

  it('assigns title above image by default', () => {
    const objects = sceneToObjects(DEFAULT_MASTER)
    const title = objects.find((object) => object.type === 'title')!
    const image = objects.find((object) => object.type === 'image')!

    expect(title.zIndex).toBeGreaterThan(image.zIndex ?? 0)
  })

  it('visibility false hides object from conversion and object render', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-hidden'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!
    const hidden = {
      ...document,
      objects: document.objects.map((object) => object.type === 'title' ? { ...object, visible: false } : object),
    }

    expect(sceneFromFormatDocument(hidden).title).toBeUndefined()
    const markup = renderToStaticMarkup(
      createElement(SceneRenderer, {
        scene: sceneFromFormatDocument(hidden),
        objects: hidden.objects,
        rules: hidden.format,
        displayFont: project.brandKit.displayFont,
        textFont: project.brandKit.textFont,
      }),
    )
    expect(markup).not.toContain('data-role="title"')
  })

  it('move layer up changes ordering deterministically', () => {
    const objects = sceneToObjects(DEFAULT_MASTER)
    const moved = moveLayer(objects, 'title', 'up')

    expect(sortLayers(moved).map((object) => object.id).indexOf('title')).toBeLessThan(
      sortLayers(objects).map((object) => object.id).indexOf('title'),
    )
    const zIndexes = moved.map((object) => object.zIndex ?? 0)
    expect(zIndexes).toEqual([...zIndexes].sort((a, b) => a - b))
  })

  it('object renderer paints image before title by default', () => {
    const objects = sceneToObjects(DEFAULT_MASTER)
    const markup = renderToStaticMarkup(
      createElement(SceneRenderer, {
        scene: DEFAULT_MASTER,
        objects,
        rules: { key: 'vk-square', label: 'VK', width: 1000, height: 1000, aspectRatio: 1, safeZone: { top: 0, right: 0, bottom: 0, left: 0 }, gutter: 4, minTitleSize: 4, maxTitleLines: 3, requiredElements: ['title'] },
        displayFont: 'Arial',
        textFont: 'Arial',
      }),
    )

    expect(markup.indexOf('data-role="image"')).toBeLessThan(markup.indexOf('data-role="title"'))
  })

  it('selected layer updates activeObjectId', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-selected'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    expect(selectDocumentObject(document, 'cta').activeObjectId).toBe('cta')
    expect(selectDocumentObject(document, 'missing')).toBe(document)
  })

  it('starts generated documents as unedited and marks object changes edited', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-is-edited'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    expect(document.isEdited).toBe(false)
    expect(updateObjectProperties(document, 'title', { visible: false }).isEdited).toBe(true)
    expect(selectDocumentObject(document, 'title').isEdited).toBe(false)
  })

  it('locked object cannot be edited through property helper', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-locked'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!
    const locked = {
      ...document,
      objects: document.objects.map((object) => object.type === 'title' ? { ...object, locked: true } : object),
    }
    const title = locked.objects.find((object) => object.id === 'title')!

    const edited = updateObjectProperties(locked, 'title', { x: title.x + 10 }, new Date('2026-05-13T01:00:00.000Z'))

    expect(edited.objects.find((object) => object.id === 'title')?.x).toBe(title.x)
    expect(updateObjectProperties(locked, 'title', { locked: false }).objects.find((object) => object.id === 'title')?.locked).toBe(false)
  })
})
