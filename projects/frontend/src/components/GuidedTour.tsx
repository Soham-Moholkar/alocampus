import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { setTourCompleted } from '../lib/storage'
import { getTourSteps } from '../lib/tour'
import type { Role } from '../types/api'

interface GuidedTourProps {
  role: Role
  open: boolean
  runKey: number
  onClose: () => void
}

export const GuidedTour = ({ role, open, runKey, onClose }: GuidedTourProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const steps = useMemo(() => getTourSteps(role), [role])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) {
      return
    }
    setIndex(0)
  }, [open, runKey, role])

  const current = steps[index]

  useEffect(() => {
    if (!open || !current) {
      return
    }
    if (location.pathname !== current.route) {
      navigate(current.route)
    }
  }, [current, location.pathname, navigate, open])

  useEffect(() => {
    if (!open || !current || location.pathname !== current.route) {
      return
    }

    const target = document.querySelector(current.selector) as HTMLElement | null
    if (!target) {
      return
    }

    target.classList.add('tour-highlight')
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

    return () => {
      target.classList.remove('tour-highlight')
    }
  }, [current, location.pathname, open])

  if (!open || !current) {
    return null
  }

  const finish = (): void => {
    setTourCompleted(role, true)
    onClose()
  }

  const skip = (): void => {
    setTourCompleted(role, true)
    onClose()
  }

  const next = (): void => {
    if (index >= steps.length - 1) {
      finish()
      return
    }
    setIndex((prev) => prev + 1)
  }

  const previous = (): void => {
    if (index === 0) {
      return
    }
    setIndex((prev) => prev - 1)
  }

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
      <section className="tour-card">
        <p className="tour-step">Step {index + 1} / {steps.length}</p>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="tour-actions">
          <button type="button" className="btn btn-ghost btn-compact" onClick={skip}>
            Skip
          </button>
          <button type="button" className="btn btn-ghost btn-compact" onClick={previous} disabled={index === 0}>
            Back
          </button>
          <button type="button" className="btn btn-primary btn-compact" onClick={next}>
            {index >= steps.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </section>
    </div>
  )
}
