import {getDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CurrencyList from 'currency-list';

import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';

export const getCurrencies = async ({queryKey}) => {
  const [_key, {filter}] = queryKey;

  try {
    const currencyMap = CurrencyList.getAll();
    const localeMap = currencyMap['en_US'];
    const currencyList = [];
    let regex = null;

    if (filter?.keyword?.length > 0) {
      regex = new RegExp(`${filter?.keyword}+`, 'ig');
    }

    for (let key in localeMap) {
      const currency = CurrencyList.get(key);
      if (filter?.keyword?.length > 0 && regex) {
        if (currency.name.match(regex) || currency.code.match(regex)) {
          currencyList.push(currency);
        }
      } else {
        currencyList.push(currency);
      }
    }

    return currencyList;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get currencies.');
  }
};
