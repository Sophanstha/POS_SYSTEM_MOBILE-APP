import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import FormField from "../components/FormField";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { useChangeBusiness } from "../hooks/useChangeBusiness";
import { useAppTheme } from "../theme/paperTheme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginScreenProps = {
  onForgotPassword?: () => void;
};

export default function LoginScreen({ onForgotPassword }: LoginScreenProps) {
  const theme = useAppTheme();
  const { login, requestPasswordReset } = useAuth();
  const { info } = useSystem();
  const changeBusiness = useChangeBusiness();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      login(credentials.email, credentials.password),
  });

  const handleLogin = () => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length || loginMutation.isPending) return;

    loginMutation.mutate({ email: email.trim(), password });
  };

  const formError = loginMutation.error
    ? getErrorMessage(loginMutation.error, "Invalid email or password")
    : null;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <KeyboardAwareScrollView
            contentContainerClassName="flex-grow justify-center px-6 py-10"
            // Tablet / landscape: a centered form, not stretched across the screen.
            contentContainerStyle={{ width: "100%", maxWidth: 440, alignSelf: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Which business this login is for. */}
            {info ? (
              <View className="mb-8 items-center gap-2">
                <View
                  className="h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: info.brand ?? theme.colors.surfaceVariant }}
                >
                  <MaterialCommunityIcons
                    name={info.icon}
                    size={28}
                    color={info.brand ? "#ffffff" : theme.colors.onSurfaceVariant}
                  />
                </View>
                <Text variant="titleMedium" style={{ fontWeight: "700", color: theme.colors.onBackground }}>
                  {info.name}
                </Text>
                <Text variant="bodySmall" style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}>
                  {info.description}
                </Text>
              </View>
            ) : null}

            <Text
              variant="displayMedium"
              style={{
                textAlign: "center",
                fontWeight: "200",
                letterSpacing: 2,
                marginBottom: 56,
                color: theme.colors.onBackground,
              }}
            >
              LOGIN
            </Text>

            <View className="gap-7">
              <FormField
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                  if (loginMutation.error) loginMutation.reset();
                }}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
              />

              <FormField
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                  if (loginMutation.error) loginMutation.reset();
                }}
                error={errors.password}
                password
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Only when this business's backend has a password reset. */}
            {onForgotPassword && requestPasswordReset ? (
              <Button
                mode="text"
                compact
                onPress={onForgotPassword}
                disabled={loginMutation.isPending}
                textColor={theme.colors.onSurfaceVariant}
                labelStyle={{ fontSize: 12 }}
                style={{ alignSelf: "flex-end", marginTop: 8 }}
              >
                Forgot password?
              </Button>
            ) : null}

            {formError ? (
              <View className="mt-6 flex-row items-center justify-center gap-2">
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={16}
                  color={theme.colors.error}
                />
                <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loginMutation.isPending}
              disabled={loginMutation.isPending}
              buttonColor={theme.colors.onBackground}
              textColor={theme.colors.background}
              style={{ borderRadius: 0, marginTop: formError ? 16 : 40 }}
              contentStyle={{ height: 56 }}
              labelStyle={{ fontSize: 14, letterSpacing: 3 }}
            >
              LOGIN
            </Button>

            {/* Back to "What is your business?" (the choose screen opens by itself). */}
            {info ? (
              <Button
                mode="text"
                compact
                icon="swap-horizontal"
                onPress={changeBusiness}
                disabled={loginMutation.isPending}
                textColor={theme.colors.onSurfaceVariant}
                labelStyle={{ fontSize: 12 }}
                style={{ alignSelf: "center", marginTop: 24 }}
              >
                {`Not ${info.name}? Change business`}
              </Button>
            ) : null}
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
