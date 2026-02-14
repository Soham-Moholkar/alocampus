import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import type { Role } from '../types/api'

interface RoleAccess {
  effectiveRole: Role | null
  chainRole: Role | null
  isAuthenticated: boolean
  roleMismatch: boolean
  canFacultyWrite: boolean
  canAdminWrite: boolean
}

export const useRoleAccess = (): RoleAccess => {
  const preview = usePreview()
  const { isAuthenticated, role: authRole } = useAuth()

  const effectiveRole: Role | null = preview.role ?? authRole
  const chainRole = isAuthenticated ? authRole : null
  const roleMismatch = Boolean(preview.role && authRole && preview.role !== authRole)

  return {
    effectiveRole,
    chainRole,
    isAuthenticated,
    roleMismatch,
    canFacultyWrite: Boolean(isAuthenticated && authRole && (authRole === 'faculty' || authRole === 'admin')),
    canAdminWrite: Boolean(isAuthenticated && authRole === 'admin'),
  }
}
