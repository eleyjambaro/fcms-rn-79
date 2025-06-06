import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Checkbox, useTheme, Subheading} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const CheckboxSelection = props => {
  const {
    options = [],
    optionLabelKey = 'label',
    optionValueKey = 'value',
    value,
    label,
    onChange,
  } = props;
  const [selectedValue, setSelectedValue] = useState(value);
  const [selectedLabel, setSelectedLabel] = useState(label);
  const {colors} = useTheme();

  useEffect(() => {
    onChange && onChange(selectedValue, selectedLabel);
  }, [value, selectedValue, selectedLabel]);

  const handleChange = (selectedValue, selectedLabel) => {
    setSelectedValue(() => selectedValue);
    setSelectedLabel(() => selectedLabel);
  };

  return (
    <>
      {options.map((option, index) => {
        if (option.isLabel) {
          return (
            <Subheading
              style={{color: colors.neutralTint2, fontWeight: 'bold'}}>
              {option[optionLabelKey]}
            </Subheading>
          );
        }

        let optionValue = option[optionValueKey]?.toString();
        let optionLabel = option[optionLabelKey]?.toString();

        return (
          <Checkbox.Item
            disabled={option.disabled ? true : false}
            key={`${index} - ${optionValue}`}
            label={option[optionLabelKey]}
            status={
              selectedValue === optionValue ||
              (!selectedValue && optionLabel === 'None')
                ? 'checked'
                : 'unchecked'
            }
            onPress={() => {
              handleChange(optionValue, optionLabel);
            }}
          />
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 7,
    backgroundColor: 'white',
  },
});

export default CheckboxSelection;
