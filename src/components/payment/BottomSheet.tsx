import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View, type ViewStyle } from "react-native";
import { IconButton, Modal, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLayout } from "../../hooks/useLayout";
import { useAppTheme } from "../../theme/paperTheme";

/** Widest a sheet gets when it shows as a centered dialog. */
const DIALOG_MAX_WIDTH = 520;

/**
 * Phone in portrait: a panel that slides up from the bottom.
 * Landscape / tablet: a centered dialog, so it doesn't stretch across the whole screen.
 */
export function useSheetStyle(maxHeight: ViewStyle["maxHeight"] = "92%"): ViewStyle {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();

  if (isWide) {
    return {
      backgroundColor: theme.colors.surface,
      alignSelf: "center",
      width: "100%",
      maxWidth: DIALOG_MAX_WIDTH,
      maxHeight: "94%",
      borderRadius: 20,
      paddingBottom: 12,
    };
  }
  return {
    backgroundColor: theme.colors.surface,
    marginTop: "auto",
    maxHeight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: insets.bottom + 12,
  };
}

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  /** False while a payment is being sent, so it can't be closed half-way. */
  dismissable?: boolean;
  children: ReactNode;
};

/** Panel used by every payment screen (bottom sheet on phones, dialog on wide screens). */
export default function BottomSheet({ visible, onDismiss, title, subtitle, dismissable = true, children }: BottomSheetProps) {
  const theme = useAppTheme();
  const sheetStyle = useSheetStyle();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
        dismissableBackButton={dismissable}
        contentContainerStyle={sheetStyle}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flexShrink: 1 }}>
          <View className="flex-row items-center justify-between pl-4 pt-3">
            <View className="flex-1">
              <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontWeight: "700" }}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <IconButton icon="close" onPress={onDismiss} disabled={!dismissable} accessibilityLabel="Close" />
          </View>
          {children}
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}
