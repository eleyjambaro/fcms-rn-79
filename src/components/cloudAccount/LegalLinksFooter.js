import React from 'react';
import {View, StyleSheet, Pressable, Linking, Text} from 'react-native';
import {useTheme} from 'react-native-paper';

import urls from '../../constants/urls';

const links = [
  {label: 'About', url: urls.aboutUrl},
  {label: 'Privacy Policy', url: urls.privacyPolicyUrl},
  {label: 'Contact', url: urls.contactUrl},
];

/**
 * A compact row of About · Privacy Policy · Contact links shown below the
 * Cloud auth screens. Each opens the corresponding page on the FCMS Cloud web
 * app (see WEB_APP_URL / urls.js) in the device browser.
 */
const LegalLinksFooter = ({style}) => {
  const {colors} = useTheme();
  const mutedColor = colors.onSurfaceVariant ?? colors.placeholder;

  const openUrl = url => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, style]}>
      {links.map((link, index) => (
        <React.Fragment key={link.label}>
          {index > 0 ? (
            <Text style={[styles.separator, {color: mutedColor}]}>·</Text>
          ) : null}
          <Pressable
            hitSlop={8}
            style={styles.link}
            onPress={() => openUrl(link.url)}>
            <Text style={[styles.linkText, {color: mutedColor}]}>
              {link.label}
            </Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 32,
    gap: 8,
  },
  link: {
    paddingVertical: 4,
  },
  linkText: {
    fontSize: 13,
  },
  separator: {
    fontSize: 13,
  },
});

export default LegalLinksFooter;
