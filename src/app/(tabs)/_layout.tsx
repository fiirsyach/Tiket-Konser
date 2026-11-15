import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const icons = {
  index: 'home-variant-outline',
  explore: 'magnify',
  tickets: 'ticket-confirmation-outline',
  profile: 'account-circle-outline',
  workspace: 'view-dashboard-outline',
} as const;

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons name={icons[route.name as keyof typeof icons] || 'circle-outline'} size={size} color={color} />
        ),
      })}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="explore" options={{ title: 'Jelajahi' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tiket' }} />
      <Tabs.Screen name="workspace" options={{ title: 'Panel' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
