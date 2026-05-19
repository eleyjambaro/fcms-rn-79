import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import {getActiveCompanyId, getActiveBranchId} from '../localDb';

export const defaultUnitsAbbr = ['mg', 'g', 'kg', 'ml', 'l', 'ea'];

const unitsKey = () => {
  const companyId = getActiveCompanyId();
  const branchId = getActiveBranchId();
  if (companyId && branchId) return `units_${companyId}_${branchId}`;
  if (companyId) return `units_${companyId}`;
  return 'units';
};

export const setDefaultUnits = async () => {
  try {
    const existing = await AsyncStorage.getItem(unitsKey());
    if (existing) {
      return JSON.parse(existing) ?? [];
    }

    const defaultUnits = defaultUnitsAbbr.map(abbr => convert().describe(abbr));
    await AsyncStorage.setItem(unitsKey(), JSON.stringify(defaultUnits));
    return defaultUnits;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteAllUnits = async () => {
  try {
    await AsyncStorage.removeItem(unitsKey());
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deleteDefaultUnits = async () => {
  try {
    await AsyncStorage.removeItem(unitsKey());
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const deletePreviousAppVersionDefaultUnits = async () => {
  try {
    await AsyncStorage.removeItem(unitsKey());
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const getDefaultUnits = async () => {
  try {
    const units = await AsyncStorage.getItem(unitsKey());
    return JSON.parse(units) ?? [];
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const addUnit = async ({unit: newUnit}) => {
  try {
    const unitsJSON = await AsyncStorage.getItem(unitsKey());

    if (!unitsJSON) {
      throw new Error('Default units should be initialized first');
    }

    const units = JSON.parse(unitsJSON);
    let hasDuplicate = false;

    const updatedUnits = units.filter(unit => {
      if (unit.abbr === newUnit.abbr) {
        hasDuplicate = true;
      }
      return unit.abbr !== newUnit.abbr;
    });

    updatedUnits.push(newUnit);

    if (!hasDuplicate) {
      await AsyncStorage.setItem(unitsKey(), JSON.stringify(updatedUnits));
    }

    return newUnit;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
