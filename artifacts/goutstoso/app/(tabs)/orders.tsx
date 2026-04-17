import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { bottomSpace, EmptyState, Field, Header, Panel, Pill, PrimaryButton, Screen } from "@/components/BusinessUI";
import { useBusiness } from "@/contexts/BusinessContext";
import { useColors } from "@/hooks/useColors";

export default function OrdersScreen() {
  const colors = useColors();
  const { orders, addOrder, advanceOrder } = useBusiness();
  const [customer, setCustomer] = useState("");
  const [total, setTotal] = useState("520");

  const submit = () => {
    addOrder(customer, Number(total) || 0);
    setCustomer("");
    setTotal("520");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        <Header eyebrow="Sales" title="Order book" subtitle="Keep wholesale and hospitality commitments moving from draft to delivered." />
        <Panel>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>New order</Text>
          <View style={styles.formRow}>
            <Field value={customer} onChangeText={setCustomer} placeholder="Customer" />
            <Field value={total} onChangeText={setTotal} placeholder="CHF" keyboardType="numeric" />
          </View>
          <PrimaryButton label="Add order" icon="file-plus" onPress={submit} disabled={!customer.trim()} />
        </Panel>
        {orders.length === 0 ? <EmptyState title="No orders" text="Add a customer order to begin tracking delivery status." /> : orders.map((order) => (
          <Panel key={order.id}>
            <View style={styles.orderTop}>
              <View style={styles.orderCopy}>
                <Text style={[styles.customer, { color: colors.foreground }]}>{order.customerName}</Text>
                <Text style={[styles.items, { color: colors.mutedForeground }]}>{order.items}</Text>
              </View>
              <Text style={[styles.total, { color: colors.foreground }]}>CHF {order.total.toLocaleString("de-CH")}</Text>
            </View>
            <View style={styles.orderBottom}>
              <View>
                <Pill label={order.status} tone={order.status === "Delivered" ? "success" : order.status === "Packed" ? "warning" : "neutral"} />
                <Text style={[styles.due, { color: colors.mutedForeground }]}>Due {order.dueDate}</Text>
              </View>
              <PrimaryButton label={order.status === "Delivered" ? "Delivered" : "Next"} icon="check" onPress={() => advanceOrder(order.id)} disabled={order.status === "Delivered"} />
            </View>
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formTitle: { fontWeight: "700", fontSize: 18, marginBottom: 12 },
  formRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  orderTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  orderCopy: { flex: 1 },
  customer: { fontWeight: "700", fontSize: 19 },
  items: { fontWeight: "400", fontSize: 14, marginTop: 6, lineHeight: 19 },
  total: { fontWeight: "700", fontSize: 18 },
  orderBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  due: { fontWeight: "600", fontSize: 12, marginTop: 8 },
});
