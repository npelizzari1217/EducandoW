import type { ReactNode } from 'react';
import './table.css';

interface Column<T> { key: string; header: string; render?: (item: T) => ReactNode; }
interface Props<T> { columns: Column<T>[]; data: T[]; onRowClick?: (item: T) => void; emptyMessage?: string; }

export function Table<T extends Record<string, unknown>>({ columns, data, onRowClick, emptyMessage = 'No hay datos' }: Props<T>) {
  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="table-empty">{emptyMessage}</td></tr>
          ) : data.map((item, i) => (
            <tr key={(item.id as string) ?? i} onClick={() => onRowClick?.(item)} className={onRowClick ? 'table-row-clickable' : ''}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(item) : String(item[c.key] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
