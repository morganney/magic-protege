import styles from './footer.module.css'

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      Powered by{' '}
      <a
        href="https://github.com/morganney/magic-crayon"
        target="_blank"
        rel="noopener noreferrer"
      >
        magic-crayon
      </a>
    </footer>
  )
}
