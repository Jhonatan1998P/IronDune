import { useEffect } from 'react';
import { useResourceStore } from '../stores/resourceStore';

export const useResourceInterpolation = () => {
  const interpolate = useResourceStore((state) => state.interpolate);

  useEffect(() => {
    let frameId = 0;

    const loop = () => {
      interpolate(Date.now());
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [interpolate]);
};
