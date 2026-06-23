import React, {useEffect, useRef, useState} from 'react';
import {View, StyleSheet, TextInput as RNTextInput, Pressable} from 'react-native';
import {Button, Text, useTheme, HelperText, ActivityIndicator} from 'react-native-paper';
import {useMutation} from '@tanstack/react-query';

import {requestDeleteAccountOtp} from '../../serverDbQueries/v2/auth';

const OTP_LENGTH = 6;

/**
 * Verification-code step for account deletion. On mount it asks the server to
 * verify the password and email a fresh OTP to the root account, lets the user
 * enter the 6-digit code, and hands the code + request_id back via onSubmit so
 * the caller can pass them to deleteMyCloudAccount alongside the password. If
 * the server rejects the password (401), onPasswordRejected bounces the user
 * back to the password step instead of emailing a code.
 */
const ConfirmAccountDeletionUsingOtpForm = ({
  email,
  password,
  onSubmit,
  onCancel,
  onPasswordRejected,
}) => {
  const {colors} = useTheme();

  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [serverError, setServerError] = useState('');
  const inputRef = useRef(null);

  const requestMutation = useMutation(requestDeleteAccountOtp);

  const sendOtp = async () => {
    setServerError('');
    try {
      const data = await requestMutation.mutateAsync({password});
      if (data?.data?.request_id) {
        setRequestId(data.data.request_id);
      } else {
        setServerError('Failed to send the code. Please try again.');
      }
    } catch (error) {
      // Wrong password → bounce back to the password step.
      if (error?.response?.status === 401 && onPasswordRejected) {
        onPasswordRejected(
          error?.response?.data?.message || 'The password is incorrect.',
        );
        return;
      }
      setServerError(
        error?.response?.data?.message ||
          'Unable to send the code. Check your network.',
      );
    }
  };

  useEffect(() => {
    sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    if (otp.length !== OTP_LENGTH) {
      setServerError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    if (!requestId) {
      setServerError('No active code. Please resend.');
      return;
    }
    onSubmit && onSubmit({otp, request_id: requestId});
  };

  const digits = otp.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <View>
      <Text style={{marginBottom: 16}}>
        We sent a 6-digit code to{' '}
        <Text style={{fontWeight: 'bold'}}>{email}</Text>. Enter it below to
        confirm account deletion.
      </Text>

      {/* Hidden real input */}
      <RNTextInput
        ref={inputRef}
        value={otp}
        onChangeText={val => {
          const cleaned = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
          setOtp(cleaned);
          setServerError('');
        }}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        style={styles.hiddenInput}
        showSoftInputOnFocus
        autoFocus
      />

      {/* Digit boxes — tap anywhere to (re)open the keyboard */}
      <Pressable
        onPress={() => {
          inputRef.current?.blur();
          requestAnimationFrame(() => inputRef.current?.focus());
        }}>
        <View style={styles.otpRow}>
          {digits.map((digit, index) => {
            const isFocused = index === otp.length;
            return (
              <View
                key={index}
                style={[
                  styles.digitBox,
                  {
                    borderColor:
                      isFocused || digit.trim()
                        ? colors.primary
                        : colors.outline ?? '#ccc',
                    backgroundColor: colors.surface,
                  },
                ]}>
                <Text
                  style={[
                    styles.digitText,
                    {color: colors.onSurface ?? colors.text},
                  ]}>
                  {digit.trim()}
                </Text>
              </View>
            );
          })}
        </View>
      </Pressable>

      {serverError ? (
        <HelperText type="error" style={{textAlign: 'center'}}>
          {serverError}
        </HelperText>
      ) : null}

      {requestMutation.isLoading ? (
        <ActivityIndicator size="small" style={{marginBottom: 12}} />
      ) : null}

      <Button
        mode="contained"
        onPress={handleContinue}
        icon={'delete-outline'}
        color={colors.notification}
        disabled={otp.length !== OTP_LENGTH || requestMutation.isLoading}
        style={{marginTop: 8}}>
        Continue
      </Button>
      <Button
        mode="text"
        onPress={sendOtp}
        disabled={requestMutation.isLoading}
        style={{marginTop: 12}}>
        Resend code
      </Button>
      <Button onPress={onCancel} style={{marginTop: 4}}>
        Cancel
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  digitBox: {
    width: 42,
    height: 52,
    borderWidth: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default ConfirmAccountDeletionUsingOtpForm;
