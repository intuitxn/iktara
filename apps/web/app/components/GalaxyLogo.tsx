import Image from "next/image";

export default function GalaxyLogo({ size = 56 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Iktara logo"
      width={size}
      height={size}
      priority
    />
  );
}
