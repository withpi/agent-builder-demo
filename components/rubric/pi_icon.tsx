import Image from "next/image"

export function PiIcon({
  size = 30,
  className,
}: {
  size?: number
  className?: string
}) {
  return <Image width={size} height={size} src="/pi-logo.svg" className={className} alt={"Pi labs logo"} />
}
