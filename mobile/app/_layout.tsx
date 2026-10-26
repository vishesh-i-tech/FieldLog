import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isMobileScreen = width <= 600;

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // 1. Register PWA Service Worker
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js').catch((err) => {
            console.log('SW registration note:', err);
          });
        });
      }

      // 2. Inject PWA Manifest & Meta Tags
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }
      if (!document.querySelector('meta[name="theme-color"]')) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#0B192C';
        document.head.appendChild(meta);
      }
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-capable';
        meta.content = 'yes';
        document.head.appendChild(meta);
      }
      if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-status-bar-style';
        meta.content = 'black-translucent';
        document.head.appendChild(meta);
      }
    }
  }, []);

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
        <StatusBar style="light" />
        <View style={[styles.webBackdrop, isMobileScreen && styles.webBackdropMobile]}>
          <View style={[styles.webContainer, isMobileScreen && styles.webContainerMobile]}>
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
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh' as any,
  },
  webBackdropMobile: {
    backgroundColor: '#121212',
  },
  webContainer: {
    width: '100%',
    maxWidth: 440,
    height: '100vh' as any,
    maxHeight: 932,
    backgroundColor: '#121212',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' as any,
    borderRadius: 24,
  },
  webContainerMobile: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 0,
    boxShadow: 'none' as any,
  },
});
