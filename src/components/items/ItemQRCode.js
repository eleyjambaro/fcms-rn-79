import React, {useState} from 'react';
import {StyleSheet, View, Pressable} from 'react-native';
import {Text, Button, Dialog, Portal, useTheme} from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

/**
 * Renders a QR code that encodes an item's SKU.
 *
 * - The inline QR is tappable; tapping opens a larger, easily-scannable QR in a
 *   dialog (a small header-sized QR is hard to scan with another device).
 * - When `showCaption` is true, a small "SKU: <value>" label is rendered below
 *   the inline QR (used on screens where the SKU isn't shown anywhere else).
 * - Renders nothing when `value` is empty/null so callers can keep a simple
 *   two-column header that gracefully collapses for items without a SKU.
 */
const ItemQRCode = ({value, size = 84, showCaption = true, style}) => {
  const {colors} = useTheme();
  const [dialogVisible, setDialogVisible] = useState(false);

  const sku = (value ?? '').toString().trim();
  if (!sku) return null;

  const showDialog = () => setDialogVisible(true);
  const hideDialog = () => setDialogVisible(false);

  return (
    <>
      <Portal>
        <Dialog visible={dialogVisible} onDismiss={hideDialog}>
          <Dialog.Title>Item QR Code</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogContent}>
              <QRCode value={sku} size={240} quietZone={12} />
              <Text style={[styles.dialogSku, {color: colors.dark}]}>
                {`SKU: ${sku}`}
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDialog}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Pressable
        onPress={showDialog}
        style={[styles.container, style]}
        accessibilityRole="button"
        accessibilityLabel={`Show QR code for SKU ${sku}`}>
        <QRCode value={sku} size={size} />
        {showCaption && (
          <Text
            style={[styles.caption, {color: colors.dark, maxWidth: size}]}
            numberOfLines={1}>
            {`SKU: ${sku}`}
          </Text>
        )}
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  caption: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 'bold',
  },
  dialogContent: {
    alignItems: 'center',
  },
  dialogSku: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ItemQRCode;
