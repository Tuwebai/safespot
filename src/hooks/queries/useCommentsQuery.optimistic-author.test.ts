import { describe, expect, it } from 'vitest'
import { resolveOptimisticIsAuthor } from './useCommentsQuery'

describe('resolveOptimisticIsAuthor', () => {
    it('devuelve false cuando el actor no es owner del reporte', () => {
        const report = {
            author: { id: 'owner-a' }
        }

        expect(resolveOptimisticIsAuthor(report, 'actor-b')).toBe(false)
    })

    it('devuelve true cuando el actor coincide con author.id', () => {
        const report = {
            author: { id: 'owner-a' }
        }

        expect(resolveOptimisticIsAuthor(report, 'owner-a')).toBe(true)
    })

    it('soporta fallback legacy anonymous_id', () => {
        const report = {
            anonymous_id: 'owner-legacy'
        }

        expect(resolveOptimisticIsAuthor(report, 'owner-legacy')).toBe(true)
    })
})

