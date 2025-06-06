import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

const DefaultErrorScreen = props => {
    const {
        containerStyle,
        errorTitle,
        errorMessage,
        errorTitleStyle,
        errorMessageStyle,
    } = props;

    const renderErrorTitle = () => {
        if (errorTitle) {
            return (
                <Text style={[styles.errorTitle, errorTitleStyle]}>
                    {errorTitle}
                </Text>
            );
        }
    };

    const renderErrorMessage = () => {
        if (errorTitle) {
            return (
                <Text style={[styles.errorMessage, errorMessageStyle]}>
                    {errorMessage}
                </Text>
            );
        }
    };

    return (
        <View style={[styles.container, containerStyle]}>
            {renderErrorTitle()}
            {renderErrorMessage()}
        </View>
    );
};

export default DefaultErrorScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    errorMessage: {},
});
