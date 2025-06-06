import React, {useEffect} from 'react';
import {StyleSheet, Pressable, Text, View} from 'react-native';
import {Subheading, useTheme} from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const MoreSelectionButton = props => {
  const {
    placeholder,
    label,
    renderLabel,
    value,
    renderValue,
    renderValueCurrentValue,
    renderIcon,
    onPress,
    onChangeValue,
    containerStyle,
    error = false,
    disabled = false,
    required = false,
  } = props;
  const {colors} = useTheme();
  const iconSize = 35;
  const iconColor = disabled ? colors.disabled : colors.dark;

  useEffect(() => {
    const currentValue = value || renderValueCurrentValue;
    onChangeValue && onChangeValue(currentValue);
  }, [value, renderValueCurrentValue]);

  const trimTextLength = (value, lengthLimit = 12) => {
    if (!value) {
      return '';
    }

    const text = value?.toString();

    if (text.length <= lengthLimit) {
      return text;
    }

    return `${text.substring(0, lengthLimit)}...`;
  };

  const renderingValueDefaultStyle = {
    color: disabled ? colors.disabled : colors.primary,
    marginRight: 5,
    fontWeight: 'bold',
  };
  const renderingValueProps = {
    style: renderingValueDefaultStyle,
    trimTextLength,
  };

  const handlePress = () => {
    if (disabled) {
      return;
    }

    onPress && onPress();
  };

  const renderSelectedValue = () => {
    if (renderValue && renderValue(renderValueCurrentValue) !== null) {
      return renderValue(renderValueCurrentValue, renderingValueProps);
    }

    if (value) {
      return (
        <Subheading numberOfLines={1} style={renderingValueDefaultStyle}>
          {trimTextLength(value)}
        </Subheading>
      );
    }

    return (
      <Subheading
        style={{
          color: colors.primary,
          marginRight: 5,
          fontStyle: 'italic',
        }}>
        {placeholder}
      </Subheading>
    );
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: 'gray',
          borderTopColor: error ? colors.error : 'gray',
          borderBottomColor: error ? colors.error : 'gray',
          paddingTop: 15,
          paddingLeft: 11,
          paddingBottom: 15,
          flexDirection: 'row',
          alignItems: 'center',
        },
        containerStyle,
      ]}>
      {!renderLabel && label && (
        <Text
          style={{
            fontSize: 16,
            color: disabled
              ? colors.disabled
              : error
              ? colors.error
              : colors.placeholder,
          }}>
          {label}
          {required && (
            <Text style={{color: disabled ? colors.disabled : 'red'}}> *</Text>
          )}
        </Text>
      )}
      {renderLabel && renderLabel()}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 'auto',
          marginRight: 3,
        }}>
        {renderSelectedValue()}
        {!renderIcon && (
          <MaterialIcons
            name="chevron-right"
            size={iconSize}
            color={iconColor}
          />
        )}
        {renderIcon && renderIcon({iconSize, iconColor})}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({});

export default MoreSelectionButton;
