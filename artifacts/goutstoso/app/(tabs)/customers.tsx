import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { bottomSpace, EmptyState, Field, Header, Panel, Pill, PrimaryButton, Screen } from "@/components/BusinessUI";
import { useBusiness } from "@/contexts/BusinessContext";
import { useColors } from "@/hooks/useColors";

export default function CustomersScreen() {
  const colors = useColors();
  const { customers, addCustomer } = useBusiness();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const submit = () => {
    addCustomer(name, location);
    setName("");
    setLocation("");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        <Header eyebrow="Relationships" title="Client cellar" subtitle="Manage boutiques, restaurants, distributors and direct buyers across Switzerland." />
        <Panel>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Add customer</Text>
          <View style={styles.formRow}>
            <Field value={name} onChangeText={setName} placeholder="Name" />
            <Field value={location} onChangeText={setLocation} placeholder="City" />
          </View>
          <PrimaryButton label="Save customer" icon="user-plus" onPress={submit} disabled={!name.trim() || !location.trim()} />
        </Panel>
        {customers.length === 0 ? <EmptyState title="No customers" text="Add a buyer to begin building the sales book." /> : customers.map((customer) => (
          <Panel key={customer.id}>
            <View style={styles.customerRow}>
              <View style={[styles.avatar, { backgroundColor: colors.muted }]}> 
                <Text style={[styles.initials, { color: colors.primary }]}>{customer.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={[styles.name, { color: colors.foreground }]}>{customer.name}</Text>
                <Text style={[styles.location, { color: colors.mutedForeground }]}>{customer.location} · last order CHF {customer.lastOrderValue.toLocaleString("de-CH")}</Text>
              </View>
              <Pill label={customer.segment} tone={customer.segment === "Distributor" ? "warning" : customer.segment === "Direct" ? "success" : "neutral"} />
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
  customerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  initials: { fontWeight: "700", fontSize: 15 },
  customerInfo: { flex: 1 },
  name: { fontWeight: "700", fontSize: 17 },
  location: { fontWeight: "400", fontSize: 13, marginTop: 5, lineHeight: 18 },
});
