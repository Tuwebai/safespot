
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { MentionList } from './MentionList'
import { usersApi } from '@/lib/api'

export interface MentionParticipant {
    anonymous_id: string
    alias: string
    avatar_url?: string
}

export const getSuggestionConfig = (priorityUsers: MentionParticipant[] = []) => ({
    items: async ({ query }: { query: string }) => {
        // If query is very short, only show priority users that match
        if (query.length < 1) {
            return priorityUsers.map(u => ({
                ...u,
                id: u.anonymous_id,
                label: u.alias
            }))
        }

        try {
            const response = await usersApi.search(query)
            const mapped = response.filter(u => u.alias).map(u => ({
                ...u,
                id: u.anonymous_id,
                label: u.alias
            }))

            // Prioritize users who are already in the conversation
            const priorityIds = new Set(priorityUsers.map(u => u.anonymous_id))

            return mapped.sort((a, b) => {
                const aIsPriority = priorityIds.has(a.id)
                const bIsPriority = priorityIds.has(b.id)
                if (aIsPriority && !bIsPriority) return -1
                if (!aIsPriority && bIsPriority) return 1
                return 0
            })
        } catch (error) {
            console.error('Mention search error:', error)
            return []
        }
    },

    render: () => {
        let component: ReactRenderer<any> | null = null
        let popup: any | null = null

        return {
            onStart: (props: any) => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                })

                if (!props.clientRect) {
                    return
                }

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                })
            },

            onUpdate(props: any) {
                component?.updateProps(props)

                if (!props.clientRect) {
                    return
                }

                if (popup?.[0]?.state?.isDestroyed) {
                    return
                }

                popup?.[0].setProps({
                    getReferenceClientRect: props.clientRect,
                })
            },

            onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                    popup?.[0].hide()
                    return true
                }

                return component?.ref?.onKeyDown(props)
            },

            onExit() {
                popup?.[0].destroy()
                component?.destroy()
            },
        }
    },
})

// Default export uses empty priority users
export default getSuggestionConfig([])
