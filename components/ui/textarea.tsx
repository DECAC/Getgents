import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex w-full resize-none rounded-lg border border-border bg-card px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-faint focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-tint disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
