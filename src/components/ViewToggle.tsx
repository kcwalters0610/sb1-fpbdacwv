import React from 'react'
import { Grid, List } from 'lucide-react'
import { ViewType } from '../hooks/useViewPreference'

interface ViewToggleProps {
  viewType: ViewType
  onViewChange: (view: ViewType) => void
}

export default function ViewToggle({ viewType, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 shadow-sm">
      <button
        onClick={() => onViewChange('table')}
        className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'table'
            ? 'bg-white text-gray-900 shadow-sm transform scale-105'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <List className="w-4 h-4 mr-1.5" />
        Table
      </button>
      <button
        onClick={() => onViewChange('card')}
        className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'card'
            ? 'bg-white text-gray-900 shadow-sm transform scale-105'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <Grid className="w-4 h-4 mr-1.5" />
        Cards
      </button>
    </div>
  )
}