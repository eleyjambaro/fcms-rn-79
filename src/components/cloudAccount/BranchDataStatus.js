import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';

const BranchDataStatus = props => {
  const {isUploading, uploadProgress = 0} = props;
  const {colors} = useTheme();

  const renderUploadingLabel = () => {
    if (isUploading && uploadProgress === 100) {
      return <Text>Preparing...</Text>;
    }

    if (isUploading) return <Text>Uploading...</Text>;
  };

  const renderUploadingProgress = () => {
    if (!isUploading) return null;

    return (
      <>
        {renderUploadingLabel()}
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={[styles.progressBarWrapper]}>
            <View
              style={[
                styles.progressLoaderContainer,
                {borderColor: colors.primary},
              ]}>
              <View
                style={[
                  styles.progressLoader,
                  {
                    width: `${uploadProgress}%`,
                    backgroundColor: colors.accent,
                  },
                ]}></View>
            </View>
          </View>

          <Text
            style={[styles.progressPercentage]}>{`${uploadProgress}%`}</Text>
        </View>
      </>
    );
  };
  return <View style={[styles.container]}>{renderUploadingProgress()}</View>;
};

export default BranchDataStatus;

const styles = StyleSheet.create({
  container: {},
  progressBarWrapper: {
    flex: 1,
  },
  progressLoaderContainer: {
    borderWidth: 1,
    borderRadius: 5,
    height: 7,
  },
  progressLoader: {
    height: 5,
    borderRadius: 5,
  },
  progressPercentage: {
    marginLeft: 5,
    fontSize: 12,
  },
});
