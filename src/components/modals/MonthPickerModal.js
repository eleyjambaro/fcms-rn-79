import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import moment from 'moment';
import MonthPicker from 'react-native-month-picker';
import {useTheme, Button} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import MoreSelectionButton from '../buttons/MoreSelectionButton';

const styles = StyleSheet.create({
  container: {},
  input: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginVertical: 6,
    marginHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  inputText: {
    fontSize: 16,
    fontWeight: '500',
  },
  contentContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 70,
  },
  confirmButton: {
    marginTop: 25,
    margin: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function MonthPickerModal(props) {
  const {
    placeholder,
    label = 'Select Month and Year',
    value,
    defaultDatetimeStringValue,
    onChange,
    buttonContainerStyle,
  } = props;
  const [isOpen, toggleOpen] = useState(false);
  const defaultDate = defaultDatetimeStringValue
    ? new Date(defaultDatetimeStringValue.split(' ')[0])
    : new Date();
  const [date, setDate] = useState(defaultDate);

  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const year = date.getFullYear();
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  const datetimeStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const [datetimeString, setDatetimeString] = useState(
    defaultDatetimeStringValue || datetimeStringFormat,
  );
  const {colors} = useTheme();

  useEffect(() => {
    setDatetimeString(currentDatetimeString => {
      const updatedDatetimeString =
        defaultDatetimeStringValue || datetimeStringFormat;
      if (updatedDatetimeString !== currentDatetimeString) {
        return updatedDatetimeString;
      } else {
        return currentDatetimeString;
      }
    });

    onChange && onChange(datetimeString, date);
  }, [date, defaultDatetimeStringValue, datetimeString, value, onChange]);

  const handleDateChange = value => {
    setDate(() => new Date(value));
  };

  return (
    <>
      <View
        style={[
          {
            padding: 10,
            backgroundColor: colors.surface,
          },
          buttonContainerStyle,
        ]}>
        <MoreSelectionButton
          label={label}
          containerStyle={{backgroundColor: colors.surface}}
          value={date ? moment(date).format('MMM YYYY') : placeholder}
          onPress={() => toggleOpen(true)}
          renderIcon={({iconSize, iconColor}) => {
            return (
              <MaterialCommunityIcons
                name="chevron-down"
                size={iconSize}
                color={iconColor}
              />
            );
          }}
        />
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isOpen}
        onRequestClose={() => {
          toggleOpen(false);
        }}>
        <View style={styles.contentContainer}>
          <View style={styles.content}>
            <MonthPicker
              selectedDate={date || new Date()}
              onMonthChange={handleDateChange}
              currentMonthTextStyle={{color: colors.accent, fontWeight: 'bold'}}
              selectedBackgroundColor={colors.accent}
              yearTextStyle={{
                fontWeight: 'bold',
                fontSize: 20,
                color: colors.dark,
              }}
            />
            {/* <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => toggleOpen(false)}>
              <Text>Confirm</Text>
            </TouchableOpacity> */}
            <Button
              onPress={() => toggleOpen(false)}
              style={styles.confirmButton}>
              OK
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}

MonthPickerModal.defaultProps = {
  placeholder: 'Select month',
};

export default MonthPickerModal;
