import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google'
import { Users, UserPlus, Camera, LayoutDashboard, Settings, X, ArrowLeft, ShieldAlert, LogOut, FlaskConical } from 'lucide-react'
import Admin from './components/Admin'
import TestPage from './components/TestPage'
import Register from './components/Register'
import Attendance from './components/Attendance'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children, allowedRoles, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function AppContent() {
  const [authStatus, setAuthStatus] = useState({
    token: localStorage.getItem('adminToken') || null,
    user: JSON.parse(localStorage.getItem('adminUser')) || null
  });
  
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setAuthStatus({ token: null, user: null });
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 font-medium text-sm ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  const mobileMenuLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-base ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="bottom-center" toastOptions={{ 
        duration: 4000,
        style: {
          background: '#1e293b',
          color: '#fff',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        }
      }} />
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50 transition-all">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex flex-1 items-center gap-2">
              {location.pathname !== '/' && (
                <button 
                  onClick={() => navigate(-1)} 
                  className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 rounded-full transition-colors"
                  title="Go Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg shadow-sm">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 tracking-tight ml-1">Facely</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-1.5">
              <NavLink to="/" className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </NavLink>
              <NavLink to="/register" className={navLinkClass}>
                <UserPlus className="w-4 h-4" />
                Register
              </NavLink>
              <NavLink to="/attendance/kiosk" className={navLinkClass}>
                <Camera className="w-4 h-4" />
                Mark Attendance
              </NavLink>
            </nav>

            <div className="flex flex-1 items-center justify-end gap-2">
              {authStatus.user?.role === 'superadmin' && (
                <NavLink to="/admin" className="hidden md:flex p-3 text-slate-500 hover:bg-slate-100 rounded-full transition-colors items-center justify-center min-w-[48px] min-h-[48px]" title="Admin Panel">
                  <ShieldAlert className="w-5 h-5" />
                </NavLink>
              )}


              {/* Desktop Settings Dropdown */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-3 rounded-full transition-colors flex items-center justify-center min-w-[48px] min-h-[48px] ${
                    isSettingsOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {isSettingsOpen && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50">
                      <NavLink
                        to="/test"
                        onClick={() => setIsSettingsOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <FlaskConical className="w-4 h-4 text-indigo-500" />
                        Face Detection Test
                      </NavLink>
                      {authStatus.user && (
                        <button
                          onClick={() => { handleLogout(); setIsSettingsOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Log Out
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Remove old desktop logout button since it's now in dropdown */}

              {/* Mobile Menu Toggle (replaces Settings icon area) */}
              <button 
                className="md:hidden p-3 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center min-w-[48px] min-h-[48px]"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                title="Menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {/* Mobile Dropdown Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-xl px-4 py-4 flex flex-col gap-2 z-50">
              <NavLink to="/" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </NavLink>
              <NavLink to="/register" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <UserPlus className="w-5 h-5" />
                Register
              </NavLink>
              <NavLink to="/attendance/kiosk" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <Camera className="w-5 h-5" />
                Mark Attendance
              </NavLink>
              {authStatus.user?.role === 'superadmin' && (
                <NavLink to="/admin" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                  <ShieldAlert className="w-5 h-5" />
                  Admin Panel
                </NavLink>
              )}
              <NavLink to="/test" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <Settings className="w-5 h-5" />
                Dev Tools
              </NavLink>
              {authStatus.user && (
                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-base text-rose-500 hover:bg-rose-50 hover:text-rose-600`}>
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              )}
            </div>
          )}
        </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-8 relative">
        <Routes>
          <Route path="/login" element={
            authStatus.user && authStatus.user.role !== 'pending' 
              ? <Navigate to="/" replace /> 
              : <Login setAuthStatus={setAuthStatus} />
          } />
          
          <Route path="/" element={
            <ProtectedRoute user={authStatus.user} allowedRoles={['staff', 'superadmin']}>
              <Dashboard user={authStatus.user} />
            </ProtectedRoute>
          } />
          
          <Route path="/register" element={
            <ProtectedRoute user={authStatus.user} allowedRoles={['staff', 'superadmin']}>
              <Register user={authStatus.user} />
            </ProtectedRoute>
          } />
          
          <Route path="/attendance/kiosk" element={
            <ProtectedRoute user={authStatus.user} allowedRoles={['staff', 'superadmin']}>
              <Attendance user={authStatus.user} />
            </ProtectedRoute>
          } />
          
          <Route path="/admin" element={
            <ProtectedRoute user={authStatus.user} allowedRoles={['superadmin']}>
              <Admin user={authStatus.user} setAuthStatus={setAuthStatus} />
            </ProtectedRoute>
          } />
          
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID";
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Router>
        <AppContent />
      </Router>
    </GoogleOAuthProvider>
  )
}

export default App
