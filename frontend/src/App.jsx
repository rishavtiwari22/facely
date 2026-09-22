import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Users, UserPlus, Camera, LayoutDashboard, Settings, X, ArrowLeft } from 'lucide-react'
import Home from './components/Home'
import TestPage from './components/TestPage'
import Register from './components/Register'
import Attendance from './components/Attendance'
import Dashboard from './components/Dashboard'

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
            <div className="flex items-center gap-2">
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
                <Users className="w-4 h-4" />
                Students
              </NavLink>
              <NavLink to="/register" className={navLinkClass}>
                <UserPlus className="w-4 h-4" />
                Register
              </NavLink>
              <NavLink to="/attendance/kiosk" className={navLinkClass}>
                <Camera className="w-4 h-4" />
                Live Camera
              </NavLink>
              <NavLink to="/dashboard" className={navLinkClass}>
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </NavLink>
            </nav>

            <div className="flex items-center gap-2 ml-auto">
              {/* Desktop Settings */}
              <NavLink to="/test" className="hidden md:flex p-3 -mr-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors items-center justify-center min-w-[48px] min-h-[48px]" title="Dev Tools">
                <Settings className="w-5 h-5" />
              </NavLink>

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
                <Users className="w-5 h-5" />
                Students
              </NavLink>
              <NavLink to="/register" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <UserPlus className="w-5 h-5" />
                Register
              </NavLink>
              <NavLink to="/attendance/kiosk" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <Camera className="w-5 h-5" />
                Live Camera
              </NavLink>
              <NavLink to="/dashboard" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <LayoutDashboard className="w-5 h-5" />
                Dashboard
              </NavLink>
              <NavLink to="/test" className={mobileMenuLinkClass} onClick={() => setIsMobileMenuOpen(false)}>
                <Settings className="w-5 h-5" />
                Dev Tools
              </NavLink>
            </div>
          )}
        </header>
      
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-8 relative">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/attendance/kiosk" element={<Attendance />} />
          {/* Keep old route active just in case */}
          <Route path="/attendance" element={<Attendance />} /> 
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
