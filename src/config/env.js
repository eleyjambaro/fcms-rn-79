import Config from 'react-native-config';

const required = ['APP_ENV', 'CLOUD_API_V2_BASE_URL'];

function read(key) {
  const value = Config[key];
  if (!value) {
    throw new Error(
      `Missing required env var: ${key}. Did you create .env.development / .env.production from the .example files and pass ENVFILE at build time?`,
    );
  }
  return value;
}

required.forEach(read);

const rawEnv = read('APP_ENV');
if (rawEnv !== 'dev' && rawEnv !== 'prod') {
  throw new Error(
    `Invalid APP_ENV: "${rawEnv}". Expected "dev" or "prod".`,
  );
}

export const env = rawEnv;
export const isDev = env === 'dev';
export const isProd = env === 'prod';

export const cloudApiV2BaseUrl = read('CLOUD_API_V2_BASE_URL');
export const iosStoreUrl = Config.IOS_STORE_URL || '';
export const androidStoreUrl =
  Config.ANDROID_STORE_URL ||
  'https://play.google.com/store/apps/details?id=rocks.uxi.fcmscloud';
