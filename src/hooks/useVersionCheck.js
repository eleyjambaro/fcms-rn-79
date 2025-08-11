import {useState, useEffect} from 'react';
import {checkVersion} from '../services/versionCheck';

export const useVersionCheck = () => {
  const [versionState, setVersionState] = useState({
    isChecking: true,
    needsUpdate: false,
    isForceUpdate: false,
    currentVersion: null,
    latestVersion: null,
    storeUrl: null,
  });

  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    const checkAppVersion = async () => {
      try {
        const versionInfo = await checkVersion();
        console.info('Version info: ', versionInfo);

        if (versionInfo) {
          setVersionState({
            isChecking: false,
            needsUpdate: versionInfo.needsUpdate,
            isForceUpdate: versionInfo.isForceUpdate,
            currentVersion: versionInfo.currentVersion,
            latestVersion: versionInfo.latestVersion,
            storeUrl: versionInfo.storeUrl,
          });

          if (versionInfo.needsUpdate) {
            setShowUpdateModal(true);
          }
        }
      } catch (error) {
        console.error('Version check failed:', error);
        setVersionState(prev => ({...prev, isChecking: false}));
      }
    };

    checkAppVersion();
  }, []);

  const hideUpdateModal = () => {
    if (!versionState.isForceUpdate) {
      setShowUpdateModal(false);
    }
  };

  return {
    ...versionState,
    showUpdateModal,
    hideUpdateModal,
  };
};
