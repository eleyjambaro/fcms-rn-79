import axios from 'axios';
import Config from 'react-native-config';

const cloudApiV2 = axios.create({
  baseURL: Config.CLOUD_API_V2_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

export default cloudApiV2;
