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
import JobDetail from './pages/JobDetail'
import PostJob from './pages/PostJob'
import Explore from './pages/Explore'
import Bids from './pages/Bids'
import BidDetail from './pages/BidDetail'
import BidSubmit from './pages/BidSubmit'
import PostRFQ from './pages/PostRFQ'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Messages from './pages/Messages'
import MessageThread from './pages/MessageThread'
import Notifications from './pages/Notifications'
import Credits from './pages/Credits'
import Settings from './pages/Settings'
import ResetPassword from './pages/ResetPassword'

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
          {/* IMPORTANT: /jobs/post before /jobs/:id */}
          <Route path="/jobs/post" element={
            <ProtectedRoute>
              <AppLayout><PostJob /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/jobs/:id" element={
            <ProtectedRoute>
              <AppLayout><JobDetail /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Explore (replaces Network) */}
          <Route path="/explore" element={
            <ProtectedRoute>
              <AppLayout><Explore /></AppLayout>
            </ProtectedRoute>
          } />
          {/* Keep /network as redirect for any existing links */}
          <Route path="/network" element={<Navigate to="/explore" replace />} />

          {/* Bids — IMPORTANT: specific paths before dynamic :id */}
          <Route path="/bids" element={
            <ProtectedRoute>
              <AppLayout><Bids /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/bids/post" element={
            <ProtectedRoute>
              <AppLayout><PostRFQ /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/bids/new" element={
            <ProtectedRoute>
              <AppLayout><PostRFQ /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/bids/:id" element={
            <ProtectedRoute>
              <AppLayout><BidDetail /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/bids/:id/submit" element={
            <ProtectedRoute>
              <AppLayout><BidSubmit /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute>
              <AppLayout><Profile /></AppLayout>
            </ProtectedRoute>
          } />
          {/* /profile/edit MUST be before /profile/:handle to avoid conflict */}
          <Route path="/profile/edit" element={
            <ProtectedRoute>
              <AppLayout><EditProfile /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile/:handle" element={
            <ProtectedRoute>
              <AppLayout><Profile /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Messages — IMPORTANT: /messages/:threadId before /messages */}
          <Route path="/messages/:threadId" element={
            <ProtectedRoute>
              <AppLayout><MessageThread /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute>
              <AppLayout><Messages /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Notifications */}
          <Route path="/notifications" element={
            <ProtectedRoute>
              <AppLayout><Notifications /></AppLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <AppLayout><Settings /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Password reset — public, linked from Supabase reset email */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* /settings/credits and /credits both go to Credits page */}
          <Route path="/settings/credits" element={<Navigate to="/credits" replace />} />
          <Route path="/credits" element={
            <ProtectedRoute>
              <AppLayout><Credits /></AppLayout>
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
