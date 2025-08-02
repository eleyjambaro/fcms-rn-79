import {useEffect, useState} from 'react';
import {checkPermissions} from '../services/permissions';

export default function usePermissions({enabled = true} = {}) {
  const [needStorageReadAndWritePermissionScreenVisible, setRWVisible] =
    useState(false);
  const [needStorageManagementPermissionScreenVisible, setMgmtVisible] =
    useState(false);
  const [isCheckingPermission, setChecking] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    checkPermissions({
      onRWDenied: () => setRWVisible(true),
      onMgmtNeeded: () => setMgmtVisible(true),
    }).finally(() => setChecking(false));
  }, [enabled]);

  return {
    isCheckingPermission,
    needStorageReadAndWritePermissionScreenVisible,
    needStorageManagementPermissionScreenVisible,
  };
}
