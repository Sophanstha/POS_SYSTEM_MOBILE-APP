import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Modal, Portal } from "react-native-paper";
import { DatePickerModal, en, registerTranslation } from "react-native-paper-dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { useLayout } from "../hooks/useLayout";
import { toDateParam } from "../lib/date";
import { useDashboardPalette } from "../theme/dashboardPalette";

registerTranslation("en", en);

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Width of the fixed menu on wide screens (AdminShell). */
const SIDEBAR_WIDTH = 256;

/** Room next to the menu: decides how many cards fit in a row. */
export function useAdminContentWidth(): number {
  const { width, isWide } = useLayout();
  return width - (isWide ? SIDEBAR_WIDTH : 0);
}

/** Green page header like the web ("Orders", "Payment Ledger"…). */
export function AdminHero({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const d = useDashboardPalette();
  return (
    <View className="gap-4 rounded-xl px-6 py-5" style={{ backgroundColor: d.hero.bg, elevation: 1 }}>
      <View>
        <Text style={{ color: d.hero.text, fontSize: 22, fontWeight: "600" }}>{title}</Text>
        {subtitle ? <Text style={{ color: d.hero.sub, fontSize: 13, marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export type StatTone = "emerald" | "blue" | "amber" | "slate" | "red";

/** Number card with a coloured left edge and icon tile. `basis` sets how much of the row it takes. */
export function AdminStat({
  tone,
  icon,
  label,
  value,
  basis,
}: {
  tone: StatTone;
  icon: IconName;
  label: string;
  value: string;
  basis: `${number}%`;
}) {
  const d = useDashboardPalette();
  const c = d[tone];
  return (
    <View
      className="flex-row items-center justify-between gap-2 rounded-xl p-4"
      style={{
        flexGrow: 1,
        flexBasis: basis,
        backgroundColor: d.card,
        borderWidth: 1,
        borderColor: d.border,
        borderLeftWidth: 4,
        borderLeftColor: c.edge,
      }}
    >
      <View className="flex-1">
        <Text numberOfLines={1} style={{ color: d.muted, fontSize: 10, fontWeight: "500", letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: d.text, fontSize: 24, fontWeight: "700", marginTop: 4 }}>
          {value}
        </Text>
      </View>
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: c.tile }}>
        <MaterialCommunityIcons name={icon} size={20} color={c.icon} />
      </View>
    </View>
  );
}

/** Search box with a clear (✕) button. */
export function AdminSearch({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const d = useDashboardPalette();
  return (
    <View
      className="flex-row items-center gap-2 rounded-lg px-3.5"
      style={{ backgroundColor: d.input.bg, borderWidth: 1, borderColor: d.input.border }}
    >
      <MaterialCommunityIcons name="magnify" size={18} color={d.input.placeholder} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={d.input.placeholder}
        autoCorrect={false}
        style={{ flex: 1, color: d.input.text, fontSize: 14, paddingVertical: 10 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} accessibilityLabel="Clear search" hitSlop={8}>
          <MaterialCommunityIcons name="close-circle" size={16} color={d.input.placeholder} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Row of filter buttons (scrolls sideways when they don't fit). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const d = useDashboardPalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-row items-center gap-1.5 rounded-lg px-3 py-2 active:opacity-70"
            style={{
              backgroundColor: active ? d.chip.activeBg : d.chip.idleBg,
              borderWidth: 1,
              borderColor: active ? d.chip.activeBg : d.chip.border,
            }}
          >
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={14} color={active ? d.chip.activeText : d.chip.idleText} /> : null}
            <Text style={{ color: active ? d.chip.activeText : d.chip.idleText, fontSize: 12, fontWeight: "600" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Centered message for empty lists and load errors. */
export function AdminEmpty({ icon, text, error }: { icon: IconName; text: string; error?: boolean }) {
  const d = useDashboardPalette();
  return (
    <View className="items-center gap-2 py-14">
      <MaterialCommunityIcons name={icon} size={32} color={error ? d.error.text : d.muted} style={{ opacity: error ? 1 : 0.5 }} />
      <Text style={{ color: error ? d.error.text : d.muted, fontSize: 13, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

/**
 * Under a list that loads as you scroll (usePagedList): "Showing 20 of 230 · Show more"
 * (tap works too, e.g. when the rows don't fill the screen), then "All 230 shown".
 * Nothing for short lists.
 */
export function PageFooter({
  shown,
  total,
  hasMore,
  onMore,
  noun = "items",
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  onMore: () => void;
  /** What the rows are: "payments", "orders"… */
  noun?: string;
}) {
  const d = useDashboardPalette();
  if (total === 0 || (!hasMore && shown <= 20)) return null;

  if (!hasMore) {
    return (
      <View className="flex-row items-center justify-center gap-1.5 py-4">
        <MaterialCommunityIcons name="check-all" size={14} color={d.muted} />
        <Text style={{ color: d.muted, fontSize: 12 }}>
          All {total} {noun} shown
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`Showing ${shown} of ${total} ${noun}. Show more`}
      className="flex-row items-center justify-center gap-1.5 py-4 active:opacity-60"
    >
      <Text style={{ color: d.muted, fontSize: 12 }}>
        Showing {shown} of {total} {noun} ·
      </Text>
      <Text style={{ color: d.link, fontSize: 12, fontWeight: "700" }}>Show more</Text>
      <MaterialCommunityIcons name="chevron-down" size={16} color={d.link} />
    </Pressable>
  );
}

// ── Buttons, dialogs and form fields (Staff, Tables…) ──

type ButtonVariant = "primary" | "outline" | "danger";

/** Small web-style button: green (primary), white with border (outline) or red (danger). */
export function AdminButton({
  label,
  icon,
  variant = "outline",
  loading,
  disabled,
  grow,
  onPress,
}: {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  /** Share the row's width with the other buttons. */
  grow?: boolean;
  onPress: () => void;
}) {
  const d = useDashboardPalette();
  const bg = variant === "primary" ? d.hero.bg : variant === "danger" ? d.red.edge : d.input.bg;
  const color = variant === "outline" ? d.sub : "#ffffff";
  const off = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      className="flex-row items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 active:opacity-70"
      style={{
        flexGrow: grow ? 1 : 0,
        flexBasis: grow ? 0 : "auto",
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: variant === "outline" ? d.border : bg,
        opacity: off ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size={14} color={color} />
      ) : icon ? (
        <MaterialCommunityIcons name={icon} size={16} color={color} />
      ) : null}
      <Text numberOfLines={1} style={{ color, fontSize: 13, fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Red box for an error inside a dialog or above a list. */
export function AdminError({ text }: { text: string }) {
  const d = useDashboardPalette();
  return (
    <View className="rounded-lg px-4 py-3" style={{ backgroundColor: d.error.bg, borderWidth: 1, borderColor: d.error.border }}>
      <Text style={{ color: d.error.text, fontSize: 13 }}>{text}</Text>
    </View>
  );
}

/** Inside a dialog: scrolls the field being typed in above the keyboard. */
const RevealFocusedInput = createContext<() => void>(() => {});

/** For custom inputs inside AdminDialog: call it from onFocus (AdminField already does). */
export const useRevealFocusedInput = () => useContext(RevealFocusedInput);

/** Screens with forms (Settings) give their own "scroll to the focused field" here. */
export const RevealFocusedInputProvider = RevealFocusedInput.Provider;

/** Space kept between the field being typed in and the edge of the form. */
const REVEAL_MARGIN = 16;

/**
 * Web-style form dialog: green header with icon and title, the form, then Cancel + save.
 * `danger` adds a red link under the form (e.g. "Delete table").
 */
export function AdminDialog({
  visible,
  onDismiss,
  icon,
  title,
  error,
  busy,
  submitLabel,
  onSubmit,
  danger,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  icon: IconName;
  title: string;
  error?: string | null;
  /** Saving: the dialog can't be closed and the save button spins. */
  busy?: boolean;
  submitLabel: string;
  onSubmit: () => void;
  danger?: { label: string; icon: IconName; onPress: () => void };
  children: ReactNode;
}) {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  // iOS: move above the keyboard. Android shrinks the screen for the keyboard by itself,
  // so moving the dialog there too would push it up twice.
  const bottomSpace = Platform.OS === "ios" && keyboard > 0 ? keyboard + 8 : insets.bottom;

  /** Once the dialog has moved up, scroll so the focused field is fully visible. */
  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      const scrollNode = scroll?.getNativeScrollRef();
      if (!input || !scroll || !scrollNode) return;
      scrollNode.measureInWindow((_sx, sy, _sw, sh) => {
        input.measureInWindow((_ix, iy, _iw, ih) => {
          const hiddenBelow = iy + ih + REVEAL_MARGIN - (sy + sh);
          const hiddenAbove = sy - iy + REVEAL_MARGIN;
          if (hiddenBelow > 0) scroll.scrollTo({ y: scrollY.current + hiddenBelow, animated: true });
          else if (hiddenAbove > 0) scroll.scrollTo({ y: Math.max(0, scrollY.current - hiddenAbove), animated: true });
        });
      });
    }, 150);
  }, []);

  useEffect(() => {
    if (visible && keyboard > 0) reveal();
  }, [visible, keyboard, reveal]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={!busy}
        dismissableBackButton={!busy}
        // Sits above the keyboard; the form gets shorter and scrolls, Cancel / Save stay visible.
        style={{ paddingHorizontal: 16, marginBottom: bottomSpace }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 480,
          maxHeight: keyboard > 0 ? "100%" : "92%",
          backgroundColor: d.card,
          borderWidth: 1,
          borderColor: d.border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <View className="items-center justify-center px-12 py-5" style={{ backgroundColor: d.hero.bg }}>
            <MaterialCommunityIcons name={icon} size={26} color={d.hero.text} />
            <Text style={{ color: d.hero.text, fontSize: 18, fontWeight: "600", marginTop: 4, textAlign: "center" }}>{title}</Text>
            <View className="absolute bottom-0 right-4 top-0 justify-center">
              <Pressable
                onPress={onDismiss}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-md active:opacity-60"
              >
                <MaterialCommunityIcons name="close" size={20} color={d.hero.sub} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ padding: 20, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={32}
          >
            {error ? <AdminError text={error} /> : null}
            <RevealFocusedInput.Provider value={reveal}>{children}</RevealFocusedInput.Provider>
            {danger ? (
              <Pressable
                onPress={danger.onPress}
                disabled={busy}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 self-start py-1 active:opacity-60"
              >
                <MaterialCommunityIcons name={danger.icon} size={16} color={d.error.text} />
                <Text style={{ color: d.error.text, fontSize: 13, fontWeight: "600" }}>{danger.label}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View className="flex-row gap-3 px-5 py-4" style={{ borderTopWidth: 1, borderColor: d.border }}>
            <AdminButton label="Cancel" grow disabled={busy} onPress={onDismiss} />
            <AdminButton label={submitLabel} variant="primary" grow loading={busy} onPress={onSubmit} />
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

/** "Delete Table?" / "Remove Staff Member?" — round icon, message, Cancel + confirm. */
export function ConfirmDialog({
  visible,
  onDismiss,
  icon,
  title,
  message,
  confirmLabel,
  tone = "danger",
  busy,
  onConfirm,
}: {
  visible: boolean;
  onDismiss: () => void;
  icon: IconName;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
}) {
  const d = useDashboardPalette();
  const c = tone === "danger" ? d.red : d.brand;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        dismissable={!busy}
        dismissableBackButton={!busy}
        style={{ paddingHorizontal: 16 }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: 384,
          backgroundColor: d.card,
          borderWidth: 1,
          borderColor: d.border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <View className="items-center gap-3 p-6" style={{ borderBottomWidth: 1, borderColor: d.border }}>
          <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: c.tile }}>
            <MaterialCommunityIcons name={icon} size={24} color={c.icon} />
          </View>
          <Text style={{ color: d.text, fontSize: 16, fontWeight: "600", textAlign: "center" }}>{title}</Text>
          <Text style={{ color: d.sub, fontSize: 13, textAlign: "center" }}>{message}</Text>
        </View>
        <View className="flex-row gap-3 p-5">
          <AdminButton label="Cancel" grow disabled={busy} onPress={onDismiss} />
          <AdminButton label={confirmLabel} variant={tone} grow loading={busy} onPress={onConfirm} />
        </View>
      </Modal>
    </Portal>
  );
}

/** Uppercase label above a form control. */
export function FieldLabel({ children }: { children: string }) {
  const d = useDashboardPalette();
  return (
    <Text style={{ color: d.sub, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
      {children}
    </Text>
  );
}

/** Rounded input with a label; `password` adds the eye button. Border turns green while typing. */
export function AdminField({
  label,
  icon,
  password,
  editable = true,
  ...props
}: Omit<TextInputProps, "style" | "secureTextEntry"> & { label: string; icon?: IconName; password?: boolean }) {
  const d = useDashboardPalette();
  const reveal = useRevealFocusedInput();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View
        className="flex-row items-center gap-2 rounded-lg px-3"
        style={{
          backgroundColor: d.input.bg,
          borderWidth: 1,
          borderColor: focused ? d.hero.bg : d.input.border,
          opacity: editable ? 1 : 0.6,
        }}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={d.input.placeholder} /> : null}
        <TextInput
          {...props}
          editable={editable}
          secureTextEntry={password ? hidden : false}
          onFocus={(e) => {
            setFocused(true);
            reveal();
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={d.input.placeholder}
          style={{ flex: 1, color: d.input.text, fontSize: 14, paddingVertical: 10 }}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={8}
          >
            <MaterialCommunityIcons name={hidden ? "eye-off-outline" : "eye-outline"} size={18} color={d.input.placeholder} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A labelled row of choices (the web's select boxes): role, shape, status… */
export function ChoiceField<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; icon?: IconName; dot?: string }[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const d = useDashboardPalette();
  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled }}
              className="flex-row items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 active:opacity-70"
              style={{
                flexGrow: 1,
                backgroundColor: active ? d.brand.tile : d.input.bg,
                borderWidth: 1,
                borderColor: active ? d.brand.edge : d.input.border,
              }}
            >
              {o.dot ? <View className="h-2 w-2 rounded-full" style={{ backgroundColor: o.dot }} /> : null}
              {o.icon ? <MaterialCommunityIcons name={o.icon} size={15} color={active ? d.link : d.sub} /> : null}
              <Text style={{ color: active ? d.link : d.sub, fontSize: 13, fontWeight: active ? "700" : "500" }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "2026-10-11" → "Oct 11, 2026" (no time-zone shift). */
export function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Labelled date box; tap to pick a day from a calendar. `value` is "2026-10-11". */
export function DateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (day: string) => void;
}) {
  const d = useDashboardPalette();
  const [open, setOpen] = useState(false);
  const [y, m, day] = value.split("-").map(Number);

  return (
    <View>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDay(value)}`}
        className="flex-row items-center gap-2 rounded-lg px-3 py-3 active:opacity-70"
        style={{ backgroundColor: d.input.bg, borderWidth: 1, borderColor: d.input.border, opacity: disabled ? 0.6 : 1 }}
      >
        <MaterialCommunityIcons name="calendar" size={16} color={d.input.placeholder} />
        <Text style={{ flex: 1, color: d.input.text, fontSize: 14 }}>{formatDay(value)}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={d.input.placeholder} />
      </Pressable>
      <DatePickerModal
        locale="en"
        mode="single"
        visible={open}
        date={y && m && day ? new Date(y, m - 1, day) : new Date()}
        onDismiss={() => setOpen(false)}
        onConfirm={({ date }) => {
          setOpen(false);
          if (date) onChange(toDateParam(date));
        }}
      />
    </View>
  );
}

/**
 * Labelled select box (the web's dropdowns) for long lists: tap to open a searchable
 * list right under it, tap an option to choose it.
 */
export function PickerField({
  label,
  placeholder,
  value,
  options,
  icon,
  searchable,
  searchPlaceholder = "Search...",
  disabled,
  emptyText = "Nothing to choose from.",
  onChange,
}: {
  label?: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string; hint?: string; icon?: IconName }[];
  /** Icon at the start of the box. */
  icon?: IconName;
  /** Search box at the top of the list (default: only for more than 6 options). */
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  emptyText?: string;
  onChange: (value: string) => void;
}) {
  const d = useDashboardPalette();
  const reveal = useRevealFocusedInput();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);
  const q = search.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable
        onPress={() => {
          setOpen((o) => !o);
          setSearch("");
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        className="flex-row items-center gap-2 rounded-lg px-3 py-3 active:opacity-70"
        style={{
          backgroundColor: d.input.bg,
          borderWidth: 1,
          borderColor: open ? d.hero.bg : d.input.border,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {icon ? <MaterialCommunityIcons name={icon} size={16} color={d.input.placeholder} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: selected ? d.input.text : d.input.placeholder, fontSize: 14 }}>
          {selected ? selected.label : placeholder}
        </Text>
        {selected?.hint ? <Text style={{ color: d.muted, fontSize: 12 }}>{selected.hint}</Text> : null}
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={d.input.placeholder} />
      </Pressable>

      {open ? (
        <View className="mt-1.5 overflow-hidden rounded-lg" style={{ borderWidth: 1, borderColor: d.border, backgroundColor: d.card }}>
          {(searchable ?? options.length > 6) ? (
            <View className="flex-row items-center gap-2 px-3" style={{ borderBottomWidth: 1, borderColor: d.border }}>
              <MaterialCommunityIcons name="magnify" size={16} color={d.input.placeholder} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                onFocus={reveal}
                placeholder={searchPlaceholder}
                placeholderTextColor={d.input.placeholder}
                autoCorrect={false}
                style={{ flex: 1, color: d.input.text, fontSize: 13, paddingVertical: 8 }}
              />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text style={{ color: d.muted, fontSize: 13, padding: 12 }}>{options.length ? "No matches." : emptyText}</Text>
            ) : (
              shown.map((o) => {
                const active = o.value === value;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className="flex-row items-center gap-2 px-3 py-2.5"
                    style={({ pressed }) => ({ backgroundColor: active ? d.brand.tile : pressed ? d.pressed : "transparent" })}
                  >
                    {o.icon ? <MaterialCommunityIcons name={o.icon} size={15} color={active ? d.link : d.muted} /> : null}
                    <Text numberOfLines={1} style={{ flex: 1, color: active ? d.link : d.title, fontSize: 13, fontWeight: active ? "700" : "500" }}>
                      {o.label}
                    </Text>
                    {o.hint ? <Text style={{ color: d.muted, fontSize: 12 }}>{o.hint}</Text> : null}
                    {active ? <MaterialCommunityIcons name="check" size={16} color={d.link} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/** Small "+ New category" form under a category choice: name box + Add / cancel. */
export function NewCategoryInput({
  busy,
  onAdd,
  onCancel,
}: {
  busy?: boolean;
  onAdd: (name: string) => void;
  onCancel: () => void;
}) {
  const d = useDashboardPalette();
  const reveal = useRevealFocusedInput();
  const [name, setName] = useState("");

  return (
    <View className="mt-2 flex-row items-center gap-2">
      <TextInput
        value={name}
        onChangeText={setName}
        onFocus={reveal}
        autoFocus
        placeholder="New category name"
        placeholderTextColor={d.input.placeholder}
        onSubmitEditing={() => name.trim() && onAdd(name.trim())}
        returnKeyType="done"
        editable={!busy}
        style={{
          flex: 1,
          backgroundColor: d.input.bg,
          borderWidth: 1,
          borderColor: d.hero.bg,
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: d.input.text,
          fontSize: 14,
        }}
      />
      <AdminButton label="Add" icon="check" variant="primary" loading={busy} disabled={!name.trim()} onPress={() => onAdd(name.trim())} />
      <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8} className="p-1 active:opacity-60">
        <MaterialCommunityIcons name="close" size={20} color={d.muted} />
      </Pressable>
    </View>
  );
}
