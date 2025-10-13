// --- CSS Animation Definitions ---

import clsx from 'clsx';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
// This component is now self-contained within CardStack.
const CardStackCSS = () => (
  <style>{`
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    .card-fade-in {
      animation: fade-in .1s ease-in-out;
    }

    .card-fade-out {
      animation: fade-out .1s ease-in-out forwards;
    }
  `}</style>
);

// --- Reusable and Refactored CardStack Component ---
export const CardStack = function <Item extends { id: string }>({
                                                                  items,
                                                                  renderItem,
                                                                  className,
                                                                  visibleCards = 3,
                                                                  offset = 20, // in pixels
                                                                  scaleFactor = 0.05,
                                                                  animate = true,
                                                                }: {
  items: Item[];
  renderItem: (item: Item, index?: number) => React.ReactNode;
  className?: string;
  visibleCards?: number;
  offset?: number;
  scaleFactor?: number;
  animate?: boolean;
}) {
  // We render the visible cards + 1 for the exiting card.
  const itemsToRender = items.slice(0, visibleCards + 1);
  return (
    <div
      className={cn('relative w-full', className)}
      style={{ transform: `translateX(${-offset / 2}px)` }}
    >
      <CardStackCSS />
      {animate
        ? itemsToRender.map((item, index) => {
          // The last card in the render list is the one that is exiting.
          const isExiting = index === visibleCards;
          const position = index;

          return (
            <motion.div
              animate={{
                scale: Math.pow(scaleFactor, position),
                x: position * offset,
                y: -position * offset,
                opacity: isExiting ? 0 : 1,
              }}
              initial={
                index == 0
                  ? {
                    opacity: 0,
                    x: -offset,
                    y: offset,
                  }
                  : null
              }
              style={{
                zIndex: itemsToRender.length - index,
              }}
              key={item.id}
              className={`flex h-full w-full cursor-pointer items-center justify-center ${index == 0 ? 'relative' : 'absolute top-0 max-h-full'}`}
            >
              {renderItem(item, index)}
            </motion.div>
          );
        })
        : itemsToRender.map((item, index) => {
          const isExiting = index === visibleCards;
          const position = index;
          return (
            <div
              style={{
                zIndex: itemsToRender.length - index,
                transform: `scale(${Math.pow(scaleFactor, position)}) translateX(${position * offset}px) translateY(${-position * offset}px)`,
                opacity: isExiting ? 0 : 1,
              }}
              key={item.id}
              className={`flex h-full w-full cursor-pointer items-center justify-center ${index == 0 ? 'relative' : 'absolute top-0 max-h-full'}`}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
    </div>
  );
};
