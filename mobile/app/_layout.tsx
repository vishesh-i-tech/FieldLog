import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';

export default function RootLayout() {
  const content = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#F8FAF9',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="record"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="owner"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );

  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
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
      <StatusBar style="dark" />
      {content}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    backgroundColor: '#E8ECE9',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
  },
  webContainer: {
    width: '100%',
    maxWidth: 440,
    height: '100vh' as any,
    maxHeight: 932,
    backgroundColor: '#F8FAF9',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(16, 80, 50, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)' as any,
    borderRadius: Platform.OS === 'web' ? 24 : 0,
  },
});
