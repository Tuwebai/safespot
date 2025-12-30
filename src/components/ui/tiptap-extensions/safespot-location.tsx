import { Node, mergeAttributes } from '@tiptap/core'

export interface LocationOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    safespotLocation: {
      /**
       * Insert a location node
       */
      setLocation: (options: { value: string }) => ReturnType
    }
  }
}

export const Location = Node.create<LocationOptions>({
  name: 'safespotLocation',

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
        tag: 'span[data-type="safespot-location"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'safespot-location',
      class: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30',
    }),
      ['span', { class: 'safespot-location-icon' }, '📍'],
      ['span', { class: 'safespot-location-value' }, HTMLAttributes.value || ''],
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const value = node.attrs.value || ''
      const dom = document.createElement('span')
      dom.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30'
      dom.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>${value}`
      return {
        dom,
      }
    }
  },

  addCommands() {
    return {
      setLocation: options => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})

