import type { ReactNode } from 'react'
import styles from './main.module.css'

export const Main = ({ children }: { children: ReactNode }) => {
  return <main className={styles.main}>{children}</main>
}
