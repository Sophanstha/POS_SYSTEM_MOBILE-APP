import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Height of the on-screen keyboard (0 when hidden).
 * iOS covers the screen with the keyboard, so dialogs use this to move up above it;
 * Android shrinks the screen by itself, so nothing should be moved up there.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS: "will" events move together with the keyboard animation.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
