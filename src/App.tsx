import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SignupContractor from './pages/SignupContractor'
import SignupOwner from './pages/SignupOwner'
import Feed from './pages/Feed'
import Jobs from './pages/Jobs'
import Network from './pages/Network'
import Bids from './pages/Bids'
import Profile from './pages/Profile'

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public routes (redirect to /feed if logged in) */}
          <Route path="/" element={
            <ProtectedRoute publicOnly>
              <Landing />
            </ProtectedRoute>
          } />
          <Route path="/login" element={
            <ProtectedRoute publicOnly>
              <Login />
            </ProtectedRoute>
          } />
          <Route path="/signup" element={
            <ProtectedRoute publicOnly>
              <Signup />
            </ProtectedRoute>
          } />
          <Route path="/signup/contractor" element={
            <ProtectedRoute publicOnly>
              <SignupContractor />
            </ProtectedRoute>
          } />
          <Route path="/signup/owner" element={
            <ProtectedRoute publicOnly>
              <SignupOwner />
            </ProtectedRoute>
          } />

          {/* Protected routes */}
          <Route path="/feed" element={
            <ProtectedRoute>
              <AppLayout><Feed /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/jobs" element={
            <ProtectedRoute>
              <AppLayout><Jobs /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/network" element={
            <ProtectedRoute>
              <AppLayout><Network /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/bids" element={
            <ProtectedRoute>
              <AppLayout><Bids /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <AppLayout><Profile /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile/:handle" element={
            <ProtectedRoute>
              <AppLayout><Profile /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout>
                <div className="container" style={{ padding: '40px 0', color: 'var(--color-text-muted)' }}>
                  Settings — coming soon
                </div>
              </AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/settings/credits" element={
            <ProtectedRoute>
              <AppLayout>
                <div className="container" style={{ padding: '40px 0', color: 'var(--color-text-muted)' }}>
                  Credits & Billing — coming soon
                </div>
              </AppLayout>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
