import { Node, mergeAttributes } from '@tiptap/core'

export interface UserOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    safespotUser: {
      setUser: (options: { value: string }) => ReturnType
    }
  }
}

export const User = Node.create<UserOptions>({
  name: 'safespotUser',

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
        tag: 'span[data-type="safespot-user"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'safespot-user',
      class: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30',
    }), [
        ['span', { class: 'safespot-user-icon' }, '@'],
        ['span', { class: 'safespot-user-value' }, HTMLAttributes.value || ''],
      ]]
  },

  addNodeView() {
    return ({ node }) => {
      const value = node.attrs.value || ''
      const dom = document.createElement('span')
      dom.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30'
      dom.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${value}`
      return {
        dom,
      }
    }
  },

  addCommands() {
    return {
      setUser: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})

