import { cn } from "./cn.js";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-8 bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
