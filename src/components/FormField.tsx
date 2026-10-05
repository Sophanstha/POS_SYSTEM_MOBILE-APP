import { useState } from "react";
import { View } from "react-native";
import { HelperText, Text, TextInput, type TextInputProps } from "react-native-paper";

import { useAppTheme } from "../theme/paperTheme";

type FormFieldProps = Omit<TextInputProps, "label" | "error" | "mode" | "right"> & {
  label: string;
  error?: string;
  /** Adds an eye button to show/hide the value. */
  password?: boolean;
};

/** Spaced uppercase label + underline-only Paper input, like the web login. */
export default function FormField({ label, error, password, style, ...inputProps }: FormFieldProps) {
  const theme = useAppTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <Text
        variant="labelSmall"
        style={{ letterSpacing: 3, color: theme.colors.onSurfaceVariant }}
      >
        {label.toUpperCase()}
      </Text>

      <TextInput
        {...inputProps}
        mode="flat"
        dense
        error={!!error}
        secureTextEntry={password ? hidden : inputProps.secureTextEntry}
        underlineColor={theme.colors.outlineVariant}
        activeUnderlineColor={theme.colors.onBackground}
        placeholderTextColor={theme.colors.outline}
        textColor={theme.colors.onBackground}
        style={[{ backgroundColor: "transparent" }, style]}
        contentStyle={{ paddingHorizontal: 0 }}
        right={
          password ? (
            <TextInput.Icon
              icon={hidden ? "eye-outline" : "eye-off-outline"}
              color={theme.colors.onSurfaceVariant}
              onPress={() => setHidden((h) => !h)}
              forceTextInputFocus={false}
              accessibilityLabel={hidden ? "Show password" : "Hide password"}
            />
          ) : undefined
        }
      />

      {error ? (
        <HelperText type="error" padding="none">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}
