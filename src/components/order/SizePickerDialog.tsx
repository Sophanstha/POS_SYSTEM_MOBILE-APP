import { Button, Dialog, List, Portal } from "react-native-paper";

import { formatRs } from "../../lib/pos";
import { useAppTheme } from "../../theme/paperTheme";
import type { Product, ProductVariant } from "../../types/pos";

type SizePickerDialogProps = {
  product: Product | null;
  variants: ProductVariant[];
  onPick: (variant: ProductVariant) => void;
  onDismiss: () => void;
};

/** Choose a size (variant) for products that have more than one. */
export default function SizePickerDialog({ product, variants, onPick, onDismiss }: SizePickerDialogProps) {
  const theme = useAppTheme();

  return (
    <Portal>
      <Dialog visible={!!product} onDismiss={onDismiss} style={{ backgroundColor: theme.colors.surface }}>
        <Dialog.Title>{product?.name}</Dialog.Title>
        <Dialog.Content style={{ paddingHorizontal: 0 }}>
          {variants.map((v) => (
            <List.Item
              key={v.id}
              title={v.label}
              description={v.isAvailable ? formatRs(v.price) : "Out of stock"}
              descriptionStyle={{ color: v.isAvailable ? theme.colors.primary : theme.colors.error }}
              disabled={!v.isAvailable}
              style={{ opacity: v.isAvailable ? 1 : 0.5, paddingHorizontal: 12 }}
              right={(props) => (v.isAvailable ? <List.Icon {...props} icon="plus" /> : null)}
              onPress={() => onPick(v)}
            />
          ))}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}