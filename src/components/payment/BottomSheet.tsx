import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { IconButton, Modal, Portal, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../../theme/paperTheme";

type BottomSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  /** False while a payment is being sent, so it can't be closed half-way. */
  dismissable?: boolean;
  children: ReactNode;
};

/** Panel that slides up from the bottom — used by every payment screen. */
export default function BottomSheet({ visible, onDismiss, title, subtitle, dismissable = true, children }: BottomSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={dismissable}
        dismissableBackButton={dismissable}
        contentContainerStyle={{
          backgroundColor: theme.colors.surface,
          marginTop: "auto",
          maxHeight: "92%",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: insets.bottom + 12,
        }}
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