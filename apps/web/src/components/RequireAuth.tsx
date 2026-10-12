import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/client'

export default function RequireAuth() {
  const { user, setUser } = useAuthStore()
  const location = useLocation()

  useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => { setUser(r.user); return r }),
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  })

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
