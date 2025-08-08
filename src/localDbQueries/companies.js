import {getLocalAccountDBConnection} from '../localDb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {sign, decode} from 'react-native-pure-jwt';
import {copyFile} from '../lib/appMediaStore';
import uuid from 'react-native-uuid';

import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import {trimTextLength} from '../utils/stringHelpers';
import {keys} from '../constants/keys';
import appDefaults from '../constants/appDefaults';
import {setDefaultCloudEmail} from '../serverDbQueries/auth';

export const hasCompany = async ({queryKey}) => {
  const [_key] = queryKey;
  const query = `SELECT COUNT(*) FROM companies`;

  try {
    const db = await getLocalAccountDBConnection();
    const result = await db.executeSql(query);
    const totalCount = result?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return {
      result: totalCount > 0 ? true : false,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch company.');
  }
};

export const createCompany = async ({values, onSuccess, onError}) => {
  try {
    const db = await getLocalAccountDBConnection();

    /**
     * Create Company
     */
    let company = null;
    let companyId = null;

    const createCompanyQuery = `
      INSERT INTO companies (
        company_uid,
        company_name,
        company_display_name,
        company_address,
        company_mobile_number,
        company_email,
        branch
      )
      
      VALUES(
        '${uuid.v4()}',
        '${values.company_name.replace(/\'/g, "''")}',
        '${trimTextLength(values.company_name, 20 - 3).replace(/\'/g, "''")}',
        '${values.company_address.replace(/\'/g, "''")}',
        '${values.company_mobile_number}',
        '${values.company_email}',
        '${values.branch.replace(/\'/g, "''")}'
      );
    `;

    const createCompanyResult = await db.executeSql(createCompanyQuery);
    if (createCompanyResult[0].rowsAffected > 0) {
      companyId = createCompanyResult[0].insertId;

      /**
       * Get created company by id
       */
      const getCompanyQuery = `
        SELECT * FROM companies WHERE id = ${parseInt(companyId)}      
      `;
      const getCompanyResult = await db.executeSql(getCompanyQuery);
      company = getCompanyResult[0].rows.item(0);
    }

    return {
      result: {
        company,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create company.');
  }
};

export const getCompany = async ({queryKey}) => {
  const [_key] = queryKey;
  const query = `SELECT * FROM companies ORDER BY id ASC LIMIT 1`;

  try {
    const db = await getLocalAccountDBConnection();
    const result = await db.executeSql(query);
    const company = result[0].rows.item(0);

    return {
      result: company,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch company.');
  }
};

/**
 * TODO: Refactor this function, get the current selected company
 * instead of getting the one existing company
 */
export const getCurrentSelectedCompany = async () => {
  const query = `SELECT * FROM companies ORDER BY id ASC LIMIT 1`;

  try {
    const db = await getLocalAccountDBConnection();
    const result = await db.executeSql(query);
    const company = result[0].rows.item(0);

    return company;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to current selected company.');
  }
};

export const updateCompany = async ({updatedValues, onSuccess}) => {
  try {
    const db = await getLocalAccountDBConnection();

    /**
     * Get Company
     */
    const getCompanyQuery = `SELECT * FROM companies ORDER BY id ASC LIMIT 1`;

    const getCompanyResult = await db.executeSql(getCompanyQuery);

    const company = getCompanyResult[0].rows.item(0);

    if (!company) {
      throw Error('Company not found.');
    }

    const hasNewSelectedLogoFile = parseInt(
      updatedValues.has_new_selected_logo_file,
    );
    let companyLogoPath = updatedValues.company_logo_path;

    if (hasNewSelectedLogoFile) {
      /**
       * Copy the selected logo file from its path to the app's company logo directory
       * Using appMediaStore which automatically creates directories if they don't exist
       */
      // Relative path for copyFile directory parameter
      const companyLogoDirectoryRelative = `${appDefaults.configDirName}/companies/${company.company_uid}/logo`;
      // Absolute path for React Native Image rendering
      const companyLogoDirectoryAbsolute = `${appDefaults.configDirPath}/companies/${company.company_uid}/logo`;

      const datedCompanyLogoFileName = `${Date.now()}`;
      const datedCompanyLogoFilePath = `${companyLogoDirectoryAbsolute}/${datedCompanyLogoFileName}`;

      try {
        await copyFile(
          updatedValues.company_logo_path,
          companyLogoDirectoryRelative,
          datedCompanyLogoFileName,
        );

        companyLogoPath = datedCompanyLogoFilePath;
      } catch (error) {
        console.debug('Failed to copy company logo file:', error);
        throw new Error('Failed to copy company logo file.');
      }
    }

    /**
     * Update Company
     */
    const updateCompanyQuery = `
      UPDATE companies
      SET company_name = '${updatedValues.company_name.replace(/\'/g, "''")}',
      company_display_name = '${updatedValues.company_display_name.replace(
        /\'/g,
        "''",
      )}',
      company_address = '${updatedValues.company_address.replace(/\'/g, "''")}',
      company_mobile_number = '${updatedValues.company_mobile_number}',
      company_email = '${updatedValues.company_email}',
      company_logo_path = '${companyLogoPath}',
      branch = '${updatedValues.branch.replace(/\'/g, "''")}'
      WHERE id = ${company.id}
    `;

    const updateCompanyResult = await db.executeSql(updateCompanyQuery);

    if (updateCompanyResult[0].rowsAffected > 0) {
      await setDefaultCloudEmail(updatedValues.company_email);

      // update root user account when company email changes
      if (company.company_email !== updatedValues.company_email?.trim()) {
        const updateRootAccountQuery = `UPDATE accounts
          SET email = '${updatedValues.company_email?.trim()}'
          WHERE is_root_account = 1
        `;

        await db.executeSql(updateRootAccountQuery);
      }

      /**
       * TODO: saveUpdatedRootAccountAndCompaniesToThisDevice is deprecated. Remove this
       * when the feature is removed from the app.
       */
      // await saveUpdatedRootAccountAndCompaniesToThisDevice();
      onSuccess && onSuccess({company_id: company.id});
    }
  } catch (error) {
    console.debug(error);
    console.debug('Failed to update company.');
    throw error;
  }
};

export const recreateAllCompanies = async ({companies}) => {
  try {
    const db = await getLocalAccountDBConnection();

    if (!companies || !companies.length > 0) {
      throw Error('Companies parameter is missing or no length.');
    }

    const insertedCompanies = [];

    // insert each company
    let insertCompaniesQuery = `
      INSERT INTO companies (
        company_uid,
        company_name,
        company_display_name,
        company_address,
        company_mobile_number,
        company_email,
        branch
      )
      
      VALUES
    `;

    for (let index = 0; index < companies.length; index++) {
      let company = companies[index];
      insertedCompanies.push(company);

      insertCompaniesQuery += `(
        '${company.company_uid}',
        '${company.company_name.replace(/\'/g, "''")}',
        '${company.company_display_name.replace(/\'/g, "''")}',
        '${company.company_address.replace(/\'/g, "''")}',
        '${company.company_mobile_number}',
        '${company.company_email}',
        '${company.branch.replace(/\'/g, "''")}'
      )`;

      if (companies.length - 1 !== index) {
        insertCompaniesQuery += `,
          `;
      } else {
        insertCompaniesQuery += ';';
      }
    }

    await db.executeSql(insertCompaniesQuery);

    return insertedCompanies;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to recreate all companies.');
  }
};

export const deleteAllCompanies = async () => {
  try {
    const db = await getLocalAccountDBConnection();

    const query = `DELETE FROM companies`;
    return db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
