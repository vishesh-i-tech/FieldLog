import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { initAuthSession, getAuthTokens } from '../src/services/auth.state';

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const user = await initAuthSession();
        const tokens = getAuthTokens();

        if (!isMounted) return;

        if (user && tokens?.accessToken) {
          if (user.role === 'owner') {
            router.replace('/owner');
          } else {
            router.replace('/record');
          }
        } else {
          router.replace('/login');
        }
      } catch (err) {
        if (isMounted) {
          router.replace('/login');
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.brandBox}>
        <Text style={styles.brandIcon}>📋</Text>
        <Text style={styles.brandTitle}>FieldLog</Text>
        <Text style={styles.brandSubtitle}>Verified Daily Operational Records</Text>
      </View>
      <ActivityIndicator size="large" color="#10B981" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B192C',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  brandBox: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandIcon: {
    fontSize: 54,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  loader: {
    marginTop: 16,
  },
});
