import { useMemo } from 'react';

import { APP_CONFIG } from '@/constants/config';
import { getApiBaseUrl } from '@/services/apiClient';
import { getEnv, isBackendConfigured, isGeminiConfigured } from '@/utils/env';

export function useAppConfig() {
  return useMemo(() => {
    const env = getEnv();
    return {
      appName: APP_CONFIG.name,
      appSubtitle: APP_CONFIG.subtitle,
      appVersion: APP_CONFIG.version,
      appEnv: env.appEnv,
      apiUrl: getApiBaseUrl(),
      backendConfigured: isBackendConfigured(),
      geminiConfigured: isGeminiConfigured(),
    };
  }, []);
}
