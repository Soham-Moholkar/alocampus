import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useSnackbar } from 'notistack'

import { useAuth } from '../context/AuthContext'
import { apiRequest } from '../lib/api'
import { getConfig } from '../lib/config'
import { endpoints } from '../lib/endpoints'
import type { AvatarUploadResponse, UserProfileResponse } from '../types/api'

interface EditableAvatarProps {
  fallbackSrc: string
  alt: string
  className?: string
  editable?: boolean
}

const toAbsoluteUrl = (path?: string): string | null => {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = getConfig().bffBaseUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export const EditableAvatar = ({
  fallbackSrc,
  alt,
  className,
  editable = true,
}: EditableAvatarProps) => {
  const { isAuthenticated } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadProfile = async (): Promise<void> => {
    if (!isAuthenticated) {
      setProfile(null)
      return
    }
    try {
      const data = await apiRequest<UserProfileResponse>(endpoints.profileMe)
      setProfile(data)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [isAuthenticated])

  const onClick = (): void => {
    if (!editable || !isAuthenticated || uploading) {
      return
    }
    inputRef.current?.click()
  }

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    const body = new FormData()
    body.append('file', file)

    setUploading(true)
    try {
      const result = await apiRequest<AvatarUploadResponse>(endpoints.profileAvatar, {
        method: 'POST',
        body,
      })
      setProfile(result.profile)
      enqueueSnackbar('Profile image updated', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Avatar upload failed', { variant: 'error' })
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const src = toAbsoluteUrl(profile?.avatar_url) ?? fallbackSrc

  return (
    <>
      <button
        type="button"
        className={`avatar-button ${editable && isAuthenticated ? 'editable' : ''}`}
        onClick={onClick}
        title={editable && isAuthenticated ? 'Click to change profile image' : alt}
      >
        <img src={src} alt={alt} className={className} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={(event) => void onFileChange(event)}
      />
    </>
  )
}
