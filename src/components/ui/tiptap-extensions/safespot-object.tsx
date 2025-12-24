import { Node, mergeAttributes } from '@tiptap/core'
import { Type } from 'lucide-react'

export interface ObjectOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    safespotObject: {
      setObject: (options: { value: string }) => ReturnType
    }
  }
}

export const Object = Node.create<ObjectOptions>({
  name: 'safespotObject',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      value: {
        default: null,
        parseHTML: element => element.getAttribute('data-value'),
        renderHTML: attributes => {
          if (!attributes.value) {
            return {}
          }
          return {
            'data-value': attributes.value,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="safespot-object"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'safespot-object',
      class: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-green-500/20 text-green-400 border-green-500/30',
    }), [
      ['span', { class: 'safespot-object-icon' }, '📦'],
      ['span', { class: 'safespot-object-value' }, HTMLAttributes.value || ''],
    ]]
  },

  addNodeView() {
    return ({ node }) => {
      const value = node.attrs.value || ''
      const dom = document.createElement('span')
      dom.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-green-500/20 text-green-400 border-green-500/30'
      dom.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>${value}`
      return {
        dom,
      }
    }
  },

  addCommands() {
    return {
      setObject: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})

