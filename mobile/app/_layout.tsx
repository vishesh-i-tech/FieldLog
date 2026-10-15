import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform } from 'react-native';

export default function RootLayout() {
  const content = (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#121212',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: '#121212',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'FieldLog',
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="record"
        options={{
          title: "Daily Record",
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="owner"
        options={{
          title: "Owner",
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: "Sign In",
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
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
  },
  webContainer: {
    width: '100%',
    maxWidth: 430,
    height: '100vh' as any,
    maxHeight: 932,
    backgroundColor: '#121212',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px #222222' as any,
    borderRadius: Platform.OS === 'web' ? 16 : 0,
  },
});
