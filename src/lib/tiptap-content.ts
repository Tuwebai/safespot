/**
 * TipTap Content Normalization Utilities
 * 
 * Helper functions to handle both structured JSON content and legacy plain text
 * in TipTap editor, ensuring backward compatibility without breaking existing comments.
 */

import type { JSONContent, Content } from '@tiptap/core'

/**
 * Validates if a string is valid JSON
 */
export function isValidJSON(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Checks if a parsed object is a valid TipTap document structure
 */
function isValidTipTapDocument(doc: unknown): doc is JSONContent {
  if (!doc || typeof doc !== 'object' || doc === null) {
    return false
  }

  const obj = doc as Record<string, unknown>

  // TipTap documents have type: "doc" and content array
  return (
    obj.type === 'doc' &&
    Array.isArray(obj.content)
  )
}

/**
 * Converts plain text to TipTap JSON structure
 * 
 * @param text - Plain text content
 * @returns TipTap JSON document structure
 */
function convertTextToTipTapJSON(text: string): JSONContent {
  const trimmedText = text.trim()

  // If text is empty, return empty paragraph (no text node - TipTap doesn't allow empty text nodes)
  if (!trimmedText) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph'
        }
      ]
    }
  }

  // If text has content, include text node
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: trimmedText
          }
        ]
      }
    ]
  }
}

/**
 * Recursively removes empty text nodes from TipTap content
 * TipTap doesn't allow empty text nodes, so we need to clean them up
 */
function cleanEmptyTextNodes(content: unknown): unknown {
  if (!content || typeof content !== 'object' || content === null) {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map(item => cleanEmptyTextNodes(item))
      .filter(item => {
        // Remove text nodes with empty text
        if (item && typeof item === 'object' && 'type' in item && item.type === 'text') {
          const textNode = item as { type: string; text?: string }
          return textNode.text !== undefined && textNode.text !== ''
        }
        return true
      })
  }

  const obj = content as Record<string, unknown>
  const cleaned: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'content' && Array.isArray(value)) {
      // Clean content array
      const cleanedContent = value
        .map(item => cleanEmptyTextNodes(item))
        .filter(item => {
          // Remove text nodes with empty text
          if (item && typeof item === 'object' && 'type' in item && item.type === 'text') {
            const textNode = item as { type: string; text?: string }
            return textNode.text !== undefined && textNode.text !== ''
          }
          return true
        })

      // If content array is empty after cleaning, don't include it (paragraph can be empty)
      if (cleanedContent.length > 0) {
        cleaned[key] = cleanedContent
      }
    } else {
      cleaned[key] = cleanEmptyTextNodes(value)
    }
  }

  return cleaned
}

/**
 * Normalizes content to TipTap JSON format
 * 
 * Handles:
 * - Valid TipTap JSON strings → returns parsed and cleaned object
 * - Plain text strings → converts to TipTap JSON structure
 * - Invalid JSON strings → converts plain text to TipTap JSON structure
 * - Already parsed objects → validates and returns if valid TipTap, otherwise converts
 * 
 * @param content - Content string (JSON or plain text) or object
 * @returns Normalized TipTap JSON document object (compatible with Content type)
 */
export function normalizeTipTapContent(
  content: string | unknown
): Content {
  // Handle empty/null content
  if (!content) {
    return convertTextToTipTapJSON('')
  }

  // If already an object, validate and return if valid, otherwise convert
  if (typeof content !== 'string') {
    if (isValidTipTapDocument(content)) {
      // Clean empty text nodes before returning
      return cleanEmptyTextNodes(content) as Content
    }
    // If it's an object but not valid TipTap, convert to string and process
    return convertTextToTipTapJSON(String(content))
  }

  // Handle string content
  const contentString = content.trim()

  // If empty string, return empty TipTap document
  if (!contentString) {
    return convertTextToTipTapJSON('')
  }

  // Try to parse as JSON
  if (isValidJSON(contentString)) {
    try {
      const parsed = JSON.parse(contentString)

      // Validate it's a TipTap document
      if (isValidTipTapDocument(parsed)) {
        // Clean empty text nodes before returning
        return cleanEmptyTextNodes(parsed) as Content
      }

      // If it's valid JSON but not TipTap structure, treat as plain text
      return convertTextToTipTapJSON(contentString)
    } catch {
      // Fallback to plain text conversion
      return convertTextToTipTapJSON(contentString)
    }
  }

  // Not valid JSON, treat as plain text
  return convertTextToTipTapJSON(contentString)
}
/**
 * Extracts plain text from a TipTap JSON structure or string
 * 
 * @param content - JSON string or TipTap object
 * @returns Plain text representation
 */
export function getPlainTextFromTipTap(content: string | unknown): string {
  if (!content) return ''

  // If it's a string, try to parse it as JSON
  if (typeof content === 'string') {
    const trimmed = content.trim()
    if (!trimmed) return ''

    if (isValidJSON(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed)
        return getPlainTextFromObject(parsed)
      } catch {
        return trimmed
      }
    }
    return trimmed
  }

  // If it's an object, process it
  return getPlainTextFromObject(content)
}

/**
 * Recursively extracts text from a TipTap object
 */
function getPlainTextFromObject(doc: unknown): string {
  if (!doc || typeof doc !== 'object' || doc === null) {
    return ''
  }

  const node = doc as Record<string, unknown>

  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text
  }

  if (Array.isArray(node.content)) {
    const text = node.content
      .map(child => getPlainTextFromObject(child))
      .join('')

    // Add newlines for block elements
    if (node.type === 'paragraph' || node.type === 'heading') {
      return text + '\n'
    }

    return text
  }

  return ''
}
