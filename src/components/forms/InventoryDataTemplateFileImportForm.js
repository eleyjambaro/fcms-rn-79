import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from '@react-native-documents/picker';

import SelectionButtonList from '../buttons/SelectionButtonList';
import {readInventoryDataTemplateFile} from '../../localDbQueries/inventoryDataTemplate';
import {useMutation, useQuery} from '@tanstack/react-query';
import MonthPickerModal from '../modals/MonthPickerModal';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import RNFetchBlob from 'rn-fetch-blob';

const InventoryDataTemplateValidationSchema = Yup.object().shape({
  select_multiple_sheets: Yup.boolean(),
  file_path: Yup.string().required('Required.'),
  sheets: Yup.array().when('select_multiple_sheets', {
    is: true,
    then: () =>
      Yup.array().min(1, 'Must have at least one selected worksheet.'),
  }),
  sheet: Yup.string().when('select_multiple_sheets', {
    is: false,
    then: () => Yup.string().required('Must select a worksheet to import.'),
  }),
});

const InventoryDataTemplateFileImportForm = props => {
  const {
    editMode = false,
    initialValues = {
      file_path: '',
      sheets: [],
      sheet: '',
    },
    onSubmit,
    onCancel,
    selectMultipleSheets = false,
    submitButtonTitle = 'Proceed',
  } = props;
  const {colors} = useTheme();
  const readInventoryDataTemplateFileMutation = useMutation(
    readInventoryDataTemplateFile,
    {
      onSuccess: () => {},
    },
  );

  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

  const selectInventoryDataTemplateFileToImport = async formikProps => {
    const {setFieldValue, setFieldTouched} = formikProps;

    try {
      const [file] = await DocumentPicker.pick({
        allowMultiSelection: false,
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.xls],
      });

      const [localCopy] = await DocumentPicker.keepLocalCopy({
        files: [
          {
            uri: file.uri,
            fileName: file.name,
          },
        ],
        destination: 'cachesDirectory',
      });

      const stats = await RNFetchBlob.fs.stat(
        decodeURIComponent(localCopy?.localUri),
      );

      // const filePath = `${'/storage/emulated/0/Download/FCMS Inventory Data Template Populated (2).xlsx'}`;
      const filePath = stats.path;
      filePath && setFieldValue('file_path', filePath);
      setFieldTouched('file_path', true);

      await readInventoryDataTemplateFileMutation.mutateAsync({
        filePath,
      });
    } catch (error) {
      console.debug(error);
    }
  };

  const handleDateChange = (datetimeString, date) => {
    setDateString(() => datetimeString);
    setDate(() => date);
  };

  const handleSheetsSelectionChange = (value, actions) => {
    if (selectMultipleSheets) {
      value && value.length > 0 && actions.setFieldTouched('sheets', true);
      actions.setFieldValue('sheets', value);
    } else {
      value && actions.setFieldTouched('sheet', true);
      actions.setFieldValue('sheet', value);
    }
  };

  const renderButtonOrSelectedFile = formikProps => {
    const {values} = formikProps;

    if (!values.file_path) {
      return (
        <Button
          onPress={async () => {
            await selectInventoryDataTemplateFileToImport(formikProps);
          }}
          style={{marginVertical: 10}}>
          Select a File
        </Button>
      );
    }
  };

  const renderSheetsSelection = ({
    values,
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
  }) => {
    if (!values.file_path) return null;

    const {
      status: readInventoryDataTemplateFileStatus,
      data: readInventoryDataTemplateFileData,
    } = readInventoryDataTemplateFileMutation;

    if (readInventoryDataTemplateFileStatus === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (readInventoryDataTemplateFileStatus === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    if (!readInventoryDataTemplateFileData) return null;

    const {workbookSheetNames} = readInventoryDataTemplateFileData?.result;

    const sheetSelections = workbookSheetNames?.map(sheetName => {
      return {
        label: sheetName,
        value: sheetName,
      };
    });

    const selectionDefaultValue = selectMultipleSheets ? [] : '';

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {'Select a worksheet to import:'}
        </Subheading>
        <SelectionButtonList
          selections={sheetSelections}
          selectMany={selectMultipleSheets}
          defaultValue={selectionDefaultValue}
          onChange={value => {
            handleSheetsSelectionChange(value, {
              setFieldValue,
              setFieldTouched,
            });
          }}
        />
        {errors.sheets && touched.sheets && (
          <Text style={{color: colors.error, marginTop: 10}}>
            {errors.sheets}
          </Text>
        )}
      </>
    );
  };

  const renderMonthPicker = formikProps => {
    const {values} = formikProps;

    if (!values.file_path) return null;

    return (
      <MonthPickerModal
        label="Beginning Inventory"
        value={dateString}
        onChange={handleDateChange}
        buttonContainerStyle={{padding: 0}}
      />
    );
  };

  return (
    <>
      <Formik
        initialValues={{
          select_multiple_sheets: selectMultipleSheets,
          file_path: initialValues.file_path,
          sheets: initialValues.sheets || [],
          sheet: initialValues.sheet || '',
        }}
        validationSchema={InventoryDataTemplateValidationSchema}
        onSubmit={(...args) => {
          onSubmit && onSubmit(...args, dateString);
        }}>
        {props => {
          const {
            handleChange,
            handleBlur,
            handleSubmit,
            values,
            errors,
            touched,
            dirty,
            isSubmitting,
            isValid,
            setFieldValue,
            setFieldTouched,
          } = props;

          return (
            <>
              {/* <View style={{flexDirection: 'row'}}>
              <TextInput
                style={{flex: 1}}
                label="File Name"
                onChangeText={handleChange('file_path')}
                onBlur={handleBlur('file_path')}
                value={values.file_path}
                error={errors.file_path && touched.file_path ? true : false}
                // autoFocus={editMode ? true : false}
              />
              {dirty && (
                <MaterialCommunityIcons
                  onPress={() =>
                    setFieldValue('file_path', initialValues.file_path)
                  }
                  name="refresh"
                  size={25}
                  color={colors.dark}
                  style={{position: 'absolute', top: 18, right: 15}}
                />
              )}
            </View> */}

              {renderButtonOrSelectedFile(props)}
              {renderMonthPicker(props)}
              {renderSheetsSelection({
                values,
                errors,
                touched,
                setFieldValue,
                setFieldTouched,
              })}
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={!dirty || !isValid || isSubmitting}
                loading={isSubmitting}
                style={{marginTop: 20}}>
                {submitButtonTitle}
              </Button>
              <Button onPress={onCancel} style={{marginTop: 10}}>
                Cancel
              </Button>
            </>
          );
        }}
      </Formik>
    </>
  );
};

const styles = StyleSheet.create({});

export default InventoryDataTemplateFileImportForm;
