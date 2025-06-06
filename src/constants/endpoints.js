import {env} from './appConfig';

const endpointBaseUrl =
  env === 'dev'
    ? 'https://ap-southeast-1.aws.data.mongodb-api.com/app/data-wdedy/endpoint'
    : 'https://ap-southeast-1.aws.data.mongodb-api.com/app/data-vfhxg/endpoint';

export const endpoints = {
  activateLicense:
    env === 'dev'
      ? () =>
          'https://ap-southeast-1.aws.data.mongodb-api.com/app/data-wdedy/endpoint/licenses/activate'
      : () =>
          'https://ap-southeast-1.aws.data.mongodb-api.com/app/data-vfhxg/endpoint/licenses/activate',
};

export default endpoints;
