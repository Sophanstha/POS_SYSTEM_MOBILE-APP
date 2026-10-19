import { useState } from "react";
import { View } from "react-native";
import { Snackbar } from "react-native-paper";

import OrderBuilder from "../components/order/OrderBuilder";
import TakeawayPaymentSheet from "../components/payment/TakeawayPaymentSheet";
import PickupQueue from "../components/PickupQueue";
import { useCart } from "../hooks/useCart";

type Customer = { customerName?: string; customerPhone?: string };

/** Cashier takeaway: build the order, take payment (which places it), hand over when ready. */
export default function TakeawayScreen() {
  const cart = useCart();
  const [checkout, setCheckout] = useState<Customer | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pt-2">
        <PickupQueue />
      </View>

      <OrderBuilder
        cart={cart}
        submitLabel="Checkout"
        submitIcon="cash-register"
        submitting={false}
        // Close the cart and open payment; the order is only created once it's paid.
        onSubmit={async (customer) => {
          setCheckout(customer);
          return true;
        }}
        onMessage={setMessage}
      />

      <TakeawayPaymentSheet
        visible={!!checkout}
        onDismiss={() => setCheckout(null)}
        cart={cart}
        customer={checkout ?? {}}
      />

      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={3500}>
        {message ?? ""}
      </Snackbar>
    </View>
  );
}