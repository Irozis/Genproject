import { buildScene } from './buildScene'
import { getFormat } from './formats'
import { applyLayoutDensity } from './layoutDensity'
import { getActiveImageFitMode, getActiveImageSrc } from './projectImages'
import type {
  BlockKind,
  FormatKey,
  Project,
  ProjectFormatDocument,
  Scene,
  SceneObject,
  FormatRuleSet,
} from './types'

const SCENE_BLOCKS = ['image', 'title', 'subtitle', 'cta', 'badge', 'logo'] as const
export type CreatableSceneObjectType = 'text' | 'shape' | 'custom-image' | 'decor'

const OBJECT_Z: Record<'background' | (typeof SCENE_BLOCKS)[number], number> = {
  background: 0,
  image: 10,
  badge: 30,
  title: 40,
  subtitle: 41,
  cta: 42,
  logo: 50,
}

export function sceneToObjects(scene: Scene, format?: Pick<FormatRuleSet, 'aspectRatio'>): SceneObject[] {
  const objects: SceneObject[] = [
    {
      id: 'background',
      type: 'background',
      name: 'Background',
      visible: true,
      locked: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: OBJECT_Z.background,
      fill: backgroundFill(scene),
      metadata: { background: scene.background, accent: scene.accent },
    },
  ]

  for (const kind of SCENE_BLOCKS) {
    const block = scene[kind]
    if (!block) continue
    const source = block as Record<string, unknown>
    const object: SceneObject = {
      id: kind,
      type: kind,
      name: objectName(kind),
      visible: true,
      x: block.x,
      y: block.y,
      width: block.w,
      height: blockHeight(kind, source, format),
      zIndex: OBJECT_Z[kind],
      metadata: { blockKind: kind },
    }

    if (typeof source.text === 'string') object.text = source.text
    if (typeof source.fontFamily === 'string') object.fontFamily = source.fontFamily
    if (typeof source.fontSize === 'number') object.fontSize = source.fontSize
    if (typeof source.weight === 'number') object.fontWeight = source.weight
    if (typeof source.lineHeight === 'number') object.lineHeight = source.lineHeight
    if (typeof source.letterSpacing === 'number') object.letterSpacing = source.letterSpacing
    if (source.align === 'left' || source.align === 'center' || source.align === 'right') {
      object.textAlign = source.align
    }
    if (typeof source.fill === 'string') object.fill = source.fill
    if (typeof source.opacity === 'number') object.opacity = source.opacity
    if (typeof source.rx === 'number') object.borderRadius = source.rx
    if (typeof source.bg === 'string') object.metadata = { ...object.metadata, bg: source.bg }
    if (typeof source.src === 'string') object.imageSrc = source.src
    if (source.fit === 'cover' || source.fit === 'contain' || source.fit === 'fill') object.fit = source.fit
    if (typeof source.focalX === 'number') object.focalX = source.focalX
    if (typeof source.focalY === 'number') object.focalY = source.focalY
    if (typeof source.cropZoom === 'number') object.cropZoom = source.cropZoom
    if (typeof source.cropX === 'number') object.cropX = source.cropX
    if (typeof source.cropY === 'number') object.cropY = source.cropY
    if (typeof source.bgOpacity === 'number') object.metadata = { ...object.metadata, bgOpacity: source.bgOpacity }

    objects.push(object)
  }

  return objects.sort((a, b) => zIndexForObject(a) - zIndexForObject(b))
}

export function createSceneObject(type: CreatableSceneObjectType, format: ProjectFormatDocument['format']): SceneObject {
  const id = `${type}-${uniqueId()}`
  const common = {
    id,
    type,
    visible: true,
    locked: false,
    zIndex: 60,
  } satisfies Pick<SceneObject, 'id' | 'type' | 'visible' | 'locked' | 'zIndex'>

  switch (type) {
    case 'text':
      return {
        ...common,
        name: 'Новый текст',
        x: 25,
        y: 44,
        width: 50,
        height: 12,
        text: 'Новый текст',
        fontSize: Math.max(format.minTitleSize, 4),
        fontWeight: 700,
        lineHeight: 1.15,
        textAlign: 'center',
        fill: '#111827',
        opacity: 1,
      }
    case 'shape':
      return {
        ...common,
        name: 'Фигура',
        x: 30,
        y: 34,
        width: 40,
        height: 22,
        fill: '#FFFFFF',
        stroke: '#111827',
        opacity: 0.92,
        borderRadius: 18,
      }
    case 'custom-image':
      return {
        ...common,
        name: 'Изображение',
        x: 28,
        y: 28,
        width: 44,
        height: 32,
        imageSrc: undefined,
        fit: 'cover',
        fill: '#F3F4F6',
        stroke: '#9CA3AF',
        opacity: 1,
        borderRadius: 16,
      }
    case 'decor':
      return {
        ...common,
        name: 'Декор',
        x: 72,
        y: 12,
        width: 14,
        height: 6,
        rotation: -8,
        fill: '#FF5A1F',
        opacity: 0.88,
        borderRadius: 999,
      }
  }
}

export function addSceneObject(
  document: ProjectFormatDocument,
  type: CreatableSceneObjectType,
  now = new Date(),
): ProjectFormatDocument {
  const object = createSceneObject(type, document.format)
  const maxZ = document.objects.reduce((max, candidate) => Math.max(max, zIndexForObject(candidate)), 0)
  const withZ: SceneObject = { ...object, zIndex: maxZ + 10 }
  return {
    ...document,
    objects: [...document.objects, withZ],
    activeObjectId: withZ.id,
    isEdited: true,
    updatedAt: now.toISOString(),
  }
}

export function sceneFromFormatDocument(document: ProjectFormatDocument): Scene {
  return objectsToScene(document.scene, document.objects)
}

export function objectsToScene(baseScene: Scene, objects: SceneObject[]): Scene {
  let next: Scene = { ...baseScene }
  const allByType = new Map(sortObjectsForRender(objects).map((object) => [object.type, object]))
  const byType = new Map(
    sortObjectsForRender(objects)
      .filter((object) => object.visible)
      .map((object) => [object.type, object]),
  )

  const background = byType.get('background')
  const savedBackground = background?.metadata?.background
  if (isBackground(savedBackground)) {
    next = {
      ...next,
      background: savedBackground,
      accent: typeof background?.metadata?.accent === 'string' ? background.metadata.accent : next.accent,
    }
  }

  for (const kind of SCENE_BLOCKS) {
    if (allByType.has(kind) && !byType.has(kind)) {
      ;(next as Record<string, unknown>)[kind] = undefined
      continue
    }
    const object = byType.get(kind)
    const current = next[kind]
    if (!object || !current) continue
    const patch: Record<string, unknown> = {
      x: object.x,
      y: object.y,
      w: object.width,
      h: object.height,
    }
    if (object.text !== undefined) patch.text = object.text
    if (object.fontFamily !== undefined) patch.fontFamily = object.fontFamily
    if (object.fontSize !== undefined) patch.fontSize = object.fontSize
    if (object.fontWeight !== undefined) patch.weight = object.fontWeight
    if (object.lineHeight !== undefined) patch.lineHeight = object.lineHeight
    if (object.letterSpacing !== undefined) patch.letterSpacing = object.letterSpacing
    if (object.textAlign !== undefined) patch.align = object.textAlign
    if (object.fill !== undefined) patch.fill = object.fill
    if (object.opacity !== undefined) patch.opacity = object.opacity
    if (object.borderRadius !== undefined) patch.rx = object.borderRadius
    if (object.imageSrc !== undefined) patch.src = object.imageSrc
    if (object.fit === 'cover' || object.fit === 'contain') patch.fit = object.fit
    if (object.focalX !== undefined) patch.focalX = object.focalX
    if (object.focalY !== undefined) patch.focalY = object.focalY
    if (object.cropZoom !== undefined) patch.cropZoom = object.cropZoom
    if (object.cropX !== undefined) patch.cropX = object.cropX
    if (object.cropY !== undefined) patch.cropY = object.cropY
    if (typeof object.metadata?.bg === 'string') patch.bg = object.metadata.bg
    if (typeof object.metadata?.bgOpacity === 'number') patch.bgOpacity = object.metadata.bgOpacity
    ;(next as Record<string, unknown>)[kind] = { ...current, ...patch }
  }

  return next
}

export function sortLayers(objects: SceneObject[]): SceneObject[] {
  return objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => {
      const za = zIndexForObject(a.object)
      const zb = zIndexForObject(b.object)
      if (zb !== za) return zb - za
      return b.index - a.index
    })
    .map((entry) => entry.object)
}

export function sortObjectsForRender(objects: SceneObject[]): SceneObject[] {
  return objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => {
      const za = zIndexForObject(a.object)
      const zb = zIndexForObject(b.object)
      if (za !== zb) return za - zb
      return a.index - b.index
    })
    .map((entry) => entry.object)
}

export function moveLayer(objects: SceneObject[], objectId: string, direction: 'up' | 'down'): SceneObject[] {
  const renderOrder = sortObjectsForRender(objects)
  const index = renderOrder.findIndex((object) => object.id === objectId)
  if (index < 0) return objects

  const object = renderOrder[index]!
  const backgroundIndex = renderOrder.findIndex((candidate) => candidate.type === 'background')
  const background = backgroundIndex >= 0 ? renderOrder[backgroundIndex] : null
  const backgroundIsProtected = !!background?.locked
  if (object.type === 'background' && backgroundIsProtected) return objects

  const targetIndex = direction === 'up' ? index + 1 : index - 1
  if (targetIndex < 0 || targetIndex >= renderOrder.length) return objects
  const target = renderOrder[targetIndex]!
  if (target.type === 'background' && backgroundIsProtected) return objects

  const nextOrder = [...renderOrder]
  nextOrder[index] = target
  nextOrder[targetIndex] = object
  return normalizeZIndexes(nextOrder)
}

export function selectDocumentObject(
  document: ProjectFormatDocument,
  objectId: string,
): ProjectFormatDocument {
  if (!document.objects.some((object) => object.id === objectId)) return document
  return { ...document, activeObjectId: objectId }
}

export function updateObjectProperties(
  document: ProjectFormatDocument,
  objectId: string,
  patch: Partial<SceneObject>,
  now = new Date(),
): ProjectFormatDocument {
  const object = document.objects.find((candidate) => candidate.id === objectId)
  if (!object) return document
  const patchKeys = Object.keys(patch)
  const onlyLayerState = patchKeys.every((key) => key === 'visible' || key === 'locked' || key === 'zIndex')
  if (object.locked && !onlyLayerState) return document
  const sanitizedPatch = sanitizeObjectPatch(patch)
  return {
    ...document,
    objects: document.objects.map((candidate) =>
      candidate.id === objectId ? { ...candidate, ...sanitizedPatch, id: candidate.id } : candidate,
    ),
    isEdited: true,
    updatedAt: now.toISOString(),
  }
}

function sanitizeObjectPatch(patch: Partial<SceneObject>): Partial<SceneObject> {
  const next = { ...patch }
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'zIndex', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'opacity', 'borderRadius', 'focalX', 'focalY', 'cropZoom', 'cropX', 'cropY'] as const) {
    const value = next[key]
    if (typeof value === 'number' && !Number.isFinite(value)) delete next[key]
  }
  if (typeof next.width === 'number') next.width = Math.max(1, next.width)
  if (typeof next.height === 'number') next.height = Math.max(1, next.height)
  return next
}

export function updateObjectsFromScene(scene: Scene, existing: SceneObject[], format?: Pick<FormatRuleSet, 'aspectRatio'>): SceneObject[] {
  const generated = new Map(sceneToObjects(scene, format).map((object) => [object.id, object]))
  const next = existing.map((object) => {
    const replacement = generated.get(object.id)
    if (!replacement) return object
    return {
      ...replacement,
      id: object.id,
      name: object.name,
      visible: object.visible,
      locked: object.locked,
      zIndex: object.zIndex ?? replacement.zIndex,
      focalX: object.focalX ?? replacement.focalX,
      focalY: object.focalY ?? replacement.focalY,
      cropZoom: object.cropZoom ?? replacement.cropZoom,
      cropX: object.cropX ?? replacement.cropX,
      cropY: object.cropY ?? replacement.cropY,
    }
  })
  const existingIds = new Set(existing.map((object) => object.id))
  for (const object of generated.values()) {
    if (!existingIds.has(object.id)) next.push(object)
  }
  return next
}

function normalizeZIndexes(renderOrder: SceneObject[]): SceneObject[] {
  const byId = new Map(renderOrder.map((object, index) => [object.id, { ...object, zIndex: index * 10 }]))
  return renderOrder.map((object) => byId.get(object.id) ?? object)
}

export function zIndexForObject(object: SceneObject): number {
  if (typeof object.zIndex === 'number' && Number.isFinite(object.zIndex)) return object.zIndex
  switch (object.type) {
    case 'background':
      return 0
    case 'image':
    case 'custom-image':
      return 10
    case 'decor':
    case 'shape':
      return 20
    case 'badge':
      return 30
    case 'title':
      return 40
    case 'subtitle':
      return 41
    case 'cta':
      return 42
    case 'logo':
      return 50
    case 'text':
      return 40
  }
}

export function ensureProjectFormatDocuments(project: Project, now = new Date()): Project {
  let changed = false
  const createdAt = now.toISOString()
  const formatDocuments: Record<string, ProjectFormatDocument> = { ...(project.formatDocuments ?? {}) }

  for (const formatKey of project.selectedFormats) {
    if (formatDocuments[formatKey]) continue
    const scene = buildSceneForFormatDocument(project, formatKey)
    const format = applyLayoutDensity(
      getFormat(formatKey, project.customFormats),
      project.formatDensities?.[formatKey] ?? project.layoutDensity,
    )
    formatDocuments[formatKey] = {
      formatKey,
      format,
      scene,
      objects: sceneToObjects(scene, format),
      isEdited: false,
      createdFromGeneration: true,
      createdAt,
      updatedAt: createdAt,
    }
    changed = true
  }

  if (!changed) return project
  return {
    ...project,
    formatDocuments,
    activeFormatKey: project.activeFormatKey ?? project.selectedFormats[0],
  }
}

export function resetProjectFormatDocument(project: Project, formatKey: FormatKey, now = new Date()): Project {
  const scene = buildSceneForFormatDocument(project, formatKey)
  const timestamp = now.toISOString()
  return {
    ...project,
    formatDocuments: {
      ...(project.formatDocuments ?? {}),
      [formatKey]: {
        formatKey,
        format: applyLayoutDensity(
          getFormat(formatKey, project.customFormats),
          project.formatDensities?.[formatKey] ?? project.layoutDensity,
        ),
        scene,
        objects: sceneToObjects(scene, getFormat(formatKey, project.customFormats)),
        isEdited: false,
        createdFromGeneration: true,
        createdAt: project.formatDocuments?.[formatKey]?.createdAt ?? timestamp,
        updatedAt: timestamp,
      },
    },
  }
}

function buildSceneForFormatDocument(project: Project, formatKey: FormatKey): Scene {
  const focal = project.imageFocals?.[formatKey]
  const master = sceneWithAssetsForFormat(project, formatKey)
  const masterForFormat: Scene = focal && master.image
    ? { ...master, image: { ...master.image, focalX: focal.x, focalY: focal.y } }
    : master
  return buildScene(masterForFormat, formatKey, project.brandKit, project.enabled, {
    ...(project.formatOverrides?.[formatKey] ? { override: project.formatOverrides[formatKey] } : {}),
    assetHint: project.assetHint,
    blockOverrides: project.blockOverrides?.[formatKey],
    locale: project.activeLocale,
    customFormats: project.customFormats,
    density: project.formatDensities?.[formatKey] ?? project.layoutDensity,
    typographySettings: project.typographySettings,
    compositionSettings: project.compositionSettings,
  })
}

function sceneWithAssetsForFormat(project: Project, formatKey: FormatKey): Scene {
  const imageSrc = getActiveImageSrc(project, formatKey)
  const imageFit = getActiveImageFitMode(project, formatKey)
  return {
    ...project.master,
    image: project.master.image ? { ...project.master.image, src: imageSrc, fit: imageFit } : project.master.image,
    logo: project.master.logo ? { ...project.master.logo, src: project.logoSrc } : project.master.logo,
  }
}

function blockHeight(kind: BlockKind, source: Record<string, unknown>, format?: Pick<FormatRuleSet, 'aspectRatio'>): number {
  if (typeof source.h === 'number') return source.h
  if (kind === 'image') return 50
  if (kind === 'logo') return 6
  const fontSize = typeof source.fontSize === 'number' ? source.fontSize : 4
  const lineHeight = typeof source.lineHeight === 'number' ? source.lineHeight : 1.2
  const maxLines = typeof source.maxLines === 'number' ? source.maxLines : 1
  const aspectRatio = format?.aspectRatio ?? 1
  return fontSize * lineHeight * maxLines * aspectRatio
}

function objectName(kind: BlockKind): string {
  switch (kind) {
    case 'title':
      return 'Заголовок'
    case 'subtitle':
      return 'Подзаголовок'
    case 'cta':
      return 'Кнопка'
    case 'badge':
      return 'Бейдж'
    case 'logo':
      return 'Логотип'
    case 'image':
      return 'Изображение'
  }
}

function backgroundFill(scene: Scene): string | undefined {
  const bg = scene.background
  if (bg.kind === 'solid') return bg.color
  if (bg.kind === 'tonal') return bg.base
  if (bg.kind === 'split') return bg.a
  return bg.stops[0]
}

function isBackground(value: unknown): value is Scene['background'] {
  if (!value || typeof value !== 'object') return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'gradient' || kind === 'solid' || kind === 'tonal' || kind === 'split'
}

function uniqueId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
