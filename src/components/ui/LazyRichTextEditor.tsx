import { Suspense } from 'react'
import { lazyRetry } from '@/lib/lazyRetry'
import { RichTextEditorSkeleton } from './skeletons'

// Lazy load the real editor with retry logic
const Editor = lazyRetry(() =>
    import('./rich-text-editor').then(m => ({ default: m.RichTextEditor })),
    'RichTextEditor'
)

import type { MentionParticipant } from '@/lib/tiptap/mention-suggestion'

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    placeholder?: string
    disabled?: boolean
    maxLength?: number
    hideHelp?: boolean
    showCancel?: boolean
    onCancel?: () => void
    hideSubmitButton?: boolean
    prioritizedUsers?: MentionParticipant[]
}

/**
 * Professional wrapper for RichTextEditor that implements code splitting.
 * It shows a skeleton while the Tiptap bundle (+15KB) is being downloaded.
 */
export function RichTextEditor(props: RichTextEditorProps) {
    return (
        <Suspense fallback={<RichTextEditorSkeleton />}>
            <Editor {...props} />
        </Suspense>
    )
}
