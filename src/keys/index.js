import DeviceInfo from 'react-native-device-info';
import {env} from '../constants/appConfig';

export const keys = {
  mongodbDataApiKey:
    env === 'dev'
      ? 'poceClbaBpRpvXA8WceLUGvDKnPaRIGXoinMZQMHcZYq4I1eXKscYw8oEGDad6Ru'
      : 'XRfH7vnj3A2gqQCzRXBuWeuKqm7LsJYovcSscfGecRpEuvXas0HeYV19QShPdvwd',
  authTokenKey: `${DeviceInfo.getUniqueIdSync()}`,
};

export default keys;
