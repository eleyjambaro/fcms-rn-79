import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  StyleSheet,
  TextInput as RNTextInput,
  Pressable,
  AppState,
} from 'react-native';
import {
  Button,
  Text,
  useTheme,
  HelperText,
  ActivityIndicator,
} from 'react-native-paper';
import {useMutation} from '@tanstack/react-query';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import {requestOtp, verifyOtp} from '../serverDbQueries/v2/auth';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const OTP_LENGTH = 6;

const CloudV2OTPVerification = ({route}) => {
  const {colors} = useTheme();
  const {email} = route.params ?? {};
  const [, {setAuthFromVerify}] = useCloudAuthContext();

  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState(null);
  const [serverError, setServerError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);
  const cooldownEndRef = useRef(null);
  const inputRef = useRef(null);

  const requestMutation = useMutation(requestOtp);
  const verifyMutation = useMutation(verifyOtp);

  const sendOtp = async () => {
    setServerError('');
    try {
      const data = await requestMutation.mutateAsync(email);
      if (data?.data?.request_id) {
        setRequestId(data.data.request_id);
        // Server-driven resend cooldown; escalates with repeated requests.
        startCooldown(data?.data?.resend_after ?? 30);
      } else {
        setServerError('Failed to send OTP. Please try again.');
      }
    } catch (error) {
      setServerError(
        error?.response?.data?.message ||
          'Unable to send OTP. Check your network.',
      );
    }
  };

  const startCooldown = seconds => {
    // The server owns the cooldown (and escalates it on repeated resends), so
    // mirror its value directly instead of clamping it client-side.
    const safe = Math.max(0, Math.ceil(seconds));
    cooldownEndRef.current = Date.now() + safe * 1000;
    setResendCooldown(safe);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      const remaining = Math.ceil((cooldownEndRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(cooldownRef.current);
        setResendCooldown(0);
      } else {
        setResendCooldown(remaining);
      }
    }, 1000);
  };

  useEffect(() => {
    sendOtp();
    return () => clearInterval(cooldownRef.current);
  }, []);

  // Recalculate remaining cooldown when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && cooldownEndRef.current) {
        const remaining = Math.ceil(
          (cooldownEndRef.current - Date.now()) / 1000,
        );
        if (remaining <= 0) {
          clearInterval(cooldownRef.current);
          setResendCooldown(0);
          cooldownEndRef.current = null;
        } else {
          setResendCooldown(remaining);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setServerError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    if (!requestId) {
      setServerError('OTP request not found. Please resend.');
      return;
    }
    setServerError('');
    try {
      const data = await verifyMutation.mutateAsync({
        email,
        otp,
        request_id: requestId,
      });
      if (data?.status === 'success') {
        await setAuthFromVerify(data);
        // CloudAuthStackV2 will auto-advance to device registration
      } else {
        setServerError(data?.message || 'Invalid or expired OTP.');
      }
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Invalid or expired OTP.',
      );
    }
  };

  // OTP digit boxes rendered from a single hidden TextInput
  const digits = otp.padEnd(OTP_LENGTH, ' ').split('');

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName}`}
        subText=""
        containerStyle={{marginBottom: 0}}
      />

      <Text style={styles.title}>Email Verification</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{' '}
        <Text style={{fontWeight: 'bold'}}>{email}</Text>.{'\n'}
        Enter it below to continue.
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
                    borderColor: isFocused
                      ? colors.primary
                      : digit.trim()
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
        <HelperText type="error" style={styles.error}>
          {serverError}
        </HelperText>
      ) : null}

      {requestMutation.isLoading ? (
        <ActivityIndicator size="small" style={styles.loader} />
      ) : null}

      <Button
        mode="contained"
        onPress={handleVerify}
        loading={verifyMutation.isLoading}
        disabled={
          verifyMutation.isLoading ||
          otp.length !== OTP_LENGTH ||
          requestMutation.isLoading
        }
        style={styles.button}
        contentStyle={styles.buttonContent}>
        Verify
      </Button>

      <Button
        mode="text"
        onPress={sendOtp}
        disabled={resendCooldown > 0 || requestMutation.isLoading}
        style={styles.resendButton}>
        {resendCooldown > 0
          ? `Resend code in ${resendCooldown}s`
          : 'Resend code'}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
    lineHeight: 22,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  digitBox: {
    width: 46,
    height: 56,
    borderWidth: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  error: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  loader: {
    marginBottom: 12,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
    width: '100%',
  },
  buttonContent: {
    paddingVertical: 6,
  },
  resendButton: {
    marginTop: 12,
  },
});

export default CloudV2OTPVerification;
