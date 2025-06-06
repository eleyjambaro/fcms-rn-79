import {StyleSheet, View, Pressable, Image} from 'react-native';
import {Avatar, Text, useTheme} from 'react-native-paper';
import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const CloudAppIcon = props => {
  const {
    mainText,
    subText = 'M G M T.   S Y S.',
    containerStyle,
    textContainerStyle,
    editMode = false,
    onPressEditButton,
    filePath,
    size = 80,
    variant = 'vertical',
    styleVariant = 'colored',
    message,
  } = props;
  const {colors} = useTheme();

  let iconSource = require('../../assets/iconicMark/fcms_icon_colored_tp_bg.png');
  let iconSize = size;
  let mainTextFontSize = iconSize - 56;
  let subTextFontSize = mainTextFontSize - 15;

  let iconColor = null;
  let iconBackgroundColor = colors.primary;
  let mainTextColor = 'black';
  let subTextColor = 'black';

  if (variant === 'horizontal') {
    iconSize = size;
    mainTextFontSize = iconSize - 10;
    subTextFontSize = mainTextFontSize - 11;
  }

  if (styleVariant === 'light') {
    iconSource = require('../../assets/iconicMark/fcms_icon_white_tp_bg.png');
    iconColor = colors.primary;
    iconBackgroundColor = colors.surface;
    mainTextColor = colors.surface;
    subTextColor = colors.surface;
  }

  if (styleVariant === 'light-plus-dark-text') {
    iconColor = colors.primary;
    iconBackgroundColor = colors.surface;
  }

  if (styleVariant === 'shaded') {
    iconColor = colors.neutralTint5;
    iconBackgroundColor = colors.neutralTint3;
    mainTextColor = colors.neutralTint3;
    subTextColor = colors.neutralTint3;
  }

  const handlePressEditButton = () => {
    if (!editMode) return;

    onPressEditButton && onPressEditButton();
  };

  const renderMainText = () => {
    const iconMainText = mainText ? mainText : 'Food Cost';

    if (!iconMainText) return null;

    return (
      <Text
        style={[
          styles.mainText,
          {fontSize: mainTextFontSize, color: mainTextColor},
        ]}
        numberOfLines={1}>{`${iconMainText}`}</Text>
    );
  };

  const renderSubText = () => {
    let iconSubText = subText;

    if (!mainText && !subText) {
      iconSubText = 'M G M T.   S Y S.';
    }

    if (!iconSubText) return null;

    return (
      <Text
        style={[
          styles.subText,
          {fontSize: subTextFontSize, color: subTextColor},
        ]}
        numberOfLines={1}>{`${iconSubText}`}</Text>
    );
  };

  const renderDefaultIconOrImageFile = () => {
    if (filePath) {
      return (
        <Avatar.Image source={{uri: `file://${filePath}`}} size={iconSize} />
      );
    }

    return (
      <Avatar.Image
        size={iconSize}
        source={iconSource}
        style={{backgroundColor: iconBackgroundColor}}
      />
    );
  };

  const renderMessage = () => {
    if (message) {
      return (
        <View style={{marginTop: 10, marginHorizontal: 25}}>
          <Text
            style={{
              color: colors.surface,
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
            {message}
          </Text>
        </View>
      );
    }
  };

  let defaultContainerStyle = {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  };

  let defaultTextContainerStyle = {
    marginTop: 10,
    marginBottom: 15,
    alignItems: 'center',
  };

  if (variant === 'horizontal') {
    defaultContainerStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      // paddingLeft: 15,
      // marginRight: -10,
    };

    defaultTextContainerStyle = {
      marginLeft: 9,
      alignItems: 'center',
    };
  }

  return (
    <View style={[defaultContainerStyle, containerStyle]}>
      <View style={{marginBottom: 15}}>
        {renderDefaultIconOrImageFile()}
        <Avatar.Icon
          size={43}
          icon="cloud-sync"
          color={colors.primary}
          style={{
            backgroundColor: colors.surface,
            position: 'absolute',
            bottom: -15,
            right: -5,
          }}
        />
      </View>
      <View style={[defaultTextContainerStyle, textContainerStyle]}>
        {renderMainText()}
        {renderSubText()}
      </View>
      {renderMessage()}
    </View>
  );
};

export default CloudAppIcon;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  textContainer: {
    marginTop: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  mainText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subText: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: -2,
    textTransform: 'uppercase',
  },
});
