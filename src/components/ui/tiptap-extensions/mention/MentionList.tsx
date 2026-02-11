
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { UserProfile } from '@/lib/api'
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'

interface MentionListProps {
    items: UserProfile[]
    command: (props: { id: string; label: string }) => void
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    const selectItem = (index: number) => {
        const item = props.items[index]
        if (item) {
            props.command({ id: item.anonymous_id, label: item.alias || 'Usuario' })
        }
    }

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
    }

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length)
    }

    const enterHandler = () => {
        selectItem(selectedIndex)
    }

    useEffect(() => {
        setSelectedIndex(0)
    }, [props.items])

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler()
                return true
            }

            if (event.key === 'ArrowDown') {
                downHandler()
                return true
            }

            if (event.key === 'Enter') {
                enterHandler()
                return true
            }

            return false
        },
    }))

    return (
        <div className="bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[200px] animate-in fade-in zoom-in-95 duration-100 flex flex-col p-1">
            {props.items.length ? (
                props.items.map((item, index) => (
                    <button
                        className={`flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md transition-colors ${index === selectedIndex ? 'bg-neon-green/10 text-neon-green' : 'text-foreground hover:bg-white/5'
                            }`}
                        key={index}
                        onClick={() => selectItem(index)}
                    >
                        <Avatar className="h-6 w-6 border border-white/10 shrink-0">
                            <AvatarImage src={item.avatar_url || getAvatarUrl(item.anonymous_id)} />
                            <AvatarFallback className="text-[9px]">{getAvatarFallback(item.anonymous_id)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate max-w-[150px]">@{item.alias}</span>
                    </button>
                ))
            ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">No hay resultados</div>
            )}
        </div>
    )
})

MentionList.displayName = 'MentionList'
