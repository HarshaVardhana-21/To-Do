import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster
          position="top-right"
          containerStyle={{ top: 72 }} // just below the 64px sticky header, so the menu stays clickable
          toastOptions={{
            duration: 3000, // every toast (success and error alike) stays for 3 seconds
            className: '!bg-white !text-slate-900 dark:!bg-slate-800 dark:!text-slate-100 !font-sans !text-sm !font-medium !shadow-lg',
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
