// Self-service Time Off, in the admin shell. Open to every admin-surface role
// via OPEN_ADMIN_PREFIXES ('/admin/me') — this is a personal self-service page,
// not the HR approval queue (that lives at /admin/requests, perm-gated).
export { default } from '@/components/self-service/TimeOffRequests'
