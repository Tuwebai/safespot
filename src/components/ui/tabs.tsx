import * as React from "react"
import { cn } from "@/lib/utils"

const Tabs = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value: string
        onValueChange: (value: string) => void
    }
>(({ className, value, onValueChange, ...props }, ref) => (
    <div
        ref={ref}
        data-state={value}
        className={cn("w-full", className)}
        {...props}
    />
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
            className
        )}
        {...props}
    />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
        value: string
    }
>(({ className, value, onClick, ...props }, ref) => {
    // Logic to find parent Tabs context would be better, but for this simple implementation:
    // We expect the parent to clone children or use Context. 
    // To avoid complex Context for this fix, we will just style it based on selected state passed down?
    // Actually, properly implementing Radix-like API requires Context.

    // Let's implement a Context.
    return (
        <TabsTriggerContextAdapter value={value} className={className} ref={ref} {...props} />
    )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        value: string
    }
>(({ className, value, ...props }, ref) => {
    return (
        <TabsContentContextAdapter value={value} className={className} ref={ref} {...props} />
    )
})
TabsContent.displayName = "TabsContent"


// Internal Context to glue it together
const TabsContext = React.createContext<{
    value: string;
    onValueChange: (v: string) => void;
} | null>(null);

function TabsRoot({ value, onValueChange, children, className, ...props }: any) {
    return (
        <TabsContext.Provider value={{ value, onValueChange }}>
            <div className={cn("w-full", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    )
}

function TabsTriggerContextAdapter({ value, className, onClick, ...props }: any) {
    const context = React.useContext(TabsContext);
    const isSelected = context?.value === value;

    return (
        <button
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? "active" : "inactive"}
            onClick={(e) => {
                context?.onValueChange(value);
                onClick?.(e);
            }}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                className
            )}
            {...props}
        />
    )
}

function TabsContentContextAdapter({ value, className, children, ...props }: any) {
    const context = React.useContext(TabsContext);
    if (context?.value !== value) return null;

    return (
        <div
            role="tabpanel"
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className
            )}
            {...props}
        >
            {children}
        </div>
    )
}

// Export the Context-aware versions as the main exports
export { TabsRoot as Tabs, TabsList, TabsTriggerContextAdapter as TabsTrigger, TabsContentContextAdapter as TabsContent }
