import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, onValueChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (onValueChange) {
                onValueChange(parseInt(e.target.value, 10));
            }
        };

        return (
            <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
                <input
                    type="range"
                    ref={ref}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-neon-green"
                    onChange={handleChange}
                    {...props}
                />
            </div>
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
