import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MapPin, Type, AtSign } from 'lucide-react'
import { ReactNode } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * Renderiza markdown con soporte para SafeSpot features
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Componente para SafeSpot tags
  const SafeSpotTag = ({ type, value }: { type: 'ubicacion' | 'objeto' | 'usuario', value: string }) => {
    const styles = {
      ubicacion: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      objeto: 'bg-green-500/20 text-green-400 border-green-500/30',
      usuario: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    }

    const icons = {
      ubicacion: MapPin,
      objeto: Type,
      usuario: AtSign
    }

    const Icon = icons[type]

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${styles[type]}`}>
        <Icon className="w-3 h-3" />
        {value}
      </span>
    )
  }

  // Procesar contenido: extraer SafeSpot tags y reemplazarlos con placeholders
  const processContent = (text: string): { processed: string, tags: Array<{ index: number, type: string, value: string }> } => {
    const tags: Array<{ index: number, type: string, value: string }> = []
    let processed = text
    let offset = 0

    // Procesar #ubicacion[value]
    processed = processed.replace(/#ubicacion\[([^\]]+)\]/g, (match, value, index) => {
      tags.push({ index: index + offset, type: 'ubicacion', value })
      offset += match.length - `SAFESPOT_${tags.length - 1}`.length
      return `SAFESPOT_${tags.length - 1}`
    })

    // Procesar #objeto[value]
    processed = processed.replace(/#objeto\[([^\]]+)\]/g, (match, value, index) => {
      tags.push({ index: index + offset, type: 'objeto', value })
      offset += match.length - `SAFESPOT_${tags.length - 1}`.length
      return `SAFESPOT_${tags.length - 1}`
    })

    // Procesar #usuario[value]
    processed = processed.replace(/#usuario\[([^\]]+)\]/g, (match, value, index) => {
      tags.push({ index: index + offset, type: 'usuario', value })
      offset += match.length - `SAFESPOT_${tags.length - 1}`.length
      return `SAFESPOT_${tags.length - 1}`
    })


    return { processed, tags }
  }

  const { processed, tags } = processContent(content)
  const tagMap = new Map(tags.map((tag, i) => [`SAFESPOT_${i}`, tag]))

  // Componente personalizado para párrafos que procesa SafeSpot tags
  const Paragraph = ({ children }: { children: ReactNode }) => {
    if (typeof children === 'string') {
      const parts: (string | JSX.Element)[] = []
      let lastIndex = 0
      const regex = /SAFESPOT_(\d+)/g
      let match

      while ((match = regex.exec(children)) !== null) {
        if (match.index > lastIndex) {
          parts.push(children.substring(lastIndex, match.index))
        }

        const tag = tagMap.get(match[0])
        if (tag) {
          parts.push(
            <SafeSpotTag
              key={match.index}
              type={tag.type as 'ubicacion' | 'objeto' | 'usuario'}
              value={tag.value}
            />
          )
        }

        lastIndex = regex.lastIndex
      }

      if (lastIndex < children.length) {
        parts.push(children.substring(lastIndex))
      }

      return <p className="mb-2 last:mb-0">{parts.length > 0 ? parts : children}</p>
    }

    return <p className="mb-2 last:mb-0">{children}</p>
  }

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <Paragraph>{children}</Paragraph>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ className: codeClassName, children }) => {
            const isInline = !codeClassName
            return isInline ? (
              <code className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-sm font-mono text-neon-green">
                {children}
              </code>
            ) : (
              <pre className="block p-3 bg-dark-bg border border-dark-border rounded text-sm font-mono overflow-x-auto">
                <code>{children}</code>
              </pre>
            )
          },
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 ml-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 ml-4">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/80">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-neon-green/50 pl-4 py-2 my-2 bg-dark-bg/50 italic">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <h1 className="text-2xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4 first:mt-0">{children}</h3>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
