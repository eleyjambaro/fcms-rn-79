#!/usr/bin/env bash
#
# Build + install + launch the debug app over WIRELESS adb.
#
# Why: the ELI_NX9 tablet's USB link drops mid-transfer, so the normal
# `react-native run-android` install fails with `InstallException: EOF`.
# Pushing over Wi-Fi bypasses the flaky cable entirely.
#
# Usage:
#   npm run android:wifi            # auto-discover device, build, install, launch
#   DEVICE_IP=192.168.254.102 npm run android:wifi   # skip discovery
#
# One-time setup: with the device plugged in via USB at least once so adb can
# enable TCP mode. After that the cable is optional (until the device reboots).

set -euo pipefail

APP_ID="rocks.uxi.fcmscloud"
MAIN_ACTIVITY="${APP_ID}/.MainActivity"
APK="android/app/build/outputs/apk/debug/app-debug.apk"
ENVFILE="${ENVFILE:-.env.development}"
PORT=5555
METRO_PORT=8081

cd "$(dirname "$0")/.."

echo "==> Locating wireless device"

# 1. Already connected over TCP? Reuse it.
TARGET="$(adb devices | awk '/:'"$PORT"'[[:space:]]+device$/{print $1; exit}')"

if [ -z "${TARGET}" ]; then
  # 2. Use an explicit DEVICE_IP if provided.
  IP="${DEVICE_IP:-}"

  # 3. Otherwise derive the IP from a USB-connected device and enable TCP mode.
  if [ -z "${IP}" ]; then
    USB_SERIAL="$(adb devices | awk '/[[:space:]]device$/ && $1 !~ /:'"$PORT"'/{print $1; exit}')"
    if [ -z "${USB_SERIAL}" ]; then
      echo "ERROR: no device found. Plug the tablet in via USB once so adb can enable Wi-Fi mode," >&2
      echo "       or pass DEVICE_IP=<tablet-ip> npm run android:wifi" >&2
      exit 1
    fi
    IP="$(adb -s "${USB_SERIAL}" shell ip route 2>/dev/null | awk '{print $9}' | head -1 | tr -d '\r')"
    if [ -z "${IP}" ]; then
      echo "ERROR: could not read the device's Wi-Fi IP. Is it on Wi-Fi?" >&2
      exit 1
    fi
    echo "==> Enabling TCP mode on USB device ${USB_SERIAL} (${IP})"
    adb -s "${USB_SERIAL}" tcpip "${PORT}" >/dev/null
    sleep 2
  fi

  echo "==> Connecting to ${IP}:${PORT}"
  adb connect "${IP}:${PORT}" >/dev/null
  TARGET="${IP}:${PORT}"
fi

echo "==> Using device ${TARGET}"
adb -s "${TARGET}" wait-for-device

echo "==> Building debug APK (ENVFILE=${ENVFILE})"
( cd android && ENVFILE="${ENVFILE}" ./gradlew app:assembleDebug )

echo "==> Wiring Metro reverse tunnel (:${METRO_PORT})"
adb -s "${TARGET}" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null || true

echo "==> Installing over Wi-Fi"
adb -s "${TARGET}" install -r "${APK}"

echo "==> Launching ${MAIN_ACTIVITY}"
adb -s "${TARGET}" shell am start -n "${MAIN_ACTIVITY}" >/dev/null

echo "==> Done. App running on ${TARGET}."
echo "    (Make sure Metro is up: npm start)"
