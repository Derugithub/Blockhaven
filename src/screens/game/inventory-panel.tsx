import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, IconButton } from '@/components/ui';
import { itemName } from '@/game/blocks';
import { craft, hasIngredients, RECIPES } from '@/game/crafting';
import { countItem, HOTBAR_SIZE, moveSlot, selectSlot, type Inventory } from '@/game/inventory';
import { Colors, Fonts } from '@/theme/theme';

import { ItemIcon } from './item-icon';

/**
 * Inventory and crafting. Tap a slot to pick it up, tap another to swap or merge.
 * Tapping a hotbar slot with nothing picked up selects it for placing.
 */
export function InventoryPanel({
  inventory,
  onChanged,
  onClose,
  onMessage,
}: {
  inventory: Inventory;
  onChanged: () => void;
  onClose: () => void;
  onMessage: (text: string) => void;
}) {
  const [, setVersion] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width > height && width >= 640;
  const bump = () => {
    setVersion((v) => v + 1);
    onChanged();
  };

  const gridWidth = wide ? Math.min(420, width * 0.48) : Math.min(520, width - 48 - insets.left - insets.right);
  const slotSize = Math.floor((gridWidth - 7 * 6) / 8);

  const onSlot = (index: number) => {
    if (picked === null) {
      if (inventory.slots[index]) setPicked(index);
      else if (index < HOTBAR_SIZE) {
        selectSlot(inventory, index);
        bump();
      }
      return;
    }
    moveSlot(inventory, picked, index);
    setPicked(null);
    bump();
  };

  return (
    <View
      style={[
        styles.backdrop,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 },
      ]}>
      <View style={[styles.sheet, { maxWidth: wide ? 920 : 560 }]}>
        <View style={styles.header}>
          <AppText variant="title">Inventory</AppText>
          <IconButton icon="close" label="Close inventory" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]}>
          <View>
            <AppText variant="label" color={Colors.muted} style={styles.section}>
              {picked === null ? 'Hotbar (first row) and backpack' : 'Tap where to move it'}
            </AppText>
            <View style={[styles.grid, { width: gridWidth }]}>
              {inventory.slots.map((slot, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={slot ? `${itemName(slot.item)}, ${slot.count}` : `Empty slot ${i + 1}`}
                  onPress={() => onSlot(i)}
                  style={[
                    styles.slot,
                    { width: slotSize, height: slotSize },
                    i < HOTBAR_SIZE && styles.hotbarSlot,
                    i === inventory.selected && styles.selected,
                    i === picked && styles.picked,
                  ]}>
                  {slot ? <ItemIcon item={slot.item} size={slotSize * 0.62} /> : null}
                  {slot && slot.count > 1 ? (
                    <AppText variant="meta" style={styles.count}>
                      {String(slot.count)}
                    </AppText>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {picked !== null && inventory.slots[picked] ? (
              <AppText variant="meta" color={Colors.muted} style={styles.hint}>
                {itemName(inventory.slots[picked]!.item)} picked up
              </AppText>
            ) : null}
          </View>

          <View style={[styles.crafting, wide && styles.craftingWide]}>
            <AppText variant="label" color={Colors.muted} style={styles.section}>
              Crafting
            </AppText>
            {RECIPES.map((recipe) => {
              const ok = hasIngredients(inventory, recipe);
              return (
                <View key={recipe.id} style={styles.recipe}>
                  <ItemIcon item={recipe.output.item} size={32} />
                  <View style={styles.recipeText}>
                    <AppText variant="bodyMedium">
                      {recipe.output.count > 1
                        ? `${itemName(recipe.output.item)} ×${recipe.output.count}`
                        : itemName(recipe.output.item)}
                    </AppText>
                    <View style={styles.inputs}>
                      {recipe.inputs.map((input) => {
                        const have = countItem(inventory, input.item);
                        return (
                          <View key={input.item} style={styles.input}>
                            <ItemIcon item={input.item} size={16} />
                            <AppText variant="meta" color={have >= input.count ? Colors.muted : Colors.danger}>
                              {`${itemName(input.item)} ${Math.min(have, 999)}/${input.count}`}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <Button
                    compact
                    label="Craft"
                    kind={ok ? 'primary' : 'secondary'}
                    disabled={!ok}
                    onPress={() => {
                      const result = craft(inventory, recipe);
                      if (result === 'full') onMessage('Inventory is full');
                      setPicked(null);
                      bump();
                    }}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    flexShrink: 1,
    backgroundColor: Colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  body: { gap: 16, paddingBottom: 8 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  section: { marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slot: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.line,
    backgroundColor: Colors.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotbarSlot: { backgroundColor: '#2C3448' },
  selected: { borderColor: Colors.warn },
  picked: { borderColor: Colors.accent, backgroundColor: 'rgba(108,197,106,0.18)' },
  count: { position: 'absolute', right: 3, bottom: 0, fontSize: 11, lineHeight: 14, fontFamily: Fonts.bold },
  hint: { marginTop: 8 },
  crafting: { gap: 8 },
  craftingWide: { flex: 1 },
  recipe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.panelRaised,
  },
  recipeText: { flex: 1, gap: 4 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
