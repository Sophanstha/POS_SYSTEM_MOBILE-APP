import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Dimensions, Image, Keyboard, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../shared/api/client";
import {
  AdminButton,
  AdminError,
  AdminField,
  AdminHero,
  ChoiceField,
  ConfirmDialog,
  RevealFocusedInputProvider,
} from "../../../shared/components/AdminUI";
import OrganizationSettings from "../components/admin/OrganizationSettings";
import { apiUrlFor } from "../../../shared/config";
import { usePosAuth } from "../auth/PosAuthProvider";
import { useThemeMode, type ThemeMode } from "../../../shared/context/ThemeContext";
import { useChangeBusiness } from "../../../shared/hooks/useChangeBusiness";
import { useUpdateAccount, useUpdateOutlet } from "../hooks/useAdmin";
import { useKeyboardHeight } from "../../../shared/hooks/useKeyboardHeight";
import { useOutlet } from "../hooks/useMenu";
import { useDashboardPalette } from "../../../shared/theme/dashboardPalette";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];
type Section = "organization" | "account" | "outlet" | "qrMenu" | "app";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAX_RE = /^\d{1,3}(\.\d{1,2})?$/;

/** The web POS address (the API without "/api"): the customer menu lives there. */
const WEB_ORIGIN = (apiUrlFor("pos") ?? "").replace(/\/api$/, "");

/** QR image from the same free service the web uses. */
const qrImageUrl = (target: string, size = 250) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The web's printable table-top flyer: outlet name, QR code, "Scan to Browse Menu". */
function flyerHtml(outletName: string, qrUrl: string): string {
  const step = (n: number, text: string) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:6px 0;font-size:12px;color:#475569">
       <span style="width:18px;height:18px;border-radius:9px;background:#ecfdf5;color:#047857;font-weight:700;font-size:10px;display:inline-flex;align-items:center;justify-content:center">${n}</span>${text}
     </div>`;
  return `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
  <body style="margin:0;font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif">
    <div style="width:320px;margin:40px auto;padding:32px;border:12px solid #059669;border-radius:24px;text-align:center;box-sizing:border-box">
      <div style="font-size:22px;font-weight:800;text-transform:uppercase;color:#0f172a">${escapeHtml(outletName)}</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:3px;color:#94a3b8;margin-top:4px">WELCOME &amp; ENJOY</div>
      <img src="${qrUrl}" width="200" height="200" style="margin:24px auto;display:block"/>
      <div style="font-size:16px;font-weight:700;color:#1e293b">Scan to Browse Menu</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:2px">No App or Login required</div>
      <div style="text-align:left;margin-top:16px">
        ${step(1, "Open your smartphone camera app")}
        ${step(2, "Point camera at the QR code above")}
        ${step(3, "Tap the link to view our menu")}
      </div>
    </div>
  </body></html>`;
}

/**
 * Manager "Settings", like the web: Account (name, email, password), Outlet (name, address,
 * phone, tax) and the customer menu QR code — plus the app's own appearance, version and logout.
 */
export default function ManagerSettingsScreen() {
  const d = useDashboardPalette();
  const insets = useSafeAreaInsets();
  const { user, role, activeOutlet, activeOutletId, hasPermission, logout, updateUser, renameOutlet } = usePosAuth();
  const { mode, setMode } = useThemeMode();
  const outletQuery = useOutlet();
  const updateAccount = useUpdateAccount();
  const updateOutlet = useUpdateOutlet();

  const [open, setOpen] = useState<Section | null>("account");
  const [message, setMessage] = useState<string | null>(null);

  // ── Account ──
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const mismatch = newPw.length > 0 && confirmPw.length > 0 && newPw !== confirmPw;

  // ── Outlet ──
  const canEditOutlet = hasPermission("core.outlets.update");
  const [outletName, setOutletName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState("");
  const [taxName, setTaxName] = useState("");
  const [outletError, setOutletError] = useState<string | null>(null);

  // Fill the outlet form once its details arrive (and again after switching outlet).
  const loadedOutlet = useRef<string | null>(null);
  useEffect(() => {
    const o = outletQuery.data;
    if (!o || loadedOutlet.current === o.id) return;
    loadedOutlet.current = o.id;
    setOutletName(o.name ?? "");
    setAddress(o.address ?? "");
    setPhone(o.phone ?? "");
    setTaxEnabled(!!o.taxEnabled);
    setTaxRate(String(Number(o.taxRate ?? 0)));
    setTaxName(o.taxName ?? "");
  }, [outletQuery.data]);

  // ── QR menu ──
  const menuUrl = user?.slug ? `${WEB_ORIGIN}/menu/${user.slug}` : null;
  const [flyerBusy, setFlyerBusy] = useState<"print" | "share" | null>(null);

  // ── App ──
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const changeBusiness = useChangeBusiness();

  // ── Keyboard: keep the field being typed in above it ──
  const keyboard = useKeyboardHeight();
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);

  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const kb = keyboardRef.current;
      if (!input || kb === 0) return;
      // Where the keyboard starts, as the keyboard reports it (the window height isn't
      // reliable on Android, where the app is drawn edge-to-edge).
      const metrics = Keyboard.metrics();
      const keyboardTop =
        metrics && metrics.screenY > 0
          ? metrics.screenY
          : // Android reports the keyboard without the navigation bar under it.
            Dimensions.get("window").height - kb - (Platform.OS === "android" ? insets.bottom : 0);
      input.measureInWindow((_x, y, _w, h) => {
        const hidden = y + h + 24 - keyboardTop;
        if (hidden > 0) scrollRef.current?.scrollTo({ y: scrollY.current + hidden, animated: true });
      });
    }, 150);
  }, [insets.bottom]);

  useEffect(() => {
    if (keyboard > 0) reveal();
  }, [keyboard, reveal]);

  const toggle = (section: Section) => setOpen((s) => (s === section ? null : section));

  const saveAccount = () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) return setAccountError("Name must be at least 2 characters.");
    if (!EMAIL_RE.test(trimmedEmail)) return setAccountError("Enter a valid email address.");
    const changingPassword = !!(currentPw || newPw || confirmPw);
    if (changingPassword) {
      if (!currentPw || !newPw) return setAccountError("Enter your current password and a new password.");
      if (newPw.length < 8) return setAccountError("The new password must be at least 8 characters.");
      if (newPw !== confirmPw) return setAccountError("New passwords don't match.");
    }

    setAccountError(null);
    updateAccount.mutate(
      { name: trimmedName, email: trimmedEmail, ...(changingPassword ? { currentPassword: currentPw, newPassword: newPw } : {}) },
      {
        onSuccess: async (saved) => {
          await updateUser({ name: saved?.name ?? trimmedName, email: saved?.email ?? trimmedEmail });
          setCurrentPw("");
          setNewPw("");
          setConfirmPw("");
          setMessage(changingPassword ? "Account and password updated." : "Account settings updated successfully.");
        },
        onError: (e) => setAccountError(getErrorMessage(e, "Failed to update account settings.")),
      },
    );
  };

  const saveOutlet = () => {
    if (!activeOutletId) return setOutletError("No active outlet selected.");
    const trimmedName = outletName.trim();
    if (!trimmedName) return setOutletError("Enter the outlet name.");
    if (phone.trim().length > 30) return setOutletError("The phone number is too long.");
    if (taxEnabled && (!TAX_RE.test(taxRate.trim()) || Number(taxRate) > 100)) {
      return setOutletError("Tax rate must be a percentage between 0 and 100 (up to 2 decimals).");
    }
    if (taxName.trim().length > 50) return setOutletError("Tax name can be at most 50 characters.");

    setOutletError(null);
    updateOutlet.mutate(
      {
        outletId: activeOutletId,
        form: {
          name: trimmedName,
          address: address.trim(),
          phone: phone.trim(),
          taxEnabled,
          taxRate: taxRate.trim() || "0",
          taxName: taxName.trim(),
        },
      },
      {
        onSuccess: async () => {
          await renameOutlet(activeOutletId, trimmedName);
          setMessage("Outlet settings updated successfully.");
        },
        onError: (e) => setOutletError(getErrorMessage(e, "Failed to update outlet settings.")),
      },
    );
  };

  const flyer = async (kind: "print" | "share") => {
    if (!menuUrl) return;
    setFlyerBusy(kind);
    try {
      const html = flyerHtml(outletQuery.data?.name ?? activeOutlet?.name ?? "Our Menu", qrImageUrl(menuUrl, 400));
      if (kind === "print") {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Share menu QR flyer" });
      }
    } catch (e) {
      // Closing the print screen without printing isn't an error worth showing.
      const text = e instanceof Error ? e.message : "";
      if (!/cancel/i.test(text)) setMessage(text || "Couldn't create the QR flyer.");
    } finally {
      setFlyerBusy(null);
    }
  };

  return (
    <View className="flex-1">
      <RevealFocusedInputProvider value={reveal}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          contentContainerStyle={{
            gap: 16,
            paddingTop: 16,
            paddingBottom: insets.bottom + 32 + (Platform.OS === "ios" ? keyboard : 0),
            paddingHorizontal: 16,
            width: "100%",
            maxWidth: 720,
            alignSelf: "center",
          }}
        >
          <AdminHero title="Settings" />

          {/* Who is signed in */}
          <View className="flex-row items-center gap-3 rounded-xl p-4" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
            <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: d.rank.bg, borderWidth: 1, borderColor: d.rank.border }}>
              <Text style={{ color: d.rank.text, fontSize: 16, fontWeight: "700" }}>{initials(user?.name)}</Text>
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} style={{ color: d.text, fontSize: 15, fontWeight: "700" }}>
                {user?.name ?? ""}
              </Text>
              <Text numberOfLines={1} style={{ color: d.sub, fontSize: 12 }}>
                {user?.email ?? ""}
              </Text>
              <Text numberOfLines={1} style={{ color: d.muted, fontSize: 12, marginTop: 2 }}>
                {[role, activeOutlet?.name].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>

          {/* Organization (Owner) — web: Profile & Security */}
          {role === "Owner" ? (
            <Accordion icon="domain" title="Organization" subtitle="Business name and logo" open={open === "organization"} onToggle={() => toggle("organization")}>
              <OrganizationSettings onSaved={setMessage} />
            </Accordion>
          ) : null}

          {/* Account */}
          <Accordion icon="account-outline" title="Account" subtitle="Name, email, and password" open={open === "account"} onToggle={() => toggle("account")}>
            {accountError ? <AdminError text={accountError} /> : null}
            <AdminField label="Full Name" icon="account-outline" value={name} onChangeText={setName} autoCapitalize="words" editable={!updateAccount.isPending} />
            <AdminField
              label="Email Address"
              icon="email-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!updateAccount.isPending}
            />
            <View className="gap-3 pt-4" style={{ borderTopWidth: 1, borderColor: d.border }}>
              <Text style={{ color: d.sub, fontSize: 11, fontWeight: "600", letterSpacing: 0.8 }}>CHANGE PASSWORD</Text>
              <AdminField label="Current password" icon="lock-outline" password value={currentPw} onChangeText={setCurrentPw} autoCapitalize="none" editable={!updateAccount.isPending} />
              <AdminField label="New password" icon="lock-outline" password value={newPw} onChangeText={setNewPw} placeholder="Minimum 8 characters" autoCapitalize="none" editable={!updateAccount.isPending} />
              <AdminField label="Confirm new password" icon="lock-outline" password value={confirmPw} onChangeText={setConfirmPw} autoCapitalize="none" editable={!updateAccount.isPending} />
              {mismatch ? <Text style={{ color: d.error.text, fontSize: 12 }}>New passwords don't match.</Text> : null}
              <Text style={{ color: d.muted, fontSize: 11 }}>Leave these empty to keep your current password.</Text>
            </View>
            <View className="flex-row justify-end">
              <AdminButton label="Save Account" icon="content-save-outline" variant="primary" loading={updateAccount.isPending} disabled={mismatch} onPress={saveAccount} />
            </View>
          </Accordion>

          {/* Outlet */}
          <Accordion icon="office-building-outline" title="Outlet" subtitle="Business name, address, and tax rate" open={open === "outlet"} onToggle={() => toggle("outlet")}>
            {outletQuery.isLoading ? (
              <ActivityIndicator color={d.link} style={{ alignSelf: "flex-start" }} />
            ) : outletQuery.error ? (
              <AdminError text={getErrorMessage(outletQuery.error, "Couldn't load the outlet.")} />
            ) : (
              <>
                {outletError ? <AdminError text={outletError} /> : null}
                {!canEditOutlet ? <Text style={{ color: d.muted, fontSize: 12 }}>Only someone allowed to edit outlets can change these.</Text> : null}
                <AdminField label="Outlet Name" icon="storefront-outline" value={outletName} onChangeText={setOutletName} editable={canEditOutlet && !updateOutlet.isPending} />
                <AdminField label="Address" icon="map-marker-outline" value={address} onChangeText={setAddress} editable={canEditOutlet && !updateOutlet.isPending} />
                <AdminField
                  label="Phone Number"
                  icon="phone-outline"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={30}
                  editable={canEditOutlet && !updateOutlet.isPending}
                />

                <View className="flex-row items-center gap-3 rounded-lg px-3.5 py-3" style={{ backgroundColor: d.rowExpanded, borderWidth: 1, borderColor: d.border }}>
                  <MaterialCommunityIcons name="percent-outline" size={18} color={d.brand.icon} />
                  <View className="flex-1">
                    <Text style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>Charge tax on bills</Text>
                    <Text style={{ color: d.muted, fontSize: 11 }}>Added to every new order of this outlet</Text>
                  </View>
                  <Switch
                    value={taxEnabled}
                    disabled={!canEditOutlet || updateOutlet.isPending}
                    onValueChange={setTaxEnabled}
                    trackColor={{ true: d.brand.edge, false: d.border }}
                    thumbColor="#ffffff"
                    accessibilityLabel="Charge tax on bills"
                  />
                </View>
                {taxEnabled ? (
                  <View className="flex-row gap-3">
                    <View style={{ width: 130 }}>
                      <AdminField
                        label="Tax Rate (%)"
                        icon="percent"
                        value={taxRate}
                        onChangeText={(t) => setTaxRate(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
                        keyboardType="decimal-pad"
                        placeholder="13"
                        editable={canEditOutlet && !updateOutlet.isPending}
                      />
                    </View>
                    <View className="flex-1">
                      <AdminField
                        label="Tax Name"
                        value={taxName}
                        onChangeText={setTaxName}
                        placeholder="e.g. VAT"
                        maxLength={50}
                        editable={canEditOutlet && !updateOutlet.isPending}
                      />
                    </View>
                  </View>
                ) : null}

                {canEditOutlet ? (
                  <View className="flex-row justify-end">
                    <AdminButton label="Save Outlet" icon="content-save-outline" variant="primary" loading={updateOutlet.isPending} onPress={saveOutlet} />
                  </View>
                ) : null}
              </>
            )}
          </Accordion>

          {/* QR code menu */}
          <Accordion icon="qrcode" title="QR Code Menu" subtitle="Generate and share customer menu QR codes" open={open === "qrMenu"} onToggle={() => toggle("qrMenu")}>
            {menuUrl ? (
              <View className="items-center gap-4">
                <Text style={{ color: d.title, fontSize: 15, fontWeight: "600" }}>Menu QR Code</Text>
                <View className="rounded-2xl bg-white p-3" style={{ borderWidth: 1, borderColor: d.border }}>
                  <Image source={{ uri: qrImageUrl(menuUrl) }} accessibilityLabel="Menu QR code" style={{ width: 180, height: 180 }} />
                </View>
                <Text selectable style={{ color: d.link, fontSize: 12, textAlign: "center" }}>
                  {menuUrl}
                </Text>
                <Text style={{ color: d.muted, fontSize: 12, textAlign: "center" }}>
                  Customers scan it to see your menu — no app or login needed.
                </Text>
                <View className="w-full flex-row gap-2">
                  <AdminButton label="Share Flyer" icon="share-variant-outline" variant="primary" grow loading={flyerBusy === "share"} disabled={!!flyerBusy} onPress={() => flyer("share")} />
                  <AdminButton label="Print Flyer" icon="printer-outline" grow loading={flyerBusy === "print"} disabled={!!flyerBusy} onPress={() => flyer("print")} />
                </View>
              </View>
            ) : (
              <Text style={{ color: d.muted, fontSize: 13 }}>The menu link isn't available for this account.</Text>
            )}
          </Accordion>

          {/* App (mobile only) */}
          <Accordion icon="cellphone-cog" title="App" subtitle="Appearance and version" open={open === "app"} onToggle={() => toggle("app")}>
            <ChoiceField<ThemeMode>
              label="Appearance"
              options={[
                { value: "dark", label: "Dark", icon: "moon-waning-crescent" },
                { value: "light", label: "Light", icon: "white-balance-sunny" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <View className="flex-row justify-between">
              <Text style={{ color: d.sub, fontSize: 13 }}>Version</Text>
              <Text style={{ color: d.title, fontSize: 13, fontWeight: "600" }}>
                {Constants.expoConfig?.name ?? "POS"} {Constants.expoConfig?.version ?? ""}
              </Text>
            </View>
          </Accordion>

          <AdminButton label="Change business" icon="swap-horizontal" onPress={() => setConfirmChange(true)} />
          <AdminButton label="Logout" icon="logout" onPress={() => setConfirmLogout(true)} />
        </ScrollView>
      </RevealFocusedInputProvider>

      <ConfirmDialog
        visible={confirmChange}
        onDismiss={() => !loggingOut && setConfirmChange(false)}
        icon="swap-horizontal"
        title="Change business?"
        message="You'll be logged out of POS and can pick another business. Open orders stay on the server."
        confirmLabel="Change business"
        tone="primary"
        busy={loggingOut}
        onConfirm={async () => {
          setLoggingOut(true);
          await changeBusiness(); // logs out, then "What is your business?" opens
        }}
      />

      <ConfirmDialog
        visible={confirmLogout}
        onDismiss={() => !loggingOut && setConfirmLogout(false)}
        icon="logout"
        title="Log out?"
        message="Open orders stay on the server. You can log back in any time."
        confirmLabel="Logout"
        busy={loggingOut}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout(); // the router leaves this screen once signed out
        }}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3000}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}

function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

/** The web's collapsible settings card: icon, title, subtitle and a chevron. */
function Accordion({
  icon,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const d = useDashboardPalette();
  return (
    <View className="overflow-hidden rounded-xl" style={{ backgroundColor: d.card, borderWidth: 1, borderColor: d.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-3 px-5 py-4"
        style={({ pressed }) => ({ backgroundColor: pressed ? d.pressed : "transparent" })}
      >
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: d.brand.tile }}>
          <MaterialCommunityIcons name={icon} size={18} color={d.brand.icon} />
        </View>
        <View className="flex-1">
          <Text style={{ color: d.text, fontSize: 14, fontWeight: "600" }}>{title}</Text>
          <Text style={{ color: d.muted, fontSize: 12 }}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={20} color={d.muted} />
      </Pressable>
      {open ? (
        <View className="gap-4 px-5 pb-5 pt-4" style={{ borderTopWidth: 1, borderColor: d.border }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}
