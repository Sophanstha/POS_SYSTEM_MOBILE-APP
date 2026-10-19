import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

/** Space kept between the field being typed in and the keyboard. */
const MARGIN = 16;
const isAndroid = Platform.OS === "android";

/** Top of the keyboard on screen, from a keyboard event or the current metrics. */
function keyboardTopOf(metrics: { screenY: number; height: number } | undefined): number | null {
  if (!metrics || metrics.height <= 0) return null;
  return metrics.screenY > 0 ? metrics.screenY : Dimensions.get("window").height - metrics.height;
}

/**
 * A ScrollView for forms on Android: scrolls the field being typed in into view above the
 * keyboard (also when moving to the next field). It measures where the keyboard really is,
 * so it only gets shorter if the keyboard still covers part of it (Android normally shrinks
 * the screen itself, then nothing moves). iOS: a plain ScrollView; those screens use
 * KeyboardAvoidingView.
 */
export default function KeyboardAwareScrollView({
  style,
  onScroll,
  onTouchEnd,
  scrollEventThrottle = 32,
  keyboardShouldPersistTaps = "handled",
  ...props
}: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  // How much of this view the keyboard covers (it gets that much shorter).
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);
  liftRef.current = lift;

  /** Scroll so the focused field is fully visible above the keyboard. */
  const reveal = useCallback(() => {
    setTimeout(() => {
      const top = keyboardTop.current;
      const input = TextInput.State.currentlyFocusedInput();
      const node = ref.current?.getNativeScrollRef();
      if (top === null || !input || !node) return;
      node.measureInWindow((sx, sy, sw, sh) => {
        input.measureInWindow((ix, iy, iw, ih) => {
          // Only fields inside this view (e.g. not a search box beside it).
          if (ix + iw < sx || ix > sx + sw) return;
          const visibleBottom = Math.min(sy + sh, top);
          const below = iy + ih + MARGIN - visibleBottom;
          const above = sy - iy + MARGIN;
          if (below > 0) ref.current?.scrollTo({ y: scrollY.current + below, animated: true });
          else if (above > 0) ref.current?.scrollTo({ y: Math.max(0, scrollY.current - above), animated: true });
        });
      });
    }, 150);
  }, []);

  /** Shorten this view by the part the keyboard covers, then reveal the field. */
  const fit = useCallback(() => {
    const top = keyboardTop.current;
    const node = ref.current?.getNativeScrollRef();
    if (top === null || !node) return;
    node.measureInWindow((_x, y, _w, h) => {
      const bottom = y + h + liftRef.current; // where it ends without the lift
      const next = Math.max(0, Math.round(bottom - top));
      if (next !== liftRef.current) setLift(next);
      reveal();
    });
  }, [reveal]);

  useEffect(() => {
    if (!isAndroid) return;
    // Opened while the keyboard is already up.
    if (Keyboard.isVisible()) {
      keyboardTop.current = keyboardTopOf(Keyboard.metrics());
      setTimeout(fit, 0);
    }
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = keyboardTopOf(e.endCoordinates);
      fit();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTop.current = null;
      setLift(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [fit]);

  return (
    <ScrollView
      ref={ref}
      {...props}
      style={[style, lift > 0 ? { marginBottom: lift } : null]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onTouchEnd={(e: GestureResponderEvent) => {
        onTouchEnd?.(e);
        // Tapped into another field while the keyboard is up.
        if (isAndroid && keyboardTop.current !== null) reveal();
      }}
    />
  );
}
