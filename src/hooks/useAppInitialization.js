import {useEffect, useState} from 'react';
import {
  initializeTablesAndHandleAppVersion,
  initializeOtherServices,
} from '../services/initAppSegments';
import {
  checkIfAppInstalledIndicatorExists,
  isIgnoredExistingAppData,
  isRecoveredExistingAppData,
} from '../lib/appInstalledIndicator';
import {isLocalAccountSetupCompleted} from '../localDbQueries/accounts';

export default function useAppInitialization({
  onAppPreviouslyInstalledDetected,
} = {}) {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      setIsInitializing(true);
      try {
        const isSetupCompleted = await isLocalAccountSetupCompleted();
        const appInstalledIndicatorExists =
          await checkIfAppInstalledIndicatorExists();
        const isExistingAppDataIgnored = await isIgnoredExistingAppData();
        const isExistingAppDateRecovered = await isRecoveredExistingAppData();

        if (
          !isSetupCompleted &&
          appInstalledIndicatorExists &&
          (!isExistingAppDataIgnored || isExistingAppDateRecovered)
        ) {
          onAppPreviouslyInstalledDetected &&
            onAppPreviouslyInstalledDetected();
        } else {
          await initializeTablesAndHandleAppVersion();
        }

        await initializeOtherServices();
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
