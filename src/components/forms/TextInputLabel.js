import React from 'react';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  ActivityIndicator,
  Checkbox,
  Switch,
  HelperText,
} from 'react-native-paper';

export default function TextInputLabel({
  label,
  style = {},
  required = false,
  error = false,
  disabled = false,
}) {
  const {colors} = useTheme();
  return (
    <Text
      style={[
        {
          color: disabled
            ? colors.disabled
            : error
            ? colors.error
            : colors.placeholder,
        },
        style,
      ]}>
      {label}
      {required && (
        <Text style={{color: disabled ? colors.disabled : 'red'}}> *</Text>
      )}
    </Text>
  );
}
