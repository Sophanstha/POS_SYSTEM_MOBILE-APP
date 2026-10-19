import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import type { Cart, CartLine } from "../../hooks/useCart";
import KeyboardAwareScrollView from "../../../../shared/components/KeyboardAwareScrollView";
import { useLayout } from "../../../../shared/hooks/useLayout";
import { useOutlet } from "../../hooks/useMenu";
import { calcTotals, formatRs, outletTaxRate } from "../../lib/pos";
import { useWebPalette, type WebPalette } from "../../theme/webPalette";
import type { CustomerDetails } from "./CartSheet";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type ActiveOrderPanelProps = {
  cart: Cart;
  customer: CustomerDetails;
  onCustomerChange: (next: CustomerDetails) => void;
  submitLabel: string;
  submitIcon: IconName;
  submitting: boolean;
  onSubmit: () => void;
};

/** Below this height (phone in landscape) the whole panel scrolls instead of pinning the footer. */
const SHORT_SCREEN = 520;

/**
 * The web's "Active Order" sidebar: items with − qty +, tap an item for its kitchen note,
 * customer, totals and the big action button. Green in light theme, black in dark.
 */
export default function ActiveOrderPanel({
  cart,
  customer,
  onCustomerChange,
  submitLabel,
  submitIcon,
  submitting,
  onSubmit,
}: ActiveOrderPanelProps) {
  const s = useWebPalette().sidebar;
  const { height } = useLayout();
  const outlet = useOutlet();
  const taxRate = outletTaxRate(outlet.data);
  const totals = calcTotals(cart.subtotal, taxRate);
  const [noteKey, setNoteKey] = useState<string | null>(null);

  const header = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Text style={{ color: s.text, fontSize: 18, fontWeight: "700", letterSpacing: 0.3 }}>Active Order</Text>
        {cart.itemCount > 0 ? (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: s.surface2 }}>
            <Text style={{ color: s.accent, fontSize: 12, fontWeight: "700" }}>{cart.itemCount}</Text>
          </View>
        ) : null}
      </View>
      {cart.lines.length > 0 ? (
        <Pressable onPress={cart.clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear order" className="rounded-lg p-1.5 active:opacity-60">
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={s.muted} />
        </Pressable>
      ) : null}
    </View>
  );

  const items =
    cart.lines.length === 0 ? (
      <View className="items-center justify-center gap-2 py-8">
        <MaterialCommunityIcons name="cart-outline" size={40} color={s.faint} />
        <Text style={{ color: s.faint, fontSize: 14, fontWeight: "500" }}>Cart is empty</Text>
      </View>
    ) : (
      <View className="gap-2">
        {cart.lines.map((line) => (
          <OrderLine
            key={line.key}
            line={line}
            s={s}
            noteOpen={noteKey === line.key}
            onToggleNote={() => setNoteKey(noteKey === line.key ? null : line.key)}
            onDecrement={() => cart.decrement(line.key)}
            onIncrement={() => cart.increment(line.key)}
            onNote={(note) => cart.setNote(line.key, note)}
          />
        ))}
      </View>
    );

  const footer = (
    <View className="gap-3 pt-4" style={{ borderTopWidth: 1, borderColor: s.border }}>
      <View className="gap-2">
        <Field s={s} placeholder="Customer name (optional)" value={customer.customerName} onChangeText={(customerName) => onCustomerChange({ ...customer, customerName })} />
        <Field
          s={s}
          placeholder="Phone number (optional)"
          keyboardType="phone-pad"
          value={customer.customerPhone}
          onChangeText={(customerPhone) => onCustomerChange({ ...customer, customerPhone })}
        />
      </View>

      <View className="gap-1.5">
        <TotalRow s={s} label="Subtotal" value={formatRs(totals.subtotal)} />
        <TotalRow s={s} label={`${outlet.data?.taxName ?? "Tax"} (${taxRate}%)`} value={formatRs(totals.tax)} />
        <View className="mt-1 flex-row items-center justify-between pt-2" style={{ borderTopWidth: 1, borderColor: s.border }}>
          <Text style={{ color: s.text, fontSize: 15, fontWeight: "700" }}>Total</Text>
          <Text style={{ color: s.text, fontSize: 20, fontWeight: "800" }}>{formatRs(totals.total)}</Text>
        </View>
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={submitting || cart.lines.length === 0}
        accessibilityRole="button"
        className="flex-row items-center justify-center gap-2 rounded-xl active:opacity-80"
        style={{ height: 50, backgroundColor: s.accent, opacity: submitting || cart.lines.length === 0 ? 0.4 : 1 }}
      >
        {submitting ? (
          <ActivityIndicator color={s.accentText} />
        ) : (
          <MaterialCommunityIcons name={submitIcon} size={18} color={s.accentText} />
        )}
        <Text style={{ color: s.accentText, fontSize: 15, fontWeight: "800" }}>{submitting ? "Placing order…" : submitLabel}</Text>
      </Pressable>
    </View>
  );

  // Phone in landscape: everything scrolls together so the button is always reachable.
  if (height < SHORT_SCREEN) {
    return (
      <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerClassName="gap-4 p-4" keyboardShouldPersistTaps="handled">
        {header}
        {items}
        {footer}
      </KeyboardAwareScrollView>
    );
  }

  return (
    <View className="flex-1 gap-4 p-5">
      {header}
      <KeyboardAwareScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {items}
      </KeyboardAwareScrollView>
      {footer}
    </View>
  );
}

type OrderLineProps = {
  line: CartLine;
  s: WebPalette["sidebar"];
  noteOpen: boolean;
  onToggleNote: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onNote: (note: string) => void;
};

/** One item: − qty + on the left, name / size / note, price on the right. Tap to add a note. */
function OrderLine({ line, s, noteOpen, onToggleNote, onDecrement, onIncrement, onNote }: OrderLineProps) {
  return (
    <Pressable
      onPress={onToggleNote}
      accessibilityHint="Add a note for the kitchen"
      className="gap-2 rounded-xl p-3"
      style={{ backgroundColor: s.surface, borderWidth: 1, borderColor: s.border }}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="flex-row items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: s.surface2, borderWidth: 1, borderColor: s.border }}>
            <StepButton s={s} label="−" onPress={onDecrement} accessibilityLabel={`Remove one ${line.name}`} />
            <Text style={{ color: s.text, fontSize: 12, fontWeight: "700", minWidth: 16, textAlign: "center" }}>{line.quantity}</Text>
            <StepButton s={s} label="+" onPress={onIncrement} accessibilityLabel={`Add one ${line.name}`} />
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} style={{ color: s.text, fontSize: 13, fontWeight: "600" }}>
              {line.name}
            </Text>
            {line.variantLabel ? (
              <View className="mt-0.5 self-start rounded px-1.5" style={{ backgroundColor: s.surface2 }}>
                <Text style={{ color: s.accent, fontSize: 10, fontWeight: "700" }}>{line.variantLabel}</Text>
              </View>
            ) : null}
            {line.note && !noteOpen ? (
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11, fontStyle: "italic", marginTop: 2 }}>
                “{line.note}”
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={{ color: s.text, fontSize: 13, fontWeight: "700" }}>{formatRs(line.unitPrice * line.quantity)}</Text>
      </View>

      {noteOpen ? (
        <View className="gap-1 pt-1" style={{ borderTopWidth: 1, borderColor: s.border }}>
          <Text style={{ color: s.muted, fontSize: 11, fontWeight: "600" }}>Item instructions</Text>
          <TextInput
            autoFocus
            value={line.note}
            onChangeText={onNote}
            placeholder="No spicy, extra cheese, etc..."
            placeholderTextColor={s.faint}
            style={{
              color: s.text,
              backgroundColor: s.surface2,
              borderWidth: 1,
              borderColor: s.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              fontSize: 12,
            }}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

function StepButton({ s, label, onPress, accessibilityLabel }: { s: WebPalette["sidebar"]; label: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="h-7 w-7 items-center justify-center rounded-md active:opacity-60"
    >
      <Text style={{ color: s.muted, fontSize: 15, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Field({ s, ...props }: { s: WebPalette["sidebar"] } & ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={s.muted}
      {...props}
      style={{
        color: s.text,
        backgroundColor: s.surface,
        borderWidth: 1,
        borderColor: s.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 13,
      }}
    />
  );
}

function TotalRow({ s, label, value }: { s: WebPalette["sidebar"]; label: string; value: ReactNode }) {
  return (
    <View className="flex-row justify-between">
      <Text style={{ color: s.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: s.text, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}
