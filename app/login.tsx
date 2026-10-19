import { router } from "expo-router";

import LoginScreen from "../src/shared/screens/LoginScreen";


export default function Login() {
  return <LoginScreen onForgotPassword={() => router.push("/forgot-password")} />;
}