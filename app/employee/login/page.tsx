import { redirect } from 'next/navigation'

export default function EmployeeLoginRedirect({ searchParams }: { searchParams: { redirect?: string } }) {
  const dest = searchParams.redirect
    ? `/login?redirect=${encodeURIComponent(searchParams.redirect)}`
    : '/login'
  redirect(dest)
}
