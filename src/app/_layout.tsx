import { Stack } from 'expo-router';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/context/auth';

const theme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#5d75ff',
    onPrimary: '#101014',
    secondary: '#ff7938',
    onSecondary: '#17110d',
    background: '#101014',
    onBackground: '#f5f3ef',
    surface: '#19191f',
    onSurface: '#f5f3ef',
    surfaceVariant: '#222229',
    onSurfaceVariant: '#aaa9b2',
    primaryContainer: '#29366f',
    onPrimaryContainer: '#e3e8ff',
    secondaryContainer: '#4c291d',
    onSecondaryContainer: '#ffe1d2',
    outline: '#464650',
    outlineVariant: '#303039',
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar style="light" />
            <NavigationBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="concert/[id]" />
              <Stack.Screen name="ticket/[id]" />
              <Stack.Screen name="order/[id]" />
            </Stack>
          </SafeAreaView>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
