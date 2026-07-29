// Time Off self-service. The view now lives in a shared component so the admin
// shell can render the same thing at /admin/me/time-off (employees are merged
// into the admin surface — no /admin link points into /employee anymore).
export { default } from '@/components/self-service/TimeOffRequests'
