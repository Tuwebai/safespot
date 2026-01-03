
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import { MentionList } from './MentionList'
import { usersApi } from '@/lib/api'

export default {
    items: async ({ query }: { query: string }) => {
        // Only search if query has at least 2 characters to save API calls
        if (query.length < 2) return []

        try {
            const response = await usersApi.search(query)
            return response.filter(u => u.alias).map(u => ({
                ...u,
                id: u.anonymous_id,
                label: u.alias
            }))
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
}
