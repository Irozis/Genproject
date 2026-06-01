import { useRef } from 'react'
import type { ProjectHistoryItem } from '../lib/types'

type Props = {
  onCreate: () => void
  onImportJson: (file: File) => void
  recentProjects: ProjectHistoryItem[]
  onOpenRecent: (id: string) => void
}

const STEPS = ['Изображение', 'Элементы', 'Тексты', 'Цвета', 'Форматы', 'Просмотр', 'Экспорт']

export function Onboarding({ onCreate, onImportJson, recentProjects, onOpenRecent }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const recent = recentProjects.slice(0, 4)

  return (
    <div className="onboarding" data-testid="app-start">
      <header className="onboarding__brand">
        <img className="app-logo app-logo--onboarding" src="/app-logo.png" alt="" aria-hidden="true" />
        <span>Ad Layout Generator</span>
      </header>

      <h1 className="onboarding__title">Создание рекламных материалов в несколько шагов</h1>
      <p className="onboarding__sub">
        Загрузите изображение, выберите элементы и форматы, а затем отредактируйте или экспортируйте результат.
      </p>

      <section className="onboarding__primary card">
        <div className="card__body">
          <div className="card__title">Новый проект</div>
          <div className="card__desc">
            Один понятный путь: изображение, элементы, тексты, цветовая схема, форматы и просмотр материалов.
          </div>
          <div className="onboarding__actions">
            <button className="btn btn-primary" type="button" onClick={onCreate} data-testid="create-project-button">
              Создать проект
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => fileRef.current?.click()}>
              Импортировать .json
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImportJson(f)
              e.target.value = ''
            }}
          />
          <div className="onboarding-preview" aria-hidden="true">
            <div className="onboarding-preview__item onboarding-preview__item--square">
              <div className="onboarding-preview__media" />
              <div className="onboarding-preview__copy">
                <span />
                <span />
              </div>
              <b>VK 1:1</b>
            </div>
            <div className="onboarding-preview__item onboarding-preview__item--story">
              <div className="onboarding-preview__media" />
              <div className="onboarding-preview__copy">
                <span />
                <span />
                <span />
              </div>
              <b>Stories</b>
            </div>
            <div className="onboarding-preview__item onboarding-preview__item--banner">
              <div className="onboarding-preview__copy">
                <span />
                <span />
              </div>
              <div className="onboarding-preview__media" />
              <b>Banner</b>
            </div>
          </div>
        </div>
      </section>

      <section className="onboarding-download card" aria-labelledby="windows-download-title">
        <div className="onboarding-download__copy">
          <h2 id="windows-download-title" className="onboarding-download__title">
            Скачать приложение для Windows
          </h2>
          <p className="onboarding-download__subtitle">
            Локальная версия работает без обязательного размещения сайта на сервере и открывает тот же редактор в отдельном приложении.
          </p>
          <p className="onboarding-download__note">
            Windows может показать предупреждение SmartScreen для неподписанного установщика.
          </p>
        </div>
        <div className="onboarding-download__actions">
          <button className="btn btn-ghost" type="button" disabled>
            Скачать EXE
          </button>
          <button className="btn btn-primary" type="button" onClick={onCreate} data-testid="create-project-button">
            Продолжить в браузере
          </button>
          <span className="onboarding-download__release-note">
            Файл установщика добавляется в релизную сборку.
          </span>
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="onboarding-recent card" aria-labelledby="recent-projects-title">
          <h2 id="recent-projects-title">Открыть недавний проект</h2>
          <div className="onboarding-recent__list">
            {recent.map((item) => (
              <button key={item.id} type="button" className="onboarding-recent__item" onClick={() => onOpenRecent(item.id)}>
                <span>{item.name || 'Новый проект'}</span>
                <small>{formatDate(item.updatedAt)}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <ol className="onboarding__steps" aria-label="Этапы работы">
        {STEPS.map((step, index) => (
          <li key={step} className={index === 0 ? 'is-current' : undefined} aria-current={index === 0 ? 'step' : undefined}>
            <span>{index + 1}</span> {step}
          </li>
        ))}
      </ol>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}
