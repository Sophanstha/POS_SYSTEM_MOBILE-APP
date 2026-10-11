import * as Haptics from "expo-haptics";

/** Fire and forget: a phone without a vibration motor just does nothing. */
const run = (feedback: () => Promise<void>) => {
  feedback().catch(() => {});
};

export const haptics = {
  /** Light tick: item added to the cart, table picked up to move. */
  tap: () => run(() => Haptics.selectionAsync()),
  /** Order sent to the kitchen, payment done. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Something failed. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
