#!/bin/bash
cd android
./gradlew installDebug
adb shell am start -n rocks.uxi.fcmscloud/.MainActivity