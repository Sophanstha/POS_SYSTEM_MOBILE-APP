import type MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";


export type SystemId = "pos" | "ims" | "dms";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface SystemInfo {
  id: SystemId;
  /** Short name on the cards and the login page. */
  name: string;
  /** One line about the business, under the name. */
  description: string;
  icon: IconName;
  /** Main colour of the business; null until its colour theme is chosen (shown in grey). */
  brand: string | null;
  /** False: the card says "Coming soon" and can't be picked yet. */
  ready: boolean;
}

export const SYSTEMS: Record<SystemId, SystemInfo> = {
  pos: {
    id: "pos",
    name: "POS",
    description: "Restaurant point of sale: orders, tables, kitchen and payments",
    icon: "point-of-sale",
    brand: "#059669",
    ready: true,
  },
  ims: {
    id: "ims",
    name: "IMS",
    description: "Inventory management",
    icon: "warehouse",
    brand: null,
    ready: false,
  },
  dms: {
    id: "dms",
    name: "DMS",
    description: "Clinic management: patients, appointments and front desk",
    icon: "hospital-building",
    brand: null,
    ready: false,
  },
};

/** In the order the cards are shown. */
export const SYSTEM_LIST: SystemInfo[] = [SYSTEMS.pos, SYSTEMS.ims, SYSTEMS.dms];

export function isSystemId(value: unknown): value is SystemId {
  return value === "pos" || value === "ims" || value === "dms";
}
