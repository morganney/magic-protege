'use client'

import Image from 'next/image'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CommandApiStateV1,
  CommandBatchResultV1,
  MagicCrayonCommandV1,
} from 'magic-crayon/command-api'
import styles from './page.module.css'

type MagicCrayonElement = HTMLElement & {
  setDrawingData: (data: Blob | string) => Promise<void>
  getDrawingData: (serialization?: 'blob' | 'dataurl') => Promise<Blob | string>
  applyCommands: (commands: MagicCrayonCommandV1[]) => CommandBatchResultV1
  getCommandState: () => CommandApiStateV1
}

type ColorPickerMode = 'crayon' | 'swatch' | 'input'
type CanvasBackgroundMode = 'white' | 'black'
type SelectedCrayonMode = 'full' | 'clipped'

type UpdateCanvasOutput = {
  requiresConfirmation: boolean
  confirmationPrompt: string
  commands: CanvasCommand[]
  reason: string
}

type CanvasCommand = Extract<
  MagicCrayonCommandV1,
  { kind: 'draw-path' | 'draw-circle' | 'erase-rect' }
>

type ToolResult =
  | { toolName: 'suggest_next_step'; output: { suggestions: string[] } }
  | { toolName: 'provide_art_feedback'; output: { feedback: string } }
  | { toolName: 'request_clarification'; output: { question: string } }
  | { toolName: 'apply_canvas_commands'; output: UpdateCanvasOutput }

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  snapshot?: string | null
  toolResults?: ToolResult[]
}

type ChatResponse = {
  text: string
  toolResults: ToolResult[]
}

async function getCurrentSnapshot(
  pad: MagicCrayonElement | null,
): Promise<string | null> {
  if (!pad) {
    return null
  }

  const data = await pad.getDrawingData('dataurl')
  return typeof data === 'string' ? data : null
}

function hasCanvasContent(
  snapshot: string | null,
  initialSnapshot: string | null,
): boolean {
  if (!snapshot) {
    return false
  }

  if (!initialSnapshot) {
    return snapshot.length > 100
  }

  return snapshot !== initialSnapshot
}

function extractSuggestions(messages: ChatMessage[]): string[] {
  const suggestions: string[] = []

  for (const message of messages) {
    for (const toolResult of message.toolResults ?? []) {
      if (
        toolResult.toolName === 'suggest_next_step' &&
        toolResult.output.suggestions.length > 0
      ) {
        suggestions.push(...toolResult.output.suggestions)
      }
    }
  }

  return Array.from(new Set(suggestions)).slice(-4)
}

export default function Home() {
  const hostRef = useRef<HTMLDivElement>(null)
  const previewHostRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const crayonRef = useRef<MagicCrayonElement | null>(null)
  const colorPickerModeRef = useRef<ColorPickerMode>('crayon')
  const canvasBackgroundModeRef = useRef<CanvasBackgroundMode>('white')
  const selectedCrayonModeRef = useRef<SelectedCrayonMode>('full')
  const previewRunIdRef = useRef(0)
  const lastPreviewedAssistantMessageIdRef = useRef<string | null>(null)
  const initialSnapshotRef = useRef<string | null>(null)
  const [colorPickerMode, setColorPickerMode] = useState<ColorPickerMode>('crayon')
  const [canvasBackgroundMode, setCanvasBackgroundMode] =
    useState<CanvasBackgroundMode>('white')
  const [selectedCrayonMode, setSelectedCrayonMode] = useState<SelectedCrayonMode>('full')
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'ready' | 'submitting'>('ready')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [errorText, setErrorText] = useState<string | null>(null)
  const [pendingCanvasCommand, setPendingCanvasCommand] =
    useState<UpdateCanvasOutput | null>(null)
  const [previewBeforeSnapshot, setPreviewBeforeSnapshot] = useState<string | null>(null)
  const [previewAfterSnapshot, setPreviewAfterSnapshot] = useState<string | null>(null)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [isApplyingCanvasChange, setIsApplyingCanvasChange] = useState(false)

  const aiEditing = status !== 'ready' || isApplyingCanvasChange || isGeneratingPreview
  const suggestions = useMemo(() => extractSuggestions(messages), [messages])
  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]

      if (message?.role === 'assistant') {
        return message.id
      }
    }

    return null
  }, [messages])

  const clearPendingCanvasChange = () => {
    previewRunIdRef.current += 1
    setPendingCanvasCommand(null)
    setPreviewBeforeSnapshot(null)
    setPreviewAfterSnapshot(null)
    setIsGeneratingPreview(false)
  }

  colorPickerModeRef.current = colorPickerMode
  canvasBackgroundModeRef.current = canvasBackgroundMode
  selectedCrayonModeRef.current = selectedCrayonMode

  useEffect(() => {
    let disposed = false

    void import('magic-crayon/defined')
      .then(() => {
        if (disposed || !hostRef.current) {
          return
        }

        const pad = document.createElement('magic-crayon') as MagicCrayonElement

        pad.setAttribute('serialization', 'dataurl')
        pad.setAttribute('boundary', 'on')
        pad.setAttribute('anchor', 'center')
        pad.setAttribute('width-controls', 'on')
        pad.setAttribute('color-picker', colorPickerModeRef.current)
        pad.setAttribute('canvas-background', canvasBackgroundModeRef.current)
        pad.setAttribute('selected-crayon', selectedCrayonModeRef.current)
        pad.style.width = '100%'
        pad.style.height = '100%'
        hostRef.current.replaceChildren(pad)
        crayonRef.current = pad

        void getCurrentSnapshot(pad).then(next => {
          if (!disposed) {
            initialSnapshotRef.current = next
          }
        })
      })
      .catch(() => {
        if (hostRef.current) {
          hostRef.current.textContent = 'Failed to load drawing canvas.'
        }
      })

    return () => {
      disposed = true
      crayonRef.current = null
    }
  }, [])

  useEffect(() => {
    const pad = crayonRef.current

    if (!pad) {
      return
    }

    pad.setAttribute('color-picker', colorPickerMode)
  }, [colorPickerMode])

  useEffect(() => {
    const pad = crayonRef.current

    if (!pad) {
      return
    }

    pad.setAttribute('canvas-background', canvasBackgroundMode)
  }, [canvasBackgroundMode])

  useEffect(() => {
    const pad = crayonRef.current

    if (!pad) {
      return
    }

    pad.setAttribute('selected-crayon', selectedCrayonMode)
  }, [selectedCrayonMode])

  useEffect(() => {
    const container = messagesRef.current

    if (!container) {
      return
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  const applyCanvasCommands = async (
    commandOutput: UpdateCanvasOutput,
    targetPad: MagicCrayonElement | null = crayonRef.current,
  ) => {
    if (!targetPad) {
      return
    }

    const batch = targetPad.applyCommands(commandOutput.commands)

    const rejectedResults = batch.results.filter(result => result.status === 'rejected')

    if (rejectedResults.length > 0) {
      throw new Error('One or more canvas commands were rejected.')
    }
  }

  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    const previewHostNode = previewHostRef.current

    if (!latestMessage || latestMessage.role !== 'assistant') {
      return
    }

    const commandResult = latestMessage.toolResults?.find(
      toolResult =>
        toolResult.toolName === 'apply_canvas_commands' &&
        toolResult.output.requiresConfirmation,
    )

    if (!commandResult || commandResult.toolName !== 'apply_canvas_commands') {
      return
    }

    if (latestMessage.id === lastPreviewedAssistantMessageIdRef.current) {
      return
    }

    lastPreviewedAssistantMessageIdRef.current = latestMessage.id

    const previewRunId = previewRunIdRef.current + 1
    previewRunIdRef.current = previewRunId

    const waitForCanvasApi = async (pad: MagicCrayonElement): Promise<boolean> => {
      const maxAttempts = 20

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          pad.getCommandState()

          return true
        } catch {
          // Wait for the element to finish connecting and initialize command APIs.
        }

        await new Promise<void>(resolve => {
          requestAnimationFrame(() => resolve())
        })
      }

      return false
    }

    const createPreviewPad = async (): Promise<MagicCrayonElement | null> => {
      const sourcePad = crayonRef.current

      if (!previewHostNode || !sourcePad) {
        return null
      }

      const rect = sourcePad.getBoundingClientRect()
      const previewPad = document.createElement('magic-crayon') as MagicCrayonElement
      const colorPicker = sourcePad.getAttribute('color-picker')
      const canvasBackground = sourcePad.getAttribute('canvas-background')
      const selectedCrayon = sourcePad.getAttribute('selected-crayon')

      previewPad.setAttribute('serialization', 'dataurl')
      previewPad.setAttribute('boundary', 'on')
      previewPad.setAttribute('anchor', 'center')
      previewPad.setAttribute('width-controls', 'on')

      if (colorPicker) {
        previewPad.setAttribute('color-picker', colorPicker)
      }

      if (canvasBackground) {
        previewPad.setAttribute('canvas-background', canvasBackground)
      }

      if (selectedCrayon) {
        previewPad.setAttribute('selected-crayon', selectedCrayon)
      }

      previewPad.style.width = `${Math.max(1, Math.round(rect.width))}px`
      previewPad.style.height = `${Math.max(1, Math.round(rect.height))}px`

      previewHostNode.replaceChildren(previewPad)
      const hasContext = await waitForCanvasApi(previewPad)

      if (!hasContext) {
        previewHostNode.replaceChildren()
        return null
      }

      return previewPad
    }

    const buildPreview = async () => {
      const commandOutput = commandResult.output

      setPendingCanvasCommand(commandOutput)
      setPreviewBeforeSnapshot(null)
      setPreviewAfterSnapshot(null)
      setIsGeneratingPreview(true)

      try {
        const livePad = crayonRef.current
        const beforeSnapshot = await getCurrentSnapshot(livePad)

        if (previewRunIdRef.current !== previewRunId) {
          return
        }

        setPreviewBeforeSnapshot(beforeSnapshot)

        if (!beforeSnapshot) {
          return
        }

        const previewPad = await createPreviewPad()

        if (!previewPad || previewRunIdRef.current !== previewRunId) {
          return
        }

        try {
          await previewPad.setDrawingData(beforeSnapshot)
          await applyCanvasCommands(commandOutput, previewPad)
          const afterSnapshot = await getCurrentSnapshot(previewPad)

          if (previewRunIdRef.current === previewRunId) {
            setPreviewAfterSnapshot(afterSnapshot)
          }
        } finally {
          previewHostNode?.replaceChildren()
        }
      } catch {
        if (previewRunIdRef.current === previewRunId) {
          setErrorText(
            'Could not generate a preview for this edit. You can still apply it directly.',
          )
        }
      } finally {
        if (previewRunIdRef.current === previewRunId) {
          setIsGeneratingPreview(false)
        }
      }
    }

    void buildPreview()

    return () => {
      previewRunIdRef.current += 1
      previewHostNode?.replaceChildren()
    }
  }, [messages, canvasBackgroundMode, colorPickerMode, selectedCrayonMode])

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault()

    const text = input.trim()

    if (!text || status !== 'ready') {
      return
    }

    clearPendingCanvasChange()
    setErrorText(null)
    const currentSnapshot = await getCurrentSnapshot(crayonRef.current)
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      snapshot: currentSnapshot,
    }

    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setStatus('submitting')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: nextMessages.map(message => ({
            role: message.role,
            text: message.text,
          })),
          snapshotDataUrl: currentSnapshot,
        }),
      })

      if (!response.ok) {
        throw new Error('AI request failed.')
      }

      const payload = (await response.json()) as ChatResponse
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: payload.text,
        toolResults: payload.toolResults,
      }

      setMessages(current => [...current, assistantMessage])
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unknown error.')
    } finally {
      setStatus('ready')
    }

    setInput('')
  }

  const confirmCanvasChange = async () => {
    if (!pendingCanvasCommand) {
      return
    }

    setErrorText(null)
    setIsApplyingCanvasChange(true)

    try {
      await applyCanvasCommands(pendingCanvasCommand)
      clearPendingCanvasChange()
    } finally {
      setIsApplyingCanvasChange(false)
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.layout}>
        <section className={styles.canvasPane} aria-label="Drawing canvas">
          <header className={styles.sectionHeader}>
            <h1>Magic Protégé</h1>
            <p>Sketch first, then ask for feedback or optional AI edits.</p>
          </header>
          <div className={styles.canvasControls}>
            <label className={styles.controlField}>
              Color picker
              <select
                value={colorPickerMode}
                onChange={event =>
                  setColorPickerMode(event.target.value as ColorPickerMode)
                }
              >
                <option value="crayon">Crayon</option>
                <option value="swatch">Swatch</option>
                <option value="input">Input</option>
              </select>
            </label>
            <label className={styles.controlField}>
              Canvas background
              <select
                value={canvasBackgroundMode}
                onChange={event =>
                  setCanvasBackgroundMode(event.target.value as CanvasBackgroundMode)
                }
              >
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </label>
            <label className={styles.controlField}>
              Selected crayon
              <select
                value={selectedCrayonMode}
                onChange={event =>
                  setSelectedCrayonMode(event.target.value as SelectedCrayonMode)
                }
              >
                <option value="full">Full</option>
                <option value="clipped">Clipped</option>
              </select>
            </label>
          </div>
          <div className={styles.canvasFrame}>
            <div ref={hostRef} className={styles.canvasHost} />
            {aiEditing ? (
              <div className={styles.canvasLock}>AI editing in progress…</div>
            ) : null}
          </div>
        </section>

        <section className={styles.chatPane} aria-label="AI chat">
          <header className={styles.sectionHeader}>
            <h2>Canvas Chat</h2>
            <p>{status === 'ready' ? 'Ready' : 'Working…'}</p>
          </header>

          <div ref={messagesRef} className={styles.messages}>
            {messages.length === 0 ? (
              <p className={styles.emptyState}>
                Ask for composition tips, color feedback, or a targeted canvas edit.
              </p>
            ) : null}

            {messages.map(message => (
              <article
                key={message.id}
                className={styles.message}
                data-role={message.role}
                data-highlight={
                  message.role === 'assistant' && message.id === latestAssistantMessageId
                    ? 'on'
                    : 'off'
                }
              >
                <strong>{message.role === 'assistant' ? 'AI' : 'You'}</strong>
                <p>
                  {message.text.trim().length > 0
                    ? message.text
                    : 'I prepared a response, but it was empty. Please try rephrasing your request.'}
                </p>
                {message.role === 'user' &&
                message.snapshot &&
                hasCanvasContent(message.snapshot, initialSnapshotRef.current) ? (
                  <Image
                    src={message.snapshot}
                    alt="Canvas snapshot"
                    className={styles.snapshot}
                    width={320}
                    height={180}
                    unoptimized
                  />
                ) : null}
                {(message.toolResults ?? []).map((toolResult, index) => {
                  if (toolResult.toolName === 'provide_art_feedback') {
                    return (
                      <p
                        key={`${message.id}-feedback-${index}`}
                        className={styles.toolCard}
                      >
                        {toolResult.output.feedback}
                      </p>
                    )
                  }

                  if (toolResult.toolName === 'request_clarification') {
                    return (
                      <div
                        key={`${message.id}-clarification-${index}`}
                        className={styles.clarificationCard}
                      >
                        <strong>AI needs your input</strong>
                        <p>{toolResult.output.question}</p>
                      </div>
                    )
                  }

                  if (toolResult.toolName === 'apply_canvas_commands') {
                    return (
                      <p
                        key={`${message.id}-canvas-${index}`}
                        className={styles.toolCard}
                      >
                        Suggested edit: {toolResult.output.reason}
                      </p>
                    )
                  }

                  return null
                })}
              </article>
            ))}
          </div>

          {errorText ? <p className={styles.error}>{errorText}</p> : null}

          {suggestions.length > 0 ? (
            <div className={styles.suggestions}>
              {suggestions.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form className={styles.composer} onSubmit={submitMessage}>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="Ask for feedback or request a specific improvement..."
              rows={3}
              disabled={status !== 'ready'}
            />
            <button type="submit" disabled={status !== 'ready' || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      </main>
      {pendingCanvasCommand ? (
        <aside className={styles.floatingConfirmation} aria-live="polite">
          <div className={styles.confirmation}>
            <p>{pendingCanvasCommand.confirmationPrompt}</p>
            {isGeneratingPreview ? (
              <p className={styles.previewHint}>Generating preview…</p>
            ) : null}
            {previewBeforeSnapshot && previewAfterSnapshot ? (
              <div className={styles.previewGrid}>
                <figure className={styles.previewPanel}>
                  <figcaption>Before</figcaption>
                  <Image
                    src={previewBeforeSnapshot}
                    alt="Current drawing before AI edit"
                    className={styles.preview}
                    width={320}
                    height={180}
                    unoptimized
                  />
                </figure>
                <figure className={styles.previewPanel}>
                  <figcaption>After</figcaption>
                  <Image
                    src={previewAfterSnapshot}
                    alt="Preview of AI edit"
                    className={styles.preview}
                    width={320}
                    height={180}
                    unoptimized
                  />
                </figure>
              </div>
            ) : null}
            {!isGeneratingPreview && !previewAfterSnapshot ? (
              <p className={styles.previewHint}>
                Preview unavailable for this edit. You can still apply it.
              </p>
            ) : null}
            <div className={styles.confirmationActions}>
              <button
                type="button"
                onClick={confirmCanvasChange}
                disabled={isApplyingCanvasChange || isGeneratingPreview}
              >
                Apply edit
              </button>
              <button
                type="button"
                onClick={clearPendingCanvasChange}
                disabled={isApplyingCanvasChange || isGeneratingPreview}
              >
                Skip
              </button>
            </div>
          </div>
        </aside>
      ) : null}
      <div ref={previewHostRef} className={styles.previewHost} aria-hidden="true" />
    </div>
  )
}
