import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shizi',
  appName: '识字',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#ffffffff'
    }
  }
};

export default config;
