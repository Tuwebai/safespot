import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { getOverlayZIndex } from '@/config/z-index'
import { useScrollLock } from '@/hooks/useScrollLock'

interface VisualDatePickerProps {
  value: string // ISO string
  onChange: (value: string) => void
  error?: string
}

export function VisualDatePicker({ value, onChange, error }: VisualDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(value ? new Date(value) : new Date())
  const [selectedTime, setSelectedTime] = useState({
    hours: selectedDate.getHours().toString().padStart(2, '0'),
    minutes: selectedDate.getMinutes().toString().padStart(2, '0')
  })
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth()))
  
  // 🏛️ ENTERPRISE: Bloquear scroll cuando está abierto
  useScrollLock(isOpen);
  
  const zIndexes = getOverlayZIndex('modal');

  const formatDisplayValue = (isoString: string) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    newDate.setHours(parseInt(selectedTime.hours), parseInt(selectedTime.minutes))
    setSelectedDate(newDate)
  }

  const handleConfirm = () => {
    const finalDate = new Date(selectedDate)
    finalDate.setHours(parseInt(selectedTime.hours), parseInt(selectedTime.minutes))
    onChange(finalDate.toISOString())
    setIsOpen(false)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  return (
    <div className="space-y-2">
      <Input
        type="text"
        readOnly
        value={formatDisplayValue(value)}
        onClick={() => setIsOpen(true)}
        placeholder="Selecciona fecha y hora"
        className={`cursor-pointer ${error ? 'border-destructive' : ''}`}
      />

      {isOpen && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            style={{ zIndex: zIndexes.backdrop }}
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: zIndexes.content }}
          >
            {/* 
                pointer-events-auto added to the modal content so clicks inside work,
                while the container lets clicks pass through (though backdrop catches them usually).
                The backdrop handles the outside click.
            */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-6 relative overflow-hidden pointer-events-auto">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              <h3 className="text-xl font-bold text-white relative z-10">Seleccionar Fecha y Hora</h3>

              {/* Calendar */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h4 className="text-lg font-semibold text-foreground">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-sm font-medium text-foreground/70 p-2">
                      {day}
                    </div>
                  ))}

                  {/* Empty days */}
                  {emptyDays.map(day => (
                    <div key={`empty-${day}`} className="p-2" />
                  ))}

                  {/* Days */}
                  {days.map(day => {
                    const isSelected = selectedDate.getDate() === day &&
                      selectedDate.getMonth() === currentMonth.getMonth() &&
                      selectedDate.getFullYear() === currentMonth.getFullYear()
                    const isToday = day === new Date().getDate() &&
                      currentMonth.getMonth() === new Date().getMonth() &&
                      currentMonth.getFullYear() === new Date().getFullYear()

                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDateSelect(day)}
                        className={`
                          p-2 rounded-md transition-colors
                          ${isSelected
                            ? 'bg-neon-green text-dark-bg font-bold'
                            : isToday
                              ? 'bg-neon-green/20 text-neon-green'
                              : 'text-foreground hover:bg-neon-green/10'
                          }
                        `}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time Picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Hora
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={selectedTime.hours}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(23, parseInt(e.target.value) || 0))
                      setSelectedTime(prev => ({ ...prev, hours: val.toString().padStart(2, '0') }))
                    }}
                    className="w-20"
                  />
                  <span className="text-foreground">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={selectedTime.minutes}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                      setSelectedTime(prev => ({ ...prev, minutes: val.toString().padStart(2, '0') }))
                    }}
                    className="w-20"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="neon"
                  onClick={handleConfirm}
                  className="flex-1"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {error && (
        <div className="text-sm text-destructive mt-1">{error}</div>
      )}
    </div>
  )
}

