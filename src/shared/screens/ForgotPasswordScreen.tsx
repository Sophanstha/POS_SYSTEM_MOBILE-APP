import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getErrorMessage } from "../api/client";
import FormField from "../components/FormField";
import KeyboardAwareScrollView from "../components/KeyboardAwareScrollView";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme/paperTheme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;
const MIN_PASSWORD = 8;

type Errors = { email?: string; code?: string; password?: string; confirm?: string };

/** Back to the login page under this one. */
function backToLogin() {
  if (router.canGoBack()) router.back();
  else router.replace("/login");
}

/**
 * Forgot password, like the web: 1) enter the email and get a 6-digit code by email,
 * 2) enter the code and a new password, then log in with it.
 */
export default function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const { requestPasswordReset, resetPassword } = useAuth();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const sendCode = useMutation({
    mutationFn: (address: string) => {
      if (!requestPasswordReset) throw new Error("Password reset isn't available for this business.");
      return requestPasswordReset(address);
    },
    onSuccess: (message) => {
      setNotice(`${message} It expires in 10 minutes.`);
      setStep("reset");
    },
  });

  const reset = useMutation({
    mutationFn: (input: { email: string; code: string; password: string }) => {
      if (!resetPassword) throw new Error("Password reset isn't available for this business.");
      return resetPassword(input.email, input.code, input.password);
    },
    onSuccess: () => {
      setDone(true);
      setNotice("Password reset successfully. You can log in with your new password.");
    },
  });

  // Like the web: go back to the login page a moment after the reset.
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(backToLogin, 1800);
    return () => clearTimeout(timer);
  }, [done]);

  const busy = sendCode.isPending || reset.isPending;
  const clear = (field: keyof Errors) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (sendCode.error) sendCode.reset();
    if (reset.error) reset.reset();
  };

  const submitEmail = () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) return setErrors({ email: "Enter a valid email" });
    setErrors({});
    setNotice(null);
    if (!busy) sendCode.mutate(trimmed);
  };

  const submitReset = () => {
    const next: Errors = {};
    if (!CODE_RE.test(code.trim())) next.code = "Enter the 6-digit code from the email";
    if (password.length < MIN_PASSWORD) next.password = `At least ${MIN_PASSWORD} characters`;
    if (confirm !== password) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length || busy) return;
    reset.mutate({ email: email.trim(), code: code.trim(), password });
  };

  const tryAgain = () => {
    setStep("email");
    setCode("");
    setPassword("");
    setConfirm("");
    setErrors({});
    setNotice(null);
    reset.reset();
  };

  const failed = step === "email" ? sendCode.error : reset.error;
  const formError = failed
    ? getErrorMessage(
        failed,
        step === "email"
          ? "Couldn't send the reset code. Please try again."
          : "Couldn't reset the password. Please check your code and try again.",
      )
    : null;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <KeyboardAwareScrollView
            contentContainerClassName="flex-grow justify-center px-6 py-10"
            // Tablet / landscape: a centered form, not stretched across the screen.
            contentContainerStyle={{ width: "100%", maxWidth: 440, alignSelf: "center" }}
            keyboardShouldPersistTaps="handled"
          >
            <Button
              mode="text"
              compact
              icon="arrow-left"
              onPress={backToLogin}
              disabled={busy}
              textColor={theme.colors.onSurfaceVariant}
              labelStyle={{ fontSize: 12, letterSpacing: 2 }}
              style={{ alignSelf: "flex-start", marginBottom: 16 }}
            >
              BACK TO LOGIN
            </Button>

            <Text
              variant="displaySmall"
              accessibilityRole="header"
              style={{ fontWeight: "200", letterSpacing: 2, marginBottom: 12, color: theme.colors.onBackground }}
            >
              {step === "email" ? "RESET PASSWORD" : "ENTER CODE"}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 40 }}>
              {step === "email"
                ? "Enter the email you log in with. We'll send you a 6-digit code."
                : `Enter the code sent to ${email.trim()} and choose a new password.`}
            </Text>

            {notice ? (
              <View
                className="mb-8 flex-row items-start gap-2 rounded-lg p-3"
                style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant }}
              >
                <MaterialCommunityIcons
                  name={done ? "check-circle-outline" : "email-check-outline"}
                  size={18}
                  color={done ? theme.colors.success : theme.colors.onSurfaceVariant}
                />
                <Text variant="bodySmall" style={{ flex: 1, color: theme.colors.onSurface }}>
                  {notice}
                </Text>
              </View>
            ) : null}

            {step === "email" ? (
              <FormField
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clear("email");
                }}
                error={errors.email}
                editable={!busy}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={submitEmail}
              />
            ) : (
              <View className="gap-7">
                <FormField
                  label="Reset code"
                  placeholder="6-digit code"
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.replace(/\D/g, "").slice(0, 6));
                    clear("code");
                  }}
                  error={errors.code}
                  editable={!busy && !done}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  returnKeyType="next"
                />
                <FormField
                  label="New password"
                  placeholder={`At least ${MIN_PASSWORD} characters`}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    clear("password");
                  }}
                  error={errors.password}
                  editable={!busy && !done}
                  password
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="next"
                />
                <FormField
                  label="Confirm password"
                  placeholder="Re-enter the new password"
                  value={confirm}
                  onChangeText={(v) => {
                    setConfirm(v);
                    clear("confirm");
                  }}
                  error={errors.confirm}
                  editable={!busy && !done}
                  password
                  autoCapitalize="none"
                  autoComplete="password-new"
                  textContentType="newPassword"
                  returnKeyType="go"
                  onSubmitEditing={submitReset}
                />
              </View>
            )}

            {formError ? (
              <View className="mt-6 flex-row items-center justify-center gap-2">
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.colors.error} />
                <Text variant="bodyMedium" style={{ flexShrink: 1, color: theme.colors.error }}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={step === "email" ? submitEmail : submitReset}
              loading={busy}
              disabled={busy || done}
              buttonColor={theme.colors.onBackground}
              textColor={theme.colors.background}
              style={{ borderRadius: 0, marginTop: formError ? 16 : 40 }}
              contentStyle={{ height: 56 }}
              labelStyle={{ fontSize: 14, letterSpacing: 3 }}
            >
              {step === "email" ? "SEND RESET CODE" : "RESET PASSWORD"}
            </Button>

            {step === "reset" && !done ? (
              <Button
                mode="text"
                compact
                onPress={tryAgain}
                disabled={busy}
                textColor={theme.colors.onSurfaceVariant}
                labelStyle={{ fontSize: 12 }}
                style={{ alignSelf: "center", marginTop: 16 }}
              >
                Didn't get a code? Try again
              </Button>
            ) : null}
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
