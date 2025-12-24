import { useState, useEffect, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import Placeholder from '@tiptap/extension-placeholder'
import { Location } from './tiptap-extensions/safespot-location'
import { Object as SafeSpotObject } from './tiptap-extensions/safespot-object'
import { User as SafeSpotUser } from './tiptap-extensions/safespot-user'
import { Button } from './button'
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
  AlertTriangle,
  Lock,
  List,
  ListOrdered,
  Image as ImageIcon,
  Paperclip,
  Eye,
  Mic
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

  const editor = useEditor({
    extensions,
    content: value ? (typeof value === 'string' ? JSON.parse(value) : value) : '',
    onUpdate: ({ editor }) => {
      // Guardar como JSON (formato nativo de TipTap)
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
    if (editor && value) {
      try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value
        const currentJson = editor.getJSON()
        
        // Solo actualizar si es diferente para evitar loops
        if (JSON.stringify(currentJson) !== JSON.stringify(parsed)) {
          editor.commands.setContent(parsed)
        }
      } catch (error) {
        // Si no es JSON válido, intentar como markdown/HTML legacy
        if (value && !value.startsWith('{')) {
          editor.commands.setContent(value)
        }
      }
    }
  }, [value, editor])

  // Función para insertar SafeSpot tags usando nodos
  const insertSafeSpotTag = (type: 'ubicacion' | 'objeto' | 'usuario', promptText: string) => {
    if (!editor) return
    
    const text = prompt(promptText)
    if (!text) return
    
    switch (type) {
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
  }

  const [showPreview, setShowPreview] = useState(false)

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
            onClick={() => insertSafeSpotTag('ubicacion', 'Ingresa la ubicación:')}
            className="h-8 w-8 p-0"
            title="Ubicación"
          >
            <Hash className="h-4 w-4 text-blue-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertSafeSpotTag('objeto', 'Ingresa el objeto:')}
            className="h-8 w-8 p-0"
            title="Objeto"
          >
            <Type className="h-4 w-4 text-green-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertSafeSpotTag('usuario', 'Ingresa el usuario:')}
            className="h-8 w-8 p-0"
            title="Usuario"
          >
            <AtSign className="h-4 w-4 text-purple-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!editor) return
              const selectedText = editor.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to
              )
              const spoilerText = selectedText || 'spoiler'
              editor.chain().focus().insertContent(`||${spoilerText}||`).run()
            }}
            className="h-8 w-8 p-0"
            title="Spoiler"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (!editor) return
              editor.chain().focus().insertContent('||SENSIBLE: ||').run()
            }}
            className="h-8 w-8 p-0"
            title="Información Sensible"
          >
            <Lock className="h-4 w-4 text-red-400" />
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

        {/* Media */}
        <div className="flex items-center gap-1 border-l border-dark-border pl-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Insertar imagen"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Adjuntar archivo"
          >
            <Paperclip className="h-4 w-4" />
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
        {/* Left: Shortcuts (solo si no está oculto) */}
        {!hideHelp && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>@</span>
            <Paperclip className="h-3 w-3" />
            <ImageIcon className="h-3 w-3" />
            <Mic className="h-3 w-3" />
          </div>
        )}

        {/* Right: Character Counter and Submit */}
        <div className="flex items-center gap-3 ml-auto">
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
              onClick={onSubmit}
              disabled={disabled || !editor.getText().trim()}
              className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
            >
              {disabled ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </div>
      </div>

      {/* Help Text (solo si no está oculto) */}
      {!hideHelp && (
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-dark-border">
          <div>
            <strong>Atajos:</strong> Ctrl+B (negrita), Ctrl+I (cursiva), Ctrl+U (subrayado), Ctrl+` (código)
          </div>
          <div>
            <strong>SafeSpot:</strong> Usa los botones especiales para insertar ubicaciones, objetos, usuarios, spoilers e información sensible
          </div>
          <div>
            <strong>Formato:</strong> El contenido se guarda en formato JSON estructurado para máxima consistencia
          </div>
        </div>
      )}
    </div>
  )
}
