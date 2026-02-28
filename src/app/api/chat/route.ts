import { openai } from '@ai-sdk/openai'
import { generateText, tool, type ModelMessage } from 'ai'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const maxDuration = 30

const systemPrompt = `You are a collaborative art assistant for a children's drawing app.
You must be warm, concise, and concrete.
Ground your response in the actual image content when an image is provided.
Do not invent objects, colors, or details that are not clearly visible.
If uncertain, explicitly say what is uncertain.
When no user intent is clear, ask one clarifying question.
When user asks for critique, provide actionable and age-appropriate feedback.
When user asks what to do next, return concise step suggestions.
When user asks to draw or edit, use apply_canvas_commands with concrete drawing commands.
Never apply destructive changes without explicit user confirmation in chat.`

const drawPathCommandSchema = z.object({
  kind: z.literal('draw-path'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  strokeWidth: z.number().min(1).max(40),
  points: z.array(
    z.object({
      xPercent: z.number().min(0).max(100),
      yPercent: z.number().min(0).max(100),
    }),
  ).min(2),
})

const drawCircleCommandSchema = z.object({
  kind: z.literal('draw-circle'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  strokeWidth: z.number().min(1).max(40),
  centerXPercent: z.number().min(0).max(100),
  centerYPercent: z.number().min(0).max(100),
  radiusPercent: z.number().min(1).max(50),
})

const eraseRectCommandSchema = z.object({
  kind: z.literal('erase-rect'),
  xPercent: z.number().min(0).max(95),
  yPercent: z.number().min(0).max(95),
  widthPercent: z.number().min(5).max(100),
  heightPercent: z.number().min(5).max(100),
})

const canvasCommandSchema = z.discriminatedUnion('kind', [
  drawPathCommandSchema,
  drawCircleCommandSchema,
  eraseRectCommandSchema,
])

const drawIntentPattern =
  /\b(draw|add|edit|finish|continue|erase|remove|fix|update|change|improve|complete)\b/i

function getLastUserText(
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]

    if (message?.role === 'user') {
      return message.text.trim()
    }
  }

  return ''
}

function isDrawIntent(text: string): boolean {
  return drawIntentPattern.test(text)
}

function buildFallbackCanvasUpdate(text: string) {
  const commands: Array<
    | {
        kind: 'draw-path'
        color: string
        strokeWidth: number
        points: Array<{ xPercent: number; yPercent: number }>
      }
    | {
        kind: 'draw-circle'
        color: string
        strokeWidth: number
        centerXPercent: number
        centerYPercent: number
        radiusPercent: number
      }
  > = []

  if (/grass/i.test(text)) {
    commands.push({
      kind: 'draw-path',
      color: '#43A047',
      strokeWidth: 5,
      points: [
        { xPercent: 12, yPercent: 88 },
        { xPercent: 20, yPercent: 87 },
        { xPercent: 28, yPercent: 88 },
        { xPercent: 36, yPercent: 87 },
        { xPercent: 44, yPercent: 88 },
        { xPercent: 52, yPercent: 87.5 },
        { xPercent: 60, yPercent: 88 },
        { xPercent: 68, yPercent: 87.5 },
      ],
    })
  }

  if (/sun|sunshine/i.test(text)) {
    commands.push({
      kind: 'draw-circle',
      color: '#FBBF24',
      strokeWidth: 4,
      centerXPercent: 84,
      centerYPercent: 16,
      radiusPercent: 4,
    })
  }

  if (commands.length === 0) {
    commands.push({
      kind: 'draw-path',
      color: '#43A047',
      strokeWidth: 5,
      points: [
        { xPercent: 14, yPercent: 86 },
        { xPercent: 22, yPercent: 88 },
        { xPercent: 30, yPercent: 86.5 },
        { xPercent: 38, yPercent: 88 },
        { xPercent: 46, yPercent: 86.5 },
      ],
    })
  }

  return {
    requiresConfirmation: true,
    reason: 'fallback generated edit for a drawing request',
    confirmationPrompt:
      "I prepared a draft edit from your request. Review the preview and click Apply edit if you'd like it.",
    commands,
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    history: Array<{ role: 'user' | 'assistant'; text: string }>
    snapshotDataUrl?: string | null
  }
  const lastUserText = getLastUserText(body.history)

  const snapshotHint = body.snapshotDataUrl
    ? 'A current canvas snapshot is attached by the user.'
    : 'No current canvas snapshot was attached.'

  const lastUserMessageIndex = body.history.findLastIndex(
    message => message.role === 'user',
  )

  const messages: ModelMessage[] = body.history.map((message, index) => {
    if (
      message.role === 'user' &&
      index === lastUserMessageIndex &&
      body.snapshotDataUrl
    ) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: message.text },
          { type: 'image', image: body.snapshotDataUrl },
        ],
      }
    }

    return {
      role: message.role,
      content: message.text,
    }
  })

  const result = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? 'gpt-4.1'),
    system: `${systemPrompt}\n\n${snapshotHint}`,
    messages,
    tools: {
      request_clarification: tool({
        description:
          'Ask one concise clarifying question when user intent for feedback or edit is ambiguous.',
        inputSchema: z.object({
          question: z.string().min(4).max(220),
        }),
        execute: async ({ question }) => ({ question }),
      }),
      provide_art_feedback: tool({
        description:
          'Provide specific feedback on composition, color, storytelling, and one concrete improvement.',
        inputSchema: z.object({
          feedback: z.string().min(8).max(1000),
        }),
        execute: async ({ feedback }) => ({ feedback }),
      }),
      suggest_next_step: tool({
        description:
          'Return a short list of suggested next steps that the child can choose from.',
        inputSchema: z.object({
          suggestions: z.array(z.string().min(3).max(120)).min(1).max(4),
        }),
        execute: async ({ suggestions }) => ({ suggestions }),
      }),
      apply_canvas_commands: tool({
        description:
          'Return one or more concrete canvas commands to apply, such as draw-path, draw-circle, or erase-rect. Always include a brief confirmation prompt.',
        inputSchema: z.object({
          reason: z.string().min(4).max(220),
          confirmationPrompt: z.string().min(6).max(220),
          commands: z.array(canvasCommandSchema).min(1).max(20),
        }),
        execute: async ({ reason, confirmationPrompt, commands }) => ({
          requiresConfirmation: true,
          reason,
          confirmationPrompt,
          commands,
        }),
      }),
    },
  })

  const mappedToolResults = result.toolResults.map(toolResult => ({
    toolName: toolResult.toolName,
    output: toolResult.output,
  }))

  const applyCommandsResult = mappedToolResults.find(
    toolResult => toolResult.toolName === 'apply_canvas_commands',
  ) as
    | {
        toolName: 'apply_canvas_commands'
        output: {
          reason: string
          commands: unknown[]
        }
      }
    | undefined

  const clarificationResult = mappedToolResults.find(
    toolResult => toolResult.toolName === 'request_clarification',
  ) as
    | {
        toolName: 'request_clarification'
        output: { question: string }
      }
    | undefined

  const feedbackResult = mappedToolResults.find(
    toolResult => toolResult.toolName === 'provide_art_feedback',
  ) as
    | {
        toolName: 'provide_art_feedback'
        output: { feedback: string }
      }
    | undefined

  const suggestionsResult = mappedToolResults.find(
    toolResult => toolResult.toolName === 'suggest_next_step',
  ) as
    | {
        toolName: 'suggest_next_step'
        output: { suggestions: string[] }
      }
    | undefined

  const fallbackApplyCommandsResult =
    !applyCommandsResult && isDrawIntent(lastUserText)
      ? {
          toolName: 'apply_canvas_commands' as const,
          output: buildFallbackCanvasUpdate(lastUserText),
        }
      : undefined

  const effectiveApplyCommandsResult =
    applyCommandsResult ?? fallbackApplyCommandsResult

  const responseToolResults = fallbackApplyCommandsResult
    ? [...mappedToolResults, fallbackApplyCommandsResult]
    : mappedToolResults

  const fallbackText = effectiveApplyCommandsResult
    ? `I prepared a canvas update: ${effectiveApplyCommandsResult.output.reason}. Review and click Apply edit if you'd like this change.`
    : feedbackResult?.output.feedback ||
      (suggestionsResult?.output.suggestions.length
        ? `Here are a few next ideas: ${suggestionsResult.output.suggestions.join(', ')}`
        : undefined) ||
      clarificationResult?.output.question ||
      "I couldn't generate a complete response text, but I'm ready to help with a clearer drawing request."

  const responseText = result.text.trim().length > 0 ? result.text : fallbackText

  return NextResponse.json({
    text: responseText,
    toolResults: responseToolResults,
  })
}
