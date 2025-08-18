import React, {useEffect} from 'react';
import {StyleSheet, Text, Pressable, View, ToastAndroid} from 'react-native';
import {Button, Searchbar, useTheme} from 'react-native-paper';

import routes from '../constants/routes';
import useSearchbarContext from '../hooks/useSearchbarContext';
import SellingMenuList from '../components/sellingMenus/SellingMenuList';

const SellingMenu = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handlePressCreate = () => {
    navigation.navigate(routes.createSellingMenu());
  };

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search menu"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
      </View>

      <View style={{flex: 1, backgroundColor: colors.surface}}>
        <SellingMenuList
          filter={{'%LIKE': {key: 'name', value: `'%${keyword}%'`}}}
        />
      </View>

      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" icon="plus" onPress={handlePressCreate}>
          Create Menu
        </Button>
      </View>
    </View>
  );
};

export default SellingMenu;

const styles = StyleSheet.create({});
