import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageWrapper({ children, className, noPadding }: PageWrapperProps) {
  return (
    <div className={cn(
      "pb-28 lg:pb-0",
      !noPadding && "px-5",
      className
    )}>
      {children}
    </div>
  );
}
