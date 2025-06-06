import {StyleSheet} from 'react-native';
import React from 'react';
import {useQuery} from '@tanstack/react-query';

import {getCompany} from '../../localDbQueries/companies';
import AppIcon from '../../components/icons/AppIcon';
import {getSettings} from '../../localDbQueries/settings';

const WatermarkAppIcon = props => {
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
    return null;
  }

  if (getCompanyStatus === 'error' || getSettingsStatus === 'error') {
    return null;
  }

  const settings = getSettingsData?.resultMap;
  const company = getCompanyData?.result;

  if (!settings) return null;
  if (!company) return null;

  let logoDisplayCompanyName = parseInt(settings.logo_display_company_name);
  let logoDisplayBranch = parseInt(settings.logo_display_branch);

  const companyName = logoDisplayCompanyName
    ? company.company_display_name
    : '';
  const branch =
    companyName && logoDisplayBranch && company.branch ? company.branch : '';

  if (!companyName) {
    return null;
  }

  return <AppIcon {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
});

export default WatermarkAppIcon;
