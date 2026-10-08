import { ScrollView, View } from "react-native";
import { ActivityIndicator, Card, Divider, List, Text } from "react-native-paper";

import { getErrorMessage } from "../api/client";
import { useKotTickets } from "../hooks/useKot";
import { useCategories, useOutlet, useProducts } from "../hooks/useMenu";
import { useTables } from "../hooks/useTables";
import { outletTaxRate, readyTakeaways, TABLE_STATUS_LABEL, tableHasFoodReady } from "../lib/pos";
import { useAppTheme } from "../theme/paperTheme";
import type { TableStatus } from "../types/pos";

/**
 * TEMPORARY (step 3): proves the data layer works on a device.
 * Replaced by the real tables screen in step 4.
 */
export default function DataCheckScreen() {
  const theme = useAppTheme();
  const outlet = useOutlet();
  const tables = useTables();
  const tickets = useKotTickets();
  const categories = useCategories();
  const products = useProducts(null);

  const statusCounts = (tables.data ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});
  const foodReady = (tables.data ?? []).filter((t) => tableHasFoodReady(t, tickets.data ?? []));
  const lastUpdate = tables.dataUpdatedAt ? new Date(tables.dataUpdatedAt).toLocaleTimeString() : "—";

  const rows: { title: string; query: { isLoading: boolean; error: unknown }; value: string }[] = [
    {
      title: "Outlet",
      query: outlet,
      value: outlet.data
        ? `${outlet.data.name} · tax ${outletTaxRate(outlet.data)}%`
        : "—",
    },
    {
      title: "Tables",
      query: tables,
      value: tables.data
        ? `${tables.data.length} total · ` +
          (Object.keys(TABLE_STATUS_LABEL) as TableStatus[])
            .map((s) => `${TABLE_STATUS_LABEL[s]} ${statusCounts[s] ?? 0}`)
            .join(" · ")
        : "—",
    },
    {
      title: "Food ready (tables)",
      query: tables,
      value: foodReady.length ? foodReady.map((t) => t.tableNumber).join(", ") : "None",
    },
    {
      title: "Open kitchen tickets",
      query: tickets,
      value: tickets.data
        ? `${tickets.data.length} open · ${readyTakeaways(tickets.data).length} takeaway ready`
        : "—",
    },
    { title: "Categories", query: categories, value: String(categories.data?.length ?? "—") },
    { title: "Products", query: products, value: String(products.data?.length ?? "—") },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-5">
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Data check — tables and tickets refresh every 5 seconds. Last update: {lastUpdate}
      </Text>

      <Card mode="outlined" style={{ backgroundColor: theme.colors.surface }}>
        {rows.map((row, i) => (
          <View key={row.title}>
            {i > 0 ? <Divider /> : null}
            <List.Item
              title={row.title}
              description={row.query.error ? getErrorMessage(row.query.error) : row.value}
              descriptionNumberOfLines={3}
              descriptionStyle={row.query.error ? { color: theme.colors.error } : undefined}
              right={() => (row.query.isLoading ? <ActivityIndicator size="small" /> : null)}
            />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}