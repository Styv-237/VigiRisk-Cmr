import '@/lib/i18n';

import { Inter_200ExtraLight, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { PlaceContext, loadPlace, savePlace, type Place } from '@/lib/data';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, networkMode: 'offlineFirst' } },
});

// Cache persistant : les dernières prévisions restent lisibles sans réseau.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'vigirisk.cache.v1', throttleTime: 2000 });

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg0, card: colors.bg1, text: colors.text, primary: colors.accent200 } };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_200ExtraLight, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [place, setPlaceState] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadPlace().then((p) => {
      setPlaceState(p);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && ready) SplashScreen.hideAsync();
  }, [fontsLoaded, ready]);

  const setPlace = useCallback((p: Place) => {
    setPlaceState(p);
    savePlace(p);
  }, []);
  const ctx = useMemo(() => ({ place, setPlace, ready }), [place, setPlace, ready]);

  if (!fontsLoaded || !ready) return null;

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 7 * 24 * 3_600_000 }}>
      <PlaceContext.Provider value={ctx}>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg0 } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="communes" options={{ presentation: 'modal' }} />
            <Stack.Screen name="sources" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </PlaceContext.Provider>
    </PersistQueryClientProvider>
  );
}
