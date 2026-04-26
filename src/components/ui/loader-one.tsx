"use client"

import { motion, useReducedMotion } from "framer-motion"

const DOT_COUNT = 3

const LoaderOne = () => {
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex items-center justify-center gap-1" aria-hidden>
      {Array.from({ length: DOT_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="h-3 w-3 rounded-full bg-[var(--yu3-forest,#2C3E2D)]"
          initial={reduceMotion ? false : { x: 0 }}
          animate={
            reduceMotion
              ? { opacity: 0.75 }
              : {
                  x: [0, 10, 0],
                  opacity: [0.5, 1, 0.5],
                  scale: [1, 1.2, 1],
                }
          }
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }
          }
        />
      ))}
    </div>
  )
}

export default LoaderOne
