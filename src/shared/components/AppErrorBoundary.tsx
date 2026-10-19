import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SplashScreen } from "expo-router";
import { Component, Fragment, useEffect, type ErrorInfo, type ReactNode } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/paperTheme";

type Props = { children: ReactNode };
type State = { error: Error | null; attempt: number };

/** Catches a crash in any screen and shows "Something went wrong" instead of a blank app. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} onRetry={this.retry} />;
    // A new key mounts the screens again from scratch after "Try again".
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const theme = useAppTheme();

  // It may have crashed before the splash screen went away.
  useEffect(() => {
    SplashScreen.hide();
  }, []);

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View
            className="h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.errorContainer }}
          >
            <MaterialCommunityIcons name="alert-octagon-outline" size={40} color={theme.colors.error} />
          </View>
          <Text
            variant="headlineSmall"
            style={{ color: theme.colors.onBackground, fontWeight: "700", textAlign: "center" }}
          >
            Something went wrong
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            This screen stopped working. Orders and payments already sent are saved on the server.
          </Text>
          {__DEV__ ? (
            <Text
              variant="bodySmall"
              selectable
              numberOfLines={6}
              style={{ color: theme.colors.error, textAlign: "center", fontFamily: "monospace" }}
            >
              {error.message}
            </Text>
          ) : null}
          <Button
            mode="contained"
            icon="refresh"
            onPress={onRetry}
            style={{ alignSelf: "stretch", marginTop: 8 }}
            contentStyle={{ height: 48 }}
          >
            Try again
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}