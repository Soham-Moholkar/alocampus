import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'faculty' | 'student';

interface AuthState {
  token: string | null;
  address: string | null;
  role: Role | null;
  isAuthenticated: boolean;

  login: (token: string, address: string, role: Role) => void;
  logout: () => void;
  setRole: (role: Role) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      address: null,
      role: null,
      isAuthenticated: false,

      login: (token, address, role) =>
        set({ token, address, role, isAuthenticated: true }),

      logout: () =>
        set({ token: null, address: null, role: null, isAuthenticated: false }),

      setRole: (role) => set({ role }),
    }),
    {
      name: 'algocampus-auth',
      partialize: (state) => ({
        token: state.token,
        address: state.address,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
