/**
 * Demo bundle for route A: we replace the Xbox app's Bundle\index.bundle with this
 * React Native Windows bundle. If the app renders this screen, the official app's
 * native shell (auth, Game Bar, launch tracking, package identity) is ours to drive.
 *
 * The native host calls AppRegistry.runApplication with a component name it was
 * built with. We do not know that name yet, so the same component is registered
 * under every plausible candidate; whichever one the host launches will render.
 */
'use strict';

const React = require('react');
const { AppRegistry, StyleSheet, Text, View, Platform } = require('react-native');

const BG = '#0b0b0d';
const CARD = '#16181d';
const GREEN = '#107c10';
const TEXT = '#ffffff';
const DIM = '#9aa0aa';

function Row({ label, value }) {
  return React.createElement(
    View,
    { style: styles.row },
    React.createElement(Text, { style: styles.rowLabel }, label),
    React.createElement(Text, { style: styles.rowValue }, String(value))
  );
}

const Demo = () => {
  const pkg = 'window.__XBOX_MOD__';
  return React.createElement(
    View,
    { style: styles.root },
    React.createElement(
      View,
      { style: styles.header },
      React.createElement(Text, { style: styles.kicker }, 'XBOX APP MOD'),
      React.createElement(Text, { style: styles.title }, 'Custom bundle running'),
      React.createElement(
        Text,
        { style: styles.subtitle },
        'This screen is React Native code loaded from Bundle\\index.bundle inside the real Xbox app.'
      )
    ),
    React.createElement(
      View,
      { style: styles.card },
      React.createElement(Row, { label: 'Platform', value: Platform.OS }),
      React.createElement(Row, { label: 'Component', value: pkg }),
      React.createElement(Row, { label: 'Render path', value: 'Hermes bytecode v96 -> RNW 0.76' })
    ),
    React.createElement(
      Text,
      { style: styles.note },
      'If you can read this, route A is proven: the UI layer of the official app is replaceable.'
    )
  );
};

const CANDIDATES = [
  'App',
  'XboxPcApp',
  'Microsoft.Xbox.App',
  'Microsoft.Xbox.AppL',
  'XboxPcAppL',
  'Microsoft.GamingApp',
  'XboxPcAppRoot',
  'XboxApp',
  'XboxPcAppOverlay',
  'GamePassApp',
  'GarrisonApp',
  'Root',
  'Main',
  'MainComponent',
  'ReactRootView',
  'index',
];

for (const name of CANDIDATES) {
  AppRegistry.registerComponent(name, () => Demo);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 72,
    paddingVertical: 56,
    justifyContent: 'center',
  },
  header: { marginBottom: 36 },
  kicker: {
    color: GREEN,
    fontSize: 16,
    letterSpacing: 6,
    marginBottom: 12,
  },
  title: {
    color: TEXT,
    fontSize: 52,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtitle: {
    color: DIM,
    fontSize: 20,
    lineHeight: 30,
    maxWidth: 900,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    maxWidth: 900,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: { color: DIM, fontSize: 17 },
  rowValue: { color: TEXT, fontSize: 17 },
  note: {
    color: DIM,
    fontSize: 17,
    marginTop: 28,
    maxWidth: 900,
  },
});
