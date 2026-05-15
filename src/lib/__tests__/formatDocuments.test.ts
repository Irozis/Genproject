import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SceneRenderer } from '../../renderers/SceneRenderer'
import { DEFAULT_MASTER, newProject } from '../defaults'
import { FIXTURE_MASTER } from './fixtures'
import { LayersPanel } from '../../components/editor/LayersPanel'
import {
  addSceneObject,
  createSceneObject,
  ensureProjectFormatDocuments,
  moveLayer,
  selectDocumentObject,
  sceneFromFormatDocument,
  sceneToObjects,
  sortLayers,
  updateObjectProperties,
} from '../formatDocuments'
import { validateObjectEdit } from '../objectEditValidation'
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

  it('manual object editor allows title width above old generation limits', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-free-width'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    const edited = updateObjectProperties(document, 'title', { width: 80 })

    expect(edited.objects.find((object) => object.id === 'title')?.width).toBe(80)
  })

  it('manual object outside safe zone is saved and reported as warning', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-safe-zone-warning'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    const edited = updateObjectProperties(document, 'title', { x: -25 })
    const title = edited.objects.find((object) => object.id === 'title')!

    expect(title.x).toBe(-25)
    expect(validateObjectEdit(title, document.format, edited.objects).map((issue) => issue.code)).toContain('outside-safe-zone')
  })

  it('text content update changes only the selected format document', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-text-per-format'), selectedFormats: ['vk-square', 'instagram-story'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const square = project.formatDocuments!['vk-square']!
    const story = project.formatDocuments!['instagram-story']!

    const editedSquare = updateObjectProperties(square, 'title', { text: 'Only square' })

    expect(sceneFromFormatDocument(editedSquare).title?.text).toBe('Only square')
    expect(sceneFromFormatDocument(story).title?.text).not.toBe('Only square')
  })

  it('borderRadius updates image object', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-image-radius'), master: FIXTURE_MASTER, selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    const edited = updateObjectProperties(document, 'image', { borderRadius: 37 })

    expect(edited.objects.find((object) => object.id === 'image')?.borderRadius).toBe(37)
    expect(sceneFromFormatDocument(edited).image?.rx).toBe(37)
  })

  it('fit changes image object including fill mode', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-image-fit'), master: FIXTURE_MASTER, selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    const edited = updateObjectProperties(document, 'image', { fit: 'fill' })

    expect(edited.objects.find((object) => object.id === 'image')?.fit).toBe('fill')
  })

  it('crop settings update only the selected image object', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-image-crop'), master: FIXTURE_MASTER, selectedFormats: ['vk-square', 'instagram-story'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const square = project.formatDocuments!['vk-square']!
    const story = project.formatDocuments!['instagram-story']!

    const edited = updateObjectProperties(square, 'image', {
      cropZoom: 1.6,
      cropX: 12,
      cropY: -8,
      focalX: 0.25,
      focalY: 0.7,
    })

    expect(sceneFromFormatDocument(edited).image).toMatchObject({
      cropZoom: 1.6,
      cropX: 12,
      cropY: -8,
      focalX: 0.25,
      focalY: 0.7,
    })
    expect(story.objects.find((object) => object.id === 'image')).not.toMatchObject({
      cropZoom: 1.6,
      cropX: 12,
    })
  })

  it('object edits do not affect other format documents', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-isolated-docs'), selectedFormats: ['vk-square', 'instagram-story'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const square = project.formatDocuments!['vk-square']!
    const story = project.formatDocuments!['instagram-story']!
    const storyTitle = story.objects.find((object) => object.id === 'title')!

    const editedSquare = updateObjectProperties(square, 'title', { x: 77, text: 'Square only' })

    expect(editedSquare.objects.find((object) => object.id === 'title')?.x).toBe(77)
    expect(story.objects.find((object) => object.id === 'title')).toMatchObject({
      x: storyTitle.x,
      text: storyTitle.text,
    })
  })

  it('creates a default text object', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-create-text'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!

    const object = createSceneObject('text', document.format)

    expect(object).toMatchObject({
      type: 'text',
      name: 'Новый текст',
      text: 'Новый текст',
      visible: true,
      textAlign: 'center',
    })
    expect(object.id).toMatch(/^text-/)
  })

  it('adds a shape object only to the active format document', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-add-active'), selectedFormats: ['vk-square', 'instagram-story'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const square = project.formatDocuments!['vk-square']!
    const story = project.formatDocuments!['instagram-story']!

    const editedSquare = addSceneObject(square, 'shape', new Date('2026-05-13T01:00:00.000Z'))

    expect(editedSquare.objects.some((object) => object.type === 'shape')).toBe(true)
    expect(story.objects.some((object) => object.type === 'shape')).toBe(false)
    expect(editedSquare.activeObjectId).toBe(editedSquare.objects.at(-1)?.id)
    expect(editedSquare.isEdited).toBe(true)
  })

  it('newly added object appears in the layer list', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-layer-list'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = addSceneObject(project.formatDocuments!['vk-square']!, 'decor')

    const markup = renderToStaticMarkup(
      createElement(LayersPanel, {
        objects: document.objects,
        activeObjectId: document.activeObjectId,
        onSelect: () => undefined,
        onToggleVisible: () => undefined,
        onToggleLocked: () => undefined,
        onMove: () => undefined,
      }),
    )

    expect(markup).toContain('Декор')
    expect(markup).not.toContain('decor')
  })

  it('assigns added object zIndex above existing objects', () => {
    const project = ensureProjectFormatDocuments(
      { ...newProject('objects-z-index'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = project.formatDocuments!['vk-square']!
    const maxBefore = Math.max(...document.objects.map((object) => object.zIndex ?? 0))

    const edited = addSceneObject(document, 'custom-image')
    const added = edited.objects.find((object) => object.id === edited.activeObjectId)!

    expect(added.zIndex).toBeGreaterThan(maxBefore)
    expect(sortLayers(edited.objects)[0]).toBe(added)
  })
})
