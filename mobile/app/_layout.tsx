import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';

export default function RootLayout() {
  const content = (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F172A', // Slate 900
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: '#0B0F19',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'FieldLog — System Status',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="record"
        options={{
          title: "आज का रिकॉर्ड (Today's Record)",
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );

  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.webBackdrop}>
          <View style={styles.webContainer}>
            {content}
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    backgroundColor: '#030712', // Neutral dark surrounding backdrop
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
  },
  webContainer: {
    width: '100%',
    maxWidth: 430, // Realistic modern phone viewport
    height: '100vh' as any,
    maxHeight: 932,
    backgroundColor: '#0B0F19',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px #1E293B' as any,
    borderRadius: Platform.OS === 'web' ? 16 : 0,
  },
});
