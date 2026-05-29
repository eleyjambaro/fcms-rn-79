import axios from 'axios';

import {cloudApiV2BaseUrl} from '../config/env';

const cloudApiV2 = axios.create({
  baseURL: cloudApiV2BaseUrl,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

export default cloudApiV2;
