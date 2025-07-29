import { useState, useEffect } from 'react'

export type ViewType = 'table' | 'card'

export function useViewPreference(componentName: string) {
  const [viewType, setViewType] = useState<ViewType>(() => {
    const saved = localStorage.getItem(`viewPreference_${componentName}`)
    return (saved as ViewType) || 'table'
  })

  useEffect(() => {
    localStorage.setItem(`viewPreference_${componentName}`, viewType)
  }, [componentName, viewType])

  return { viewType, setViewType }
}