import { Stack } from "expo-router";
import type { ComponentProps } from "react";

import { useAppTheme } from "../theme/paperTheme";

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

/** Native stack header + background in the POS theme colours. */
export function useStackScreenOptions(): StackScreenOptions {
  const theme = useAppTheme();

  return {
    contentStyle: { backgroundColor: theme.colors.background },
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.onBackground,
    headerTitleStyle: { fontWeight: "600" },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
  };
}