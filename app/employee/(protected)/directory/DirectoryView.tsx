// The employee directory now uses the shared OrgDirectory (Chart/List toggle), which
// is also used editable at /admin/org-chart. This re-export keeps the employee route's
// `import DirectoryView from './DirectoryView'` stable; OrgDirectory defaults to
// canEdit=false + title="Directory", so the employee behavior is unchanged.
export { default } from '@/components/org-chart/OrgDirectory'
