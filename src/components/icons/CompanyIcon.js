import {StyleSheet} from 'react-native';
import React from 'react';
import {useQuery} from '@tanstack/react-query';

import {getCloudCompany} from '../../serverDbQueries/v2/companies';
import AppIcon from '../../components/icons/AppIcon';
import useCloudAuthContext from '../../hooks/useCloudAuthContext';

const CompanyIcon = props => {
  const [cloudState] = useCloudAuthContext();
  const {designatedBranch} = cloudState;

  const {status, data} = useQuery(['cloudCompany'], getCloudCompany);

  if (status === 'loading' || status === 'error') {
    return <AppIcon {...props} />;
  }

  const company = data?.data;

  if (!company) return <AppIcon {...props} />;

  const companyName = company.logo_display_name
    ? company.display_name || ''
    : '';
  const branch =
    companyName && company.logo_display_branch && designatedBranch?.display_name
      ? designatedBranch.display_name
      : '';

  return (
    <AppIcon
      mainText={companyName}
      subText={branch}
      filePath={company.logo_url || ''}
      {...props}
    />
  );
};

const styles = StyleSheet.create({});

export default CompanyIcon;
