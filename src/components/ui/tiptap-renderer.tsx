import { MapPin, Type, AtSign } from 'lucide-react'
import { MarkdownRenderer } from './markdown-renderer'
import { TipTapDoc, TipTapNode, TipTapMark } from '@/types/tiptap'

interface TipTapRendererProps {
  content: string // JSON string del editor TipTap o markdown legacy
  className?: string
}

/**
 * Renderiza contenido de TipTap desde JSON
 * Este renderizador lee el formato JSON nativo de TipTap y renderiza cada nodo correctamente
 * También soporta contenido legacy en formato markdown
 */
export function TipTapRenderer({ content, className = '' }: TipTapRendererProps) {
  if (!content) return null

  let doc: TipTapDoc
  try {
    doc = typeof content === 'string' ? JSON.parse(content) : content

    // Verificar que sea un documento TipTap válido
    if (!doc || !doc.type || doc.type !== 'doc') {
      throw new Error('Not a valid TipTap document')
    }
  } catch (error) {
    // Si no es JSON válido o no es un documento TipTap, usar MarkdownRenderer (compatibilidad legacy)
    return <MarkdownRenderer content={content} className={className} />
  }

  if (!doc || !doc.content || !Array.isArray(doc.content)) {
    return null
  }

  const renderNode = (node: TipTapNode, index: number): JSX.Element | string | null => {
    if (!node || !node.type) return null

    switch (node.type) {
      case 'paragraph':
        return (
          <p key={index} className="mb-2 last:mb-0">
            {node.content ? node.content.map((child, i) => renderNode(child, i)) : null}
          </p>
        )

      case 'text': {
        let text: JSX.Element | string = node.text || ''
        const marks = node.marks || []

        // Aplicar marks (formato) - aplicar en orden para anidación correcta
        // Code debe aplicarse primero (más externo), luego los demás
        const codeMark = marks.find((m: TipTapMark) => m.type === 'code')
        const otherMarks = marks.filter((m: TipTapMark) => m.type !== 'code')

        // Aplicar code primero si existe
        if (codeMark) {
          text = (
            <code key={`code-${index}`} className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-sm font-mono text-neon-green">
              {text}
            </code>
          )
        }

        // Aplicar otros marks en orden
        otherMarks.forEach((mark: TipTapMark, markIndex: number) => {
          const key = `${mark.type}-${index}-${markIndex}`
          switch (mark.type) {
            case 'bold':
              text = <strong key={key} className="font-bold text-foreground">{text}</strong>
              break
            case 'italic':
              text = <em key={key} className="italic">{text}</em>
              break
            case 'underline':
              text = <u key={key}>{text}</u>
              break
            case 'strike':
              text = <s key={key}>{text}</s>
              break
          }
        })

        return text
      }

      case 'safespotLocation': {
        const locationValue = (node.attrs?.value as string) || ''
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30"
          >
            <MapPin className="w-3 h-3" />
            {locationValue}
          </span>
        )
      }

      case 'safespotObject': {
        const objectValue = (node.attrs?.value as string) || ''
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-green-500/20 text-green-400 border-green-500/30"
          >
            <Type className="w-3 h-3" />
            {objectValue}
          </span>
        )
      }

      case 'safespotUser': {
        const userValue = (node.attrs?.value as string) || ''
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30"
          >
            <AtSign className="w-3 h-3" />
            {userValue}
          </span>
        )
      }

      case 'bulletList':
        return (
          <ul key={index} className="list-disc list-inside mb-2 space-y-1 ml-4">
            {node.content ? node.content.map((child, i) => renderNode(child, i)) : null}
          </ul>
        )

      case 'orderedList':
        return (
          <ol key={index} className="list-decimal list-inside mb-2 space-y-1 ml-4">
            {node.content ? node.content.map((child, i) => renderNode(child, i)) : null}
          </ol>
        )

      case 'listItem':
        return (
          <li key={index} className="text-foreground/80">
            {node.content ? node.content.map((child, i) => renderNode(child, i)) : null}
          </li>
        )

      case 'blockquote':
        return (
          <blockquote key={index} className="border-l-4 border-neon-green/50 pl-4 py-2 my-2 bg-dark-bg/50 italic">
            {node.content ? node.content.map((child, i) => renderNode(child, i)) : null}
          </blockquote>
        )

      case 'hardBreak':
        return <br key={index} />

      default:
        // Para nodos desconocidos, intentar renderizar su contenido
        if (node.content && Array.isArray(node.content)) {
          return (
            <span key={index}>
              {node.content.map((child, i) => renderNode(child, i))}
            </span>
          )
        }
        return null
    }
  }

  return (
    <div className={`tiptap-renderer ${className}`}>
      {doc.content.map((node, index) => renderNode(node, index))}
    </div>
  )
}

