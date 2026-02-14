import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { truncateAddress } from '@/lib/utils';
import {
  LayoutDashboard,
  Vote,
  ClipboardCheck,
  Award,
  Shield,
  LogOut,
  Menu,
  X,
  GraduationCap,
  UserCog,
} from 'lucide-react';
import { useState } from 'react';

const studentLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/polls', icon: Vote, label: 'Polls' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/certificates', icon: Award, label: 'Certificates' },
];

const facultyLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/polls', icon: Vote, label: 'Polls' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/certificates', icon: Award, label: 'Certificates' },
];

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/polls', icon: Vote, label: 'Polls' },
  { to: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
  { to: '/certificates', icon: Award, label: 'Certificates' },
  { to: '/admin', icon: Shield, label: 'Admin Panel' },
];

export default function DashboardLayout() {
  const { address, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links =
    role === 'admin' ? adminLinks : role === 'faculty' ? facultyLinks : studentLinks;

  const isAdmin = role === 'admin' || role === 'faculty';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar - Dark Theme */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-gray-800 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
            <span className="font-bold text-lg">A</span>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">AlgoCampus</span>
        </div>

        {/* User info */}
        <div className="px-4 py-6 border-b border-gray-800">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-900/50 border border-gray-800">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${isAdmin
                  ? 'bg-amber-500/20 text-amber-500'
                  : 'bg-indigo-500/20 text-indigo-400'
                }`}
            >
              {isAdmin ? (
                <UserCog className="w-5 h-5" />
              ) : (
                <GraduationCap className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-200 capitalize">{role || 'Student'}</p>
              <p className="text-xs text-gray-500 truncate font-mono">
                {address ? truncateAddress(address, 6) : 'No wallet'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${isActive
                  ? 'bg-white text-black shadow-sm' /* Active state: White bg, Black text */
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <link.icon className={`w-5 h-5 transition-colors ${
                // Use a trick to check active state if needed, or rely on parent class
                // Since we can't easily access isActive here without render prop spread, 
                // we rely on the parent CSS class or just let it inherit specific colors if needed.
                // Actually the NavLink render prop handles the parent class, so icons inherit 'text-current' usually.
                ""
                }`} strokeWidth={2} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="px-4 py-6 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/10 transition-colors"
          >
            <LogOut className="w-5 h-5" strokeWidth={2} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content - Light Theme */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-surface">

        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <span className="font-bold text-xs">A</span>
            </div>
            <span className="font-bold text-gray-900">AlgoCampus</span>
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 flex overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
