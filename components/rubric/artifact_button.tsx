import React, { ReactNode } from 'react';
import { Button } from '@headlessui/react';
import { clsx } from 'clsx';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function ArtifactButton({
  onClick,
  disabled,
  className,
  children,
  type,
  onHover,
  href,
  target,
  as,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  onHover?: (isHovering: boolean) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  as?: ReactNode;
  href?: string;
  target?: string;
}) {
  if (href) {
    return (
      <Link
        className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border px-6 py-3 font-semibold text-black disabled:cursor-not-allowed',
          className,
          disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-zinc-50',
        )}
        href={href}
        target={target}
      >
        {children}
      </Link>
    );
  }
  return (
    <Button
      as={type ? 'button' : 'div'}
      type={type}
      onClick={onClick}
      onMouseOver={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      disabled={disabled}
      className={cn(
        'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border px-6 py-3 font-semibold text-black disabled:cursor-not-allowed',
        className,
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:bg-zinc-50',
      )}
    >
      {children}
    </Button>
  );
}

export function DarkArtifactButton({
  disabled,
  onClick,
  children,
  className,
  href,
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-700 px-6 py-3 font-semibold text-white hover:bg-black',
          disabled ? 'pointer-events-none opacity-50' : '',
          className,
        )}
      >
        {children}
      </Link>
    );
  }
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-700 px-6 py-3 font-semibold text-white hover:bg-black',
        disabled ? 'pointer-events-none opacity-50' : '',
        className,
      )}
    >
      {children}
    </Button>
  );
}
