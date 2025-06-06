import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import {appStorageKeySeperator} from '../localDbQueries/appVersions';

export const defaultUnitsAbbr = ['mg', 'g', 'kg', 'ml', 'l', 'ea'];

export const setDefaultUnits = async (version = '0.0.0') => {
  let hasDefaultUnits = false;
  const key = `hasDefaultUnits${appStorageKeySeperator}${version}`;

  try {
    hasDefaultUnits = await AsyncStorage.getItem(key);
    const defaultUnits = defaultUnitsAbbr.map(unitAbbr => {
      return convert().describe(unitAbbr);
    });

    if (hasDefaultUnits === 'true') {
      console.log(`Default Units (${version}) has been already initialized.`);
      return defaultUnits;
    }

    await AsyncStorage.setItem('units', JSON.stringify(defaultUnits));
    await AsyncStorage.setItem(key, 'true');
    console.log(
      `Default Units (${version}) has been initialized successfully.`,
    );

    return defaultUnits;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllUnits = async () => {
  try {
    await AsyncStorage.removeItem('units');

    console.info('Units deleted');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultUnits = async () => {
  try {
    await AsyncStorage.removeItem('units');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deletePreviousAppVersionDefaultUnits = async (
  currentVersion = '0.0.0',
) => {
  try {
    await AsyncStorage.removeItem('units');
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getDefaultUnits = async () => {
  try {
    const units = await AsyncStorage.getItem('units');
    return JSON.parse(units);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const addUnit = async ({unit: newUnit}) => {
  try {
    const unitsJSON = await AsyncStorage.getItem('units');

    if (!unitsJSON) {
      throw new Error('Default units should be initialized first');
    }

    const units = JSON.parse(unitsJSON);
    let hasDuplicate = false;

    const updatedUnits = units.filter(unit => {
      if (unit.abbr === newUnit.abbr) {
        hasDuplicate = true;
      }

      if (unit.abbr !== newUnit.abbr) {
        return true;
      } else {
        return false;
      }
    });

    updatedUnits.push(newUnit);

    if (!hasDuplicate) {
      await AsyncStorage.setItem('units', JSON.stringify(updatedUnits));
    }

    return newUnit;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
