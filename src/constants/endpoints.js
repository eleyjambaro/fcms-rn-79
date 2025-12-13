import {env} from './appConfig';

export const endpoints = {
  activateLicense:
    env === 'dev'
      ? () => 'http://127.0.0.1:5001/fcms-e7d85/us-central1/activateLicense'
      : () => 'https://activatelicense-f64subkjaq-uc.a.run.app',
};

export default endpoints;
