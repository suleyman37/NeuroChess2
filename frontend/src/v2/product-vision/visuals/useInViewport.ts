import { useEffect, useRef, useState } from "react";

type UseInViewportOptions = {
  rootMargin?: string;
  threshold?: number;
};

export function useInViewport<T extends HTMLElement>(options: UseInViewportOptions = {}) {
  const { rootMargin = "180px", threshold = 0.01 } = options;
  const ref = useRef<T | null>(null);
  const [isInViewport, setIsInViewport] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(Boolean(entry?.isIntersecting));
      },
      { root: null, rootMargin, threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { ref, isInViewport };
}
