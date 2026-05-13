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
The only drawable command kinds available are draw-path, draw-line, draw-circle, draw-rect, draw-bezier, draw-ellipse, draw-polygon, draw-arc, fill-rect, fill-circle, fill-polygon, and erase-rect.
When asked what commands are available, list only those command kinds.
When asked to draw complex objects (for example, trees), decompose them into multiple primitive commands.
When no user intent is clear, ask one clarifying question.
When user asks for critique, provide actionable and age-appropriate feedback.
When user asks what to do next, return concise step suggestions.
When user asks to draw or edit, use apply_canvas_commands with concrete drawing commands.
Never apply destructive changes without explicit user confirmation in chat.`

const drawPathCommandSchema = z.object({
  kind: z.literal('draw-path'),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .min(2),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawLineCommandSchema = z.object({
  kind: z.literal('draw-line'),
  start: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  end: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawCircleCommandSchema = z.object({
  kind: z.literal('draw-circle'),
  center: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  radius: z.number().min(1).max(50),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawRectCommandSchema = z.object({
  kind: z.literal('draw-rect'),
  rect: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(1).max(100),
    height: z.number().min(1).max(100),
  }),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawBezierCommandSchema = z.object({
  kind: z.literal('draw-bezier'),
  start: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  control1: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  control2: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  end: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
  segments: z.number().int().min(8).max(128).optional(),
})

const drawEllipseCommandSchema = z.object({
  kind: z.literal('draw-ellipse'),
  center: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  radiusX: z.number().min(1).max(100),
  radiusY: z.number().min(1).max(100),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawPolygonCommandSchema = z.object({
  kind: z.literal('draw-polygon'),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .min(3),
  closed: z.boolean().optional(),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const drawArcCommandSchema = z.object({
  kind: z.literal('draw-arc'),
  center: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  radius: z.number().min(1).max(100),
  startAngleDegrees: z.number().min(-1440).max(1440),
  endAngleDegrees: z.number().min(-1440).max(1440),
  counterclockwise: z.boolean().optional(),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    lineCap: z.enum(['butt', 'round', 'square']).optional(),
    lineJoin: z.enum(['bevel', 'round', 'miter']).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
  segments: z.number().int().min(8).max(128).optional(),
})

const fillRectCommandSchema = z.object({
  kind: z.literal('fill-rect'),
  rect: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(1).max(100),
    height: z.number().min(1).max(100),
  }),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const fillCircleCommandSchema = z.object({
  kind: z.literal('fill-circle'),
  center: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  radius: z.number().min(1).max(100),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const fillPolygonCommandSchema = z.object({
  kind: z.literal('fill-polygon'),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .min(3),
  style: z.object({
    strokeWidth: z.number().min(1).max(40),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  }),
})

const eraseRectCommandSchema = z.object({
  kind: z.literal('erase-rect'),
  rect: z.object({
    x: z.number().min(0).max(95),
    y: z.number().min(0).max(95),
    width: z.number().min(5).max(100),
    height: z.number().min(5).max(100),
  }),
})

const canvasCommandSchema = z.discriminatedUnion('kind', [
  drawPathCommandSchema,
  drawLineCommandSchema,
  drawCircleCommandSchema,
  drawRectCommandSchema,
  drawBezierCommandSchema,
  drawEllipseCommandSchema,
  drawPolygonCommandSchema,
  drawArcCommandSchema,
  fillRectCommandSchema,
  fillCircleCommandSchema,
  fillPolygonCommandSchema,
  eraseRectCommandSchema,
])

const drawIntentPattern =
  /\b(draw|add|edit|finish|continue|erase|remove|fix|update|change|improve|complete|fill)\b/i

const colorPaintIntentPattern = /\b(color|paint)\b/i

const colorPaintEditContextPattern =
  /\b(can|interior|inside|drawing|canvas|background|sky|grass|sun|tree|trees|forest|line|shape|circle|rect|path|area)\b/i

const colorPaintEditRequestPattern =
  /\b(please|can you|could you|would you|let'?s|make|set|change|update|add|draw|fill|erase|remove|paint|color|turn)\b/i

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
  if (drawIntentPattern.test(text)) {
    return true
  }

  return (
    colorPaintIntentPattern.test(text) &&
    colorPaintEditContextPattern.test(text) &&
    colorPaintEditRequestPattern.test(text)
  )
}

type DrawPathCommand = {
  kind: 'draw-path'
  points: Array<{ x: number; y: number }>
  style: {
    strokeWidth: number
    color: string
  }
}

type DrawCircleCommand = {
  kind: 'draw-circle'
  center: { x: number; y: number }
  radius: number
  style: {
    strokeWidth: number
    color: string
  }
}

type FillRectCommand = {
  kind: 'fill-rect'
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  style: {
    strokeWidth: number
    color: string
  }
}

type FallbackCommand = DrawPathCommand | DrawCircleCommand | FillRectCommand

function pushTreeCommands(
  commands: FallbackCommand[],
  centerX: number,
  groundY: number,
  scale: number,
) {
  const trunkHeight = 14 * scale
  const canopyRadius = 4 * scale

  commands.push({
    kind: 'draw-path',
    style: {
      color: '#8D6E63',
      strokeWidth: Math.max(2, Math.round(3 * scale)),
    },
    points: [
      { x: centerX, y: groundY },
      { x: centerX, y: groundY - trunkHeight },
    ],
  })

  commands.push({
    kind: 'draw-circle',
    center: { x: centerX, y: groundY - trunkHeight - canopyRadius + 0.5 },
    radius: canopyRadius,
    style: {
      color: '#2E7D32',
      strokeWidth: Math.max(2, Math.round(2 * scale)),
    },
  })

  commands.push({
    kind: 'draw-circle',
    center: {
      x: centerX - canopyRadius + 0.5,
      y: groundY - trunkHeight - canopyRadius + 1.5,
    },
    radius: canopyRadius * 0.85,
    style: {
      color: '#388E3C',
      strokeWidth: Math.max(2, Math.round(2 * scale)),
    },
  })

  commands.push({
    kind: 'draw-circle',
    center: {
      x: centerX + canopyRadius - 0.5,
      y: groundY - trunkHeight - canopyRadius + 1.5,
    },
    radius: canopyRadius * 0.85,
    style: {
      color: '#388E3C',
      strokeWidth: Math.max(2, Math.round(2 * scale)),
    },
  })
}

function buildFallbackCanvasUpdate(text: string) {
  const hexColorMatch = text.match(/#[0-9a-fA-F]{6}/)
  const requestedColor = hexColorMatch ? hexColorMatch[0].toUpperCase() : '#6B3E26'
  const explicitFillRectRequest = /\bfill-rect\b/i.test(text)
  const canInteriorTargetPattern =
    /\b(can\s+interior|inside\s+(?:the\s+)?can|interior\s+of\s+(?:the\s+)?can)\b/i
  const canInteriorFillRequest =
    /\b(fill|paint|color)\b/i.test(text) && canInteriorTargetPattern.test(text)

  if (explicitFillRectRequest || canInteriorFillRequest) {
    return {
      requiresConfirmation: true,
      reason: 'fallback generated fill command for can interior',
      confirmationPrompt:
        "I prepared a fill for the can interior. Review the preview and click Apply edit if you'd like this change.",
      commands: [
        {
          kind: 'fill-rect' as const,
          // Interior bounds for the default can sketch used in this app.
          rect: {
            x: 41,
            y: 34,
            width: 18,
            height: 17,
          },
          style: {
            strokeWidth: 2,
            color: requestedColor,
          },
        },
      ],
    }
  }

  const commands: FallbackCommand[] = []

  if (/\b(tree|trees|forest|pine|oak)\b/i.test(text)) {
    const treeCenters = /\b(several|many|multiple|forest)\b/i.test(text)
      ? [24, 50, 76]
      : [50]

    for (const centerX of treeCenters) {
      pushTreeCommands(commands, centerX, 86, 1)
    }
  }

  if (/grass/i.test(text)) {
    commands.push({
      kind: 'draw-path',
      style: {
        color: '#43A047',
        strokeWidth: 5,
      },
      points: [
        { x: 12, y: 88 },
        { x: 20, y: 87 },
        { x: 28, y: 88 },
        { x: 36, y: 87 },
        { x: 44, y: 88 },
        { x: 52, y: 87.5 },
        { x: 60, y: 88 },
        { x: 68, y: 87.5 },
      ],
    })
  }

  if (/sun|sunshine/i.test(text)) {
    commands.push({
      kind: 'draw-circle',
      center: { x: 84, y: 16 },
      radius: 4,
      style: {
        color: '#FBBF24',
        strokeWidth: 4,
      },
    })
  }

  if (commands.length === 0) {
    commands.push({
      kind: 'draw-path',
      style: {
        color: '#43A047',
        strokeWidth: 5,
      },
      points: [
        { x: 14, y: 86 },
        { x: 22, y: 88 },
        { x: 30, y: 86.5 },
        { x: 38, y: 88 },
        { x: 46, y: 86.5 },
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
          'Return one or more concrete canvas commands to apply. Only use draw-path, draw-line, draw-circle, draw-rect, draw-bezier, draw-ellipse, draw-polygon, draw-arc, fill-rect, fill-circle, fill-polygon, and erase-rect. For complex objects, compose multiple primitive commands. Always include a brief confirmation prompt.',
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

  const effectiveApplyCommandsResult = applyCommandsResult ?? fallbackApplyCommandsResult

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
