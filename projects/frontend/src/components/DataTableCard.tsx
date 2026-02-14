import type { ReactNode } from 'react'

import { Card } from './Card'

interface DataTableCardProps {
  title: string
  right?: ReactNode
  headers: string[]
  rows: ReactNode[][]
  emptyText?: string
}

export const DataTableCard = ({
  title,
  right,
  headers,
  rows,
  emptyText = 'No records available.',
}: DataTableCardProps) => (
  <Card title={title} right={right}>
    {rows.length === 0 ? (
      <p>{emptyText}</p>
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, index) => (
              <tr key={index}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </Card>
)
