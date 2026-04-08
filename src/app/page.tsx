import { redirect } from 'next/navigation'

// Root page redirects based on auth/role via middleware.
// This is a fallback — middleware handles the redirect for authenticated users.
export default function Home() {
  redirect('/login')
}
