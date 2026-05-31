export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeOptionalText(value: string | undefined) {
  if (!value) {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : null
}
