// import { Pressable, Text, View } from "react-native";

// type AuthHeaderProps = {
//   active: "login" | "signup";
//   onLoginPress?: () => void;
//   onSignUpPress?: () => void;
// };

// export default function AuthHeader({ active, onLoginPress, onSignUpPress }: AuthHeaderProps) {
//   return (
//     <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
//       <View>
//         <Text className="text-lg font-extrabold tracking-wide text-foreground">ABSTRAKT</Text>
//         <Text className="text-[10px] text-foreground-secondary">Management System</Text>
//       </View>

//       <View className="flex-row items-center gap-3">
//         <Pressable onPress={onLoginPress} hitSlop={8} accessibilityRole="button">
//           <Text
//             className={`text-xs font-semibold ${
//               active === "login" ? "text-foreground" : "text-foreground-secondary"
//             }`}
//           >
//             Login
//           </Text>
//         </Pressable>
//         <Pressable
//           onPress={onSignUpPress}
//           accessibilityRole="button"
//           className="rounded-full border border-foreground px-3 py-1.5 active:bg-muted"
//         >
//           <Text className="text-xs font-semibold text-foreground">Sign Up</Text>
//         </Pressable>
//       </View>
//     </View>
//   );
// }
