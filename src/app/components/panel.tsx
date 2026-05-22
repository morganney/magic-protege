import type { ReactNode } from 'react'
import styles from './panel.module.css'

type PanelProps = {
  children: ReactNode
  title?: string
  subtitle?: string
}
export const Panel = ({ children, title, subtitle }: PanelProps) => {
  const Tag = title ? 'section' : 'div'

  return (
    <Tag className={styles.panel}>
      {title && (
        <header>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </Tag>
  )
}
