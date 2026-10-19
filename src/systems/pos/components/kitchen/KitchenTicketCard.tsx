import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from "react-native";

import type { KitchenCard, KitchenMove } from "../../hooks/useKitchen";
import { KDS, useKdsPalette } from "../../theme/kdsPalette";

/** Waiting this long turns a new card red (same as the web). */
export const URGENT_MINUTES = 10;

/** Slight tilt per card, like notes stuck on a board (same angles as the web). */
const ROTATIONS = [-0.8, 0.5, -1.2, 0.9, -0.4, 1.1, -0.6];

function rotationFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return ROTATIONS[Math.abs(hash) % ROTATIONS.length]!;
}

type KitchenTicketCardProps = {
  card: KitchenCard;
  minutes: number;
  /** Has restaurant.kot.update — otherwise the card is read-only. */
  canUpdate: boolean;
  /** This card's change is being saved. */
  busy: boolean;
  onMove: (move: KitchenMove) => void;
};

/** One dish as a sticky note: order #, table / take away, timer, dish, note, qty, Start / Done / Undo. */
export default function KitchenTicketCard({ card, minutes, canUpdate, busy, onMove }: KitchenTicketCardProps) {
  const k = useKdsPalette();
  const late = minutes >= URGENT_MINUTES;
  const tone =
    card.stage === "ready" ? k.note.ready : card.stage === "preparing" ? k.note.preparing : late ? k.note.urgent : k.note.new;

  return (
    <View
      style={{
        transform: [{ rotate: `${rotationFor(card.kotItemId)}deg` }],
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.border,
        borderRadius: 12,
        overflow: "hidden",
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 2, height: 4 },
      }}
    >
      {/* "Tape" strip */}
      <View style={{ height: 8, backgroundColor: tone.tape }} />
      {card.stage === "preparing" ? <PreparingBar /> : null}

      <View className="flex-row items-center justify-between gap-2 px-3.5 pb-2.5 pt-3" style={{ borderBottomWidth: 1, borderColor: k.divider }}>
        <View className="flex-1 flex-row items-center gap-1.5">
          <Text style={{ color: k.noteTitle, fontSize: 15, fontWeight: "900" }}>#{card.orderNumber}</Text>
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              borderWidth: 1,
              backgroundColor: card.isTakeaway ? "rgba(229,184,59,0.1)" : "rgba(59,130,246,0.1)",
              borderColor: card.isTakeaway ? "rgba(229,184,59,0.25)" : "rgba(59,130,246,0.25)",
            }}
          >
            <Text numberOfLines={1} style={{ color: card.isTakeaway ? KDS.gold : KDS.dineInText, fontSize: 10, fontWeight: "700" }}>
              {card.label}
            </Text>
          </View>
        </View>
        <Text style={{ color: late ? KDS.red : k.muted, fontSize: 11, fontWeight: "700" }}>
          {late ? `⚠ ${minutes}m` : `${minutes}m`}
        </Text>
      </View>

      <View className="flex-row items-start gap-2 px-3.5 py-2.5">
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={3} style={{ color: k.noteText, fontSize: 14, fontWeight: "600" }}>
            {card.name}
          </Text>
          {card.notes ? (
            <Text numberOfLines={3} style={{ color: KDS.red, fontSize: 12, fontStyle: "italic" }}>
              {card.notes}
            </Text>
          ) : null}
        </View>
        <View className="rounded px-2 py-0.5" style={{ backgroundColor: k.qty.bg, borderWidth: 1, borderColor: k.qty.border }}>
          <Text style={{ color: k.qty.text, fontSize: 13, fontWeight: "800" }}>x{card.quantity}</Text>
        </View>
      </View>

      {canUpdate ? (
        <View className="flex-row gap-2 px-3 pb-3 pt-1">
          {card.stage === "ready" ? (
            <>
              <View
                className="flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2"
                style={{ backgroundColor: k.readyButton.bg, borderWidth: 1, borderColor: k.readyButton.border }}
              >
                <MaterialCommunityIcons name="check" size={14} color={k.readyButton.text} />
                <Text style={{ color: k.readyButton.text, fontSize: 12, fontWeight: "700" }}>Ready</Text>
              </View>
              <CardButton
                label="Undo"
                icon="undo-variant"
                busy={busy}
                onPress={() => onMove("undo")}
                bg={k.startButton.bg}
                border={k.startButton.border}
                color={k.startButton.text}
              />
            </>
          ) : (
            <>
              {card.stage === "preparing" ? (
                <View className="flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2" style={{ backgroundColor: KDS.blue }}>
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>● Preparing</Text>
                </View>
              ) : (
                <CardButton
                  label="Start"
                  busy={busy}
                  onPress={() => onMove("start")}
                  bg={k.startButton.bg}
                  border={k.startButton.border}
                  color={k.startButton.text}
                />
              )}
              <CardButton label="Done" busy={busy} onPress={() => onMove("done")} bg={KDS.green} border={KDS.green} color={k.doneText} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function CardButton({
  label,
  icon,
  busy,
  onPress,
  bg,
  border,
  color,
}: {
  label: string;
  icon?: "undo-variant";
  busy: boolean;
  onPress: () => void;
  bg: string;
  border: string;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className="flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2 active:opacity-70"
      style={{ backgroundColor: bg, borderWidth: 1, borderColor: border, opacity: busy ? 0.6 : 1 }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={14} color={color} /> : null}
          <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Thin moving bar while a dish is being prepared (web: shimmer). */
function PreparingBar() {
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 2, overflow: "hidden", backgroundColor: "rgba(30,42,58,0.6)" }}
    >
      <Animated.View
        style={{
          width: "45%",
          height: 2,
          backgroundColor: "rgba(96,165,250,0.7)",
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.45, width * 1.1] }) }],
        }}
      />
    </View>
  );
}