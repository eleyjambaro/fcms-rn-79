import {useEffect, useState} from 'react';
import {
  initializeSegment1,
  initializeSegment2,
  initializeSegment3,
} from '../services/initAppSegments';

export default function useAppInitialization() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      try {
        await initializeSegment1();
        await initializeSegment2();
        await initializeSegment3();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  return {isInitializing};
}
