import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function NativeSelect({ className, children, ...props }) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'border-input h-9 w-full appearance-none rounded-md border bg-transparent pl-3 pr-9 text-base shadow-xs outline-none md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
