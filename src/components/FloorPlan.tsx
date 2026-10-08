import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Animated, PanResponder, Pressable, ScrollView, View } from "react-native";
import { Text } from "react-native-paper";

import { useThemeMode } from "../context/ThemeContext";
import { canvasSize, CARD_SIZE, clampPoint, floorLayout, type Point } from "../lib/FloorPlan";
import { TABLE_STATUS_LABEL, tableHasFoodReady } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import { tableStatusColor } from "../theme/statusColors";
import type { DiningTable, KotTicket, TableStatus } from "../types/pos";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** Same icons as the web floor plan (Armchair, Users, Bookmark, Eraser). */
const STATUS_ICON: Record<TableStatus, IconName> = {
  available: "seat-outline",
  occupied: "account-group-outline",
  reserved: "bookmark-outline",
  dirty: "eraser",
};

const MIN_SCALE = 0.6;
const MIN_CANVAS_HEIGHT = 420;
/** A touch has to move this far (screen px) before it counts as a drag. */
const DRAG_THRESHOLD = 4;

type FloorPlanProps = {
  tables: DiningTable[];
  tickets: KotTicket[];
  /** Tables of other statuses are faded, not hidden, so the room keeps its shape. */
  filter: TableStatus | "all";
  /** Arrange mode: drag tables instead of opening them. */
  arranging: boolean;
  /** Width the canvas has on screen. */
  viewportWidth: number;
  onOpenTable: (table: DiningTable) => void;
  onMoveTable: (tableId: string, position: Point) => void;
  /** True while a table is being dragged — the screen stops scrolling. */
  onDragChange: (dragging: boolean) => void;
};

/**
 * The web floor plan on a phone: tables where staff placed them, on a dotted canvas.
 * Shrinks to fit the screen (down to 60%), then scrolls sideways.
 */
export default function FloorPlan({
  tables,
  tickets,
  filter,
  arranging,
  viewportWidth,
  onOpenTable,
  onMoveTable,
  onDragChange,
}: FloorPlanProps) {
  const theme = useAppTheme();
  const { isDark } = useThemeMode();
  const [dragging, setDragging] = useState(false);

  const layout = floorLayout(tables);
  const content = canvasSize(layout);
  const scale = Math.min(1, Math.max(MIN_SCALE, viewportWidth / Math.max(content.width, 1)));
  const width = Math.max(content.width * scale, viewportWidth);
  const height = Math.max(content.height * scale, MIN_CANVAS_HEIGHT);
  const dot = Math.round(28 * scale);

  const handleDragChange = (value: boolean) => {
    setDragging(value);
    onDragChange(value);
  };

  return (
    <ScrollView
      horizontal
      scrollEnabled={!dragging}
      showsHorizontalScrollIndicator={width > viewportWidth}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: arranging ? theme.colors.primary : theme.colors.outlineVariant,
        borderStyle: arranging ? "dashed" : "solid",
      }}
    >
      <View
        style={{
          width,
          height,
          backgroundColor: theme.colors.surface,
          // Dotted grid like the web canvas.
          experimental_backgroundImage: `radial-gradient(circle, ${
            isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)"
          } 1px, transparent 1px)`,
          experimental_backgroundSize: `${dot}px ${dot}px`,
        }}
      >
        {tables.map((table) => (
          <FloorTableCard
            key={table.id}
            table={table}
            position={layout[table.id]}
            scale={scale}
            foodReady={tableHasFoodReady(table, tickets)}
            dimmed={filter !== "all" && table.status !== filter}
            arranging={arranging}
            onPress={() => onOpenTable(table)}
            onMove={(position) => onMoveTable(table.id, position)}
            onDragChange={handleDragChange}
          />
        ))}
      </View>
    </ScrollView>
  );
}

type FloorTableCardProps = {
  table: DiningTable;
  /** Where the table is, in web pixels. */
  position: Point;
  scale: number;
  foodReady: boolean;
  dimmed: boolean;
  arranging: boolean;
  onPress: () => void;
  onMove: (position: Point) => void;
  onDragChange: (dragging: boolean) => void;
};

function FloorTableCard({
  table,
  position,
  scale,
  foodReady,
  dimmed,
  arranging,
  onPress,
  onMove,
  onDragChange,
}: FloorTableCardProps) {
  const theme = useAppTheme();
  const { isDark } = useThemeMode();
  const size = CARD_SIZE * scale;
  const statusColor = foodReady ? theme.colors.warning : tableStatusColor(theme, table.status);

  // Same as the web: "round" tables are circles, square / rectangle are rounded squares.
  const isRound = table.shape === "round";
  const radius = isRound ? size / 2 : 16;
  // Tinted by status like the web cards; a lighter tint on the dark theme.
  const tint = `${statusColor}${isDark ? "14" : "1f"}`;
  // On a shrunk floor plan the status line doesn't fit — colour and icon still show it.
  const showStatusLine = scale >= 0.75;

  // Screen position (web pixels × scale), animated so dragging doesn't re-render React.
  const pan = useRef(new Animated.ValueXY({ x: position.x * scale, y: position.y * scale })).current;
  const isDragging = useRef(false);
  const dragStart = useRef<Point>(position);
  const [lifted, setLifted] = useState(false);

  // Follow the saved position (server / other device / reset) unless we're dragging it.
  useEffect(() => {
    if (!isDragging.current) pan.setValue({ x: position.x * scale, y: position.y * scale });
  }, [pan, position.x, position.y, scale]);

  // The responder is created once, so it reads the latest props from here.
  const latest = useRef({ arranging, scale, position, onMove, onDragChange });
  latest.current = { arranging, scale, position, onMove, onDragChange };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.arranging,
      onMoveShouldSetPanResponder: () => latest.current.arranging,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        isDragging.current = true;
        dragStart.current = latest.current.position;
        setLifted(true);
        latest.current.onDragChange(true);
      },
      onPanResponderMove: (_e, g) => {
        const s = latest.current.scale;
        const next = clampPoint({ x: dragStart.current.x + g.dx / s, y: dragStart.current.y + g.dy / s });
        pan.setValue({ x: next.x * s, y: next.y * s });
      },
      onPanResponderRelease: (_e, g) => {
        const s = latest.current.scale;
        const moved = Math.abs(g.dx) + Math.abs(g.dy) >= DRAG_THRESHOLD;
        const next = clampPoint({ x: dragStart.current.x + g.dx / s, y: dragStart.current.y + g.dy / s });
        if (moved) latest.current.onMove(next);
        else pan.setValue({ x: dragStart.current.x * s, y: dragStart.current.y * s });
        isDragging.current = false;
        setLifted(false);
        latest.current.onDragChange(false);
      },
      onPanResponderTerminate: () => {
        const s = latest.current.scale;
        pan.setValue({ x: dragStart.current.x * s, y: dragStart.current.y * s });
        isDragging.current = false;
        setLifted(false);
        latest.current.onDragChange(false);
      },
    }),
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        position: "absolute",
        left: pan.x,
        top: pan.y,
        width: size,
        height: size,
        zIndex: lifted ? 10 : 1,
        elevation: lifted ? 8 : 0,
        opacity: dimmed && !arranging ? 0.3 : 1,
        transform: [{ scale: lifted ? 1.06 : 1 }],
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={arranging}
        accessibilityRole="button"
        accessibilityLabel={`Table ${table.tableNumber}, ${TABLE_STATUS_LABEL[table.status]}${foodReady ? ", food ready" : ""}`}
        className="flex-1 items-center justify-center active:opacity-70"
        style={{
          gap: 5 * scale,
          borderRadius: radius,
          backgroundColor: theme.colors.background,
          borderWidth: foodReady ? 2 : 1.5,
          borderColor: lifted ? theme.colors.primary : `${statusColor}99`,
          borderStyle: arranging && !lifted ? "dashed" : "solid",
        }}
      >
        {/* Tint layer (the card itself keeps a solid background so the dots don't show through). */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius, backgroundColor: tint }}
        />
        {foodReady ? (
          <View
            className="absolute rounded-md px-1.5"
            style={{ top: -8, backgroundColor: theme.colors.warning }}
          >
            <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 }}>READY</Text>
          </View>
        ) : null}

        <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: "800" }}>
          {table.tableNumber}
        </Text>
        <MaterialCommunityIcons
          name={foodReady ? "check-circle-outline" : STATUS_ICON[table.status]}
          size={Math.max(20, 30 * scale)}
          color={statusColor}
        />
        <View
          className="rounded-full px-2 py-0.5"
          style={{ borderWidth: 1, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant }}
        >
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10, fontWeight: "700" }}>
            {table.capacity} Seats
          </Text>
        </View>

        {showStatusLine ? (
          <View className="flex-row items-center gap-1">
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            <Text style={{ color: statusColor, fontSize: 10, fontWeight: "700" }}>
              {foodReady ? "Food ready" : TABLE_STATUS_LABEL[table.status]}
            </Text>
          </View>
        ) : null}

        {arranging ? (
          // Inside the curve on round tables, in the corner on square ones.
          <View className="absolute" style={{ top: isRound ? size * 0.1 : 4, right: isRound ? size * 0.1 : 4 }}>
            <MaterialCommunityIcons name="drag" size={16} color={theme.colors.onSurfaceVariant} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}