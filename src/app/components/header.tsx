import styles from './header.module.css'

export const Header = () => {
  return (
    <header className={styles.header}>
      <h1 className={styles.heading}>Magic Protégé</h1>
      <p className={styles.subheading}>AI-assisted canvas drawing.</p>
    </header>
  )
}
