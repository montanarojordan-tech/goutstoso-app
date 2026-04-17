import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { bottomSpace, EmptyState, Field, Header, IconButton, Panel, PrimaryButton, Screen } from "@/components/BusinessUI";
import { useBusiness } from "@/contexts/BusinessContext";
import { useColors } from "@/hooks/useColors";

export default function InventoryScreen() {
  const colors = useColors();
  const { products, addProduct, adjustStock } = useBusiness();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("24");

  const submit = () => {
    addProduct(name, category, Number(stock) || 0);
    setName("");
    setCategory("");
    setStock("24");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        <Header eyebrow="Inventory" title="Bottle cellar" subtitle="Track finished goods, reorder pressure and quick stock movements." />
        <Panel>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Add product</Text>
          <View style={styles.formRow}>
            <Field value={name} onChangeText={setName} placeholder="Name" />
            <Field value={stock} onChangeText={setStock} placeholder="Stock" keyboardType="numeric" />
          </View>
          <Field value={category} onChangeText={setCategory} placeholder="Category" />
          <PrimaryButton label="Save product" icon="plus" onPress={submit} disabled={!name.trim() || !category.trim()} />
        </Panel>
        {products.length === 0 ? <EmptyState title="No products yet" text="Add your first liqueur to begin tracking stock." /> : products.map((product) => {
          const low = product.stock <= product.threshold;
          const margin = product.retailPrice - product.unitCost;
          return (
            <Panel key={product.id}>
              <View style={styles.productTop}>
                <View style={[styles.swatch, { backgroundColor: product.accent }]} />
                <View style={styles.productInfo}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>{product.category} · {product.volumeMl}ml · CHF {margin.toFixed(0)} margin</Text>
                </View>
                <Text style={[styles.stock, { color: low ? colors.destructive : colors.foreground }]}>{product.stock}</Text>
              </View>
              <View style={styles.controls}>
                <Text style={[styles.threshold, { color: colors.mutedForeground }]}>{low ? "Below safety stock" : `Safety stock ${product.threshold}`}</Text>
                <View style={styles.buttons}>
                  <IconButton icon="minus" label="Reduce stock" onPress={() => adjustStock(product.id, -6)} />
                  <IconButton icon="plus" label="Increase stock" onPress={() => adjustStock(product.id, 12)} />
                </View>
              </View>
            </Panel>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formTitle: { fontWeight: "700", fontSize: 18, marginBottom: 12 },
  formRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  productTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  swatch: { width: 44, height: 58, borderRadius: 16 },
  productInfo: { flex: 1 },
  name: { fontWeight: "700", fontSize: 18 },
  meta: { fontWeight: "400", fontSize: 13, marginTop: 5, lineHeight: 18 },
  stock: { fontWeight: "700", fontSize: 28 },
  controls: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  threshold: { fontWeight: "600", fontSize: 13 },
  buttons: { flexDirection: "row", gap: 8 },
});
