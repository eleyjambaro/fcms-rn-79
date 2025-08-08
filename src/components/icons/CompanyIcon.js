import {StyleSheet} from 'react-native';
import React from 'react';
import {useQuery} from '@tanstack/react-query';

import {getCompany} from '../../localDbQueries/companies';
import AppIcon from '../../components/icons/AppIcon';
import {getSettings} from '../../localDbQueries/settings';

const CompanyIcon = props => {
  const {status: getCompanyStatus, data: getCompanyData} = useQuery(
    ['company'],
    getCompany,
  );

  const {status: getSettingsStatus, data: getSettingsData} = useQuery(
    [
      'settings',
      {settingNames: ['logo_display_company_name', 'logo_display_branch']},
    ],
    getSettings,
  );

  if (getCompanyStatus === 'loading' || getSettingsStatus === 'loading') {
    return <AppIcon {...props} />;
  }

  if (getCompanyStatus === 'error' || getSettingsStatus === 'error') {
    return <AppIcon {...props} />;
  }

  const settings = getSettingsData?.resultMap;
  const company = getCompanyData?.result;

  if (!settings || !company) return <AppIcon {...props} />;

  let logoDisplayCompanyName = parseInt(settings.logo_display_company_name);
  let logoDisplayBranch = parseInt(settings.logo_display_branch);

  const companyName = logoDisplayCompanyName
    ? company.company_display_name
    : '';
  const branch =
    companyName && logoDisplayBranch && company.branch ? company.branch : '';

  return (
    <AppIcon
      mainText={companyName}
      subText={branch}
      filePath={company.company_logo_path}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
});

export default CompanyIcon;
