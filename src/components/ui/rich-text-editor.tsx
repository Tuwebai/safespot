import { useState, useEffect, useMemo, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Location } from './tiptap-extensions/safespot-location'
import { Object as SafeSpotObject } from './tiptap-extensions/safespot-object'
import { User as SafeSpotUser } from './tiptap-extensions/safespot-user'
import { Button } from './button'
import { Input } from './input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { normalizeTipTapContent } from '@/lib/tiptap-content'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Quote,
  Hash,
  Type,
  AtSign,
  List,
  ListOrdered,
  Eye
} from 'lucide-react'
import { TipTapRenderer } from './tiptap-renderer'

interface RichTextEditorProps {
  value: string // JSON string del editor TipTap
  onChange: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  hideHelp?: boolean // Si es true, oculta textos de ayuda y footer con shortcuts
  showCancel?: boolean // Si es true, muestra botón Cancelar
  onCancel?: () => void // Callback para cancelar
}

export function RichTextEditor({
  value,
  onChange,
  onSubmit,
  placeholder = "Escribe tu comentario aquí... Usa @ para mencionar usuarios y el toolbar para formatear",
  disabled = false,
  maxLength = 2000,
  hideHelp = false,
  showCancel = false,
  onCancel
}: RichTextEditorProps) {
  // Memoizar las extensiones para evitar recrearlas en cada render
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: false,
      underline: false, // Deshabilitar underline en StarterKit para evitar duplicación
      blockquote: {
        HTMLAttributes: {
          class: 'border-l-4 border-neon-green/50 pl-4 py-2 my-2 bg-dark-bg/50 italic',
        },
      },
    }),
    Underline,
    CharacterCount.configure({
      limit: maxLength,
    }),
    Placeholder.configure({
      placeholder,
    }),
    Location,
    SafeSpotObject,
    SafeSpotUser,
  ], [maxLength, placeholder])

  // Normalizar contenido inicial para soportar texto plano legacy
  // Solo se calcula una vez en la inicialización del editor (no depende de cambios de value)
  const normalizedInitialContent = useMemo(() => {
    if (!value) {
      // Return empty TipTap document structure (empty paragraph, no text node)
      return {
        type: 'doc',
        content: [
          {
            type: 'paragraph'
          }
        ]
      }
    }
    return normalizeTipTapContent(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo se calcula en la inicialización, cambios posteriores se manejan en useEffect

  const editor = useEditor({
    extensions,
    content: normalizedInitialContent,
    onUpdate: ({ editor }) => {
      // Guardar como JSON (formato nativo de TipTap)
      // Siempre guardar en formato JSON estructurado (normaliza contenido legacy)
      const json = editor.getJSON()
      const jsonString = JSON.stringify(json)
      onChange(jsonString)
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor min-h-[200px] p-3 bg-dark-bg border border-dark-border rounded-lg text-foreground/80 focus:outline-none focus:ring-2 focus:ring-neon-green/50',
      },
    },
    editable: !disabled,
  })

  // Sincronizar value externo con editor
  useEffect(() => {
    if (editor && value !== undefined) {
      // Normalizar contenido para soportar texto plano legacy
      const normalized = normalizeTipTapContent(value)
      const currentJson = editor.getJSON()

      // Solo actualizar si es diferente para evitar loops infinitos
      if (JSON.stringify(currentJson) !== JSON.stringify(normalized)) {
        editor.commands.setContent(normalized)
      }
    }
  }, [value, editor])

  // Estado para el modal de entrada de texto
  const [showPreview, setShowPreview] = useState(false)
  const [isInputModalOpen, setIsInputModalOpen] = useState(false)
  const [inputModalText, setInputModalText] = useState('')
  const [inputModalLabel, setInputModalLabel] = useState('')
  const [pendingTagType, setPendingTagType] = useState<'ubicacion' | 'objeto' | 'usuario' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus en el input cuando se abre el modal
  useEffect(() => {
    if (isInputModalOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isInputModalOpen])

  // Función para abrir modal de entrada de texto
  const openInputModal = (type: 'ubicacion' | 'objeto' | 'usuario', label: string) => {
    setPendingTagType(type)
    setInputModalLabel(label)
    setInputModalText('')
    setIsInputModalOpen(true)
  }

  // Función para confirmar entrada del modal
  const handleInputModalConfirm = () => {
    if (!editor || !pendingTagType || !inputModalText.trim()) {
      setIsInputModalOpen(false)
      setPendingTagType(null)
      setInputModalText('')
      return
    }

    const text = inputModalText.trim()

    switch (pendingTagType) {
      case 'ubicacion':
        editor.chain().focus().setLocation({ value: text }).run()
        break
      case 'objeto':
        editor.chain().focus().setObject({ value: text }).run()
        break
      case 'usuario':
        editor.chain().focus().setUser({ value: text }).run()
        break
    }

    setIsInputModalOpen(false)
    setPendingTagType(null)
    setInputModalText('')
  }

  // Función para cancelar modal
  const handleInputModalCancel = () => {
    setIsInputModalOpen(false)
    setPendingTagType(null)
    setInputModalText('')
  }

  // Manejar Enter en el input del modal
  const handleInputModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleInputModalConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleInputModalCancel()
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 p-2 bg-dark-bg rounded-lg border border-dark-border">
        {/* Basic Formatting */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Negrita (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Cursiva (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Subrayado (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Tachado"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('code') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Código (Ctrl+`)"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Cita"
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        {/* SafeSpot Features */}
        <div className="flex items-center gap-1 border-l border-dark-border pl-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openInputModal('ubicacion', 'Ingresa la ubicación:')}
            className="h-8 w-8 p-0"
            title="Ubicación"
          >
            <Hash className="h-4 w-4 text-blue-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openInputModal('objeto', 'Ingresa el objeto:')}
            className="h-8 w-8 p-0"
            title="Objeto"
          >
            <Type className="h-4 w-4 text-green-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => openInputModal('usuario', 'Ingresa el usuario:')}
            className="h-8 w-8 p-0"
            title="Usuario"
          >
            <AtSign className="h-4 w-4 text-purple-400" />
          </Button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-l border-dark-border pl-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Lista con viñetas"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview Toggle */}
        <div className="flex items-center gap-1 border-l border-dark-border pl-2 ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className={`h-8 w-8 p-0 ${showPreview ? 'bg-neon-green/20 text-neon-green' : ''}`}
            title="Vista previa"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Input Area */}
      {showPreview ? (
        <div className="min-h-[200px] p-4 bg-dark-bg border border-dark-border rounded-lg overflow-auto">
          <TipTapRenderer content={value} className="text-sm text-foreground/80" />
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Feedback Hint - Improved UX */}
        <div>
          {onSubmit && !disabled && !editor.getText().trim() && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Escribe algo para poder enviar
            </span>
          )}
        </div>

        {/* Character Counter and Buttons */}
        <div className="flex items-center gap-3">
          {!hideHelp && (
            <span className="text-xs text-muted-foreground">
              {editor.storage.characterCount?.characters() || editor.getText().length}/{maxLength}
            </span>
          )}
          {showCancel && onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={disabled}
            >
              Cancelar
            </Button>
          )}
          {onSubmit && (
            <Button
              type="button"
              onClick={() => onSubmit?.()}
              disabled={disabled || !editor.getText().trim()}
              className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
            >
              {disabled ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </div>
      </div>



      {/* Modal de Entrada de Texto para SafeSpot Tags */}
      {isInputModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={handleInputModalCancel}
        >
          <Card
            className="w-full max-w-md bg-dark-card border-dark-border"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle>{inputModalLabel}</CardTitle>
              <CardDescription>
                Ingresa el valor para el tag de SafeSpot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  ref={inputRef}
                  type="text"
                  value={inputModalText}
                  onChange={(e) => setInputModalText(e.target.value)}
                  onKeyDown={handleInputModalKeyDown}
                  placeholder="Escribe aquí..."
                  className="w-full"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleInputModalCancel}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="neon"
                    onClick={handleInputModalConfirm}
                    disabled={!inputModalText.trim()}
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
