import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../../lib/utils"

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col",
        month: "flex flex-col gap-3",
        month_caption: "flex items-center justify-center h-8 relative",
        caption_label: "text-sm font-medium text-foreground",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between h-8 z-10",
        button_previous: "inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        button_next: "inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-card hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm",
        day_button: cn(
          "inline-flex items-center justify-center w-8 h-8 rounded-md font-normal transition-colors cursor-pointer",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "aria-selected:opacity-100"
        ),
        selected: "bg-foreground text-background hover:bg-foreground hover:text-background rounded-md",
        today: "bg-accent text-accent-foreground font-semibold",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/30 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") return <ChevronLeft className="w-4 h-4" />
          return <ChevronRight className="w-4 h-4" />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
