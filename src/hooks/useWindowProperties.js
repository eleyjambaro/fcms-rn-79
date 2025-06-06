import {useWindowDimensions} from 'react-native';

const useWindowProperties = () => {
  const windowDimensions = useWindowDimensions();
  const {height, width} = windowDimensions;
  let isLandscapeMode = false;
  let mode = 'portrait';

  if (width > height) {
    isLandscapeMode = true;
    mode = 'landscape';
  }

  return {
    ...windowDimensions,
    isLandscapeMode,
    mode,
  };
};

export default useWindowProperties;
