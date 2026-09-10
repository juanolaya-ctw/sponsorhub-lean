import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  alt = "ColombiaTech",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/colombiatech-black.png"
      alt={alt}
      className={cn("h-7 w-auto", className)}
    />
  );
}
