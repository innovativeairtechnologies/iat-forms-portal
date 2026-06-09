'use client'

interface Option { value: string; label: string }

export default function FilterSelect({
  name,
  current,
  options,
}: {
  name: string
  current?: string
  options: Option[]
}) {
  return (
    <select
      name={name}
      defaultValue={current || ''}
      onChange={(e) => {
        const url = new URL(window.location.href)
        if (e.target.value) url.searchParams.set(name, e.target.value)
        else url.searchParams.delete(name)
        url.searchParams.delete('page')
        window.location.href = url.toString()
      }}
      className="border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-[13px] text-gray-700 dark:text-gray-300 outline-none focus:border-indigo-400 bg-white dark:bg-zinc-800 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
