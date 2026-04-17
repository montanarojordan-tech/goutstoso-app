import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { bottomSpace, Header, HeroCard, MetricCard, Panel, Pill, Screen } from "@/components/BusinessUI";
import { useBusiness } from "@/contexts/BusinessContext";
import { useColors } from "@/hooks/useColors";

const heroImage = require("@/assets/images/workshop-hero.png");
const productImage = require("@/assets/images/product-line.png");

export default function DashboardScreen() {
  const colors = useColors();
  const { metrics, products, batches, orders, initialized } = useBusiness();
  const nextOrder = orders.find((order) => order.status !== "Delivered") ?? orders[0];
  const nextBatch = batches.find((batch) => batch.stage !== "Ready") ?? batches[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomSpace }]} showsVerticalScrollIndicator={false}>
        <Header eyebrow="Goutstoso" title="Maison cockpit" subtitle="A compact control room for stock, production, orders and customer relationships." />
        <HeroCard image={heroImage}>
          <Text style={styles.heroEyebrow}>Today in the atelier</Text>
          <Text style={styles.heroTitle}>CHF {metrics.revenue.toLocaleString("de-CH")} pipeline</Text>
          <Text style={styles.heroText}>{metrics.pendingOrders} orders moving, {metrics.activeBatches} batches in production, {metrics.bottlesInStock} bottles ready to sell.</Text>
        </HeroCard>
        <View style={styles.metricsGrid}>
          <MetricCard label="Orders" value={String(metrics.pendingOrders)} detail="Open client commitments" icon="truck" />
          <MetricCard label="Batches" value={String(metrics.activeBatches)} detail="Active cellar work" icon="droplet" />
          <MetricCard label="Stock risk" value={String(metrics.lowStock)} detail="Products below threshold" icon="alert-triangle" />
          <MetricCard label="Inventory" value={String(metrics.bottlesInStock)} detail="Bottles in cellar" icon="archive" />
        </View>
        <Panel>
          <View style={styles.panelHeader}>
            <View>
              <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>Priority order</Text>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>{nextOrder?.customerName ?? "No order"}</Text>
            </View>
            <Pill label={nextOrder?.status ?? "Clear"} tone={nextOrder?.status === "Delivered" ? "success" : "warning"} />
          </View>
          <Text style={[styles.panelText, { color: colors.mutedForeground }]}>{nextOrder?.items ?? "Add an order to start planning deliveries."}</Text>
        </Panel>
        <Panel>
          <View style={styles.panelHeader}>
            <View>
              <Text style={[styles.panelLabel, { color: colors.mutedForeground }]}>Cellar next step</Text>
              <Text style={[styles.panelTitle, { color: colors.foreground }]}>{nextBatch?.recipe ?? "No batch"}</Text>
            </View>
            <Pill label={nextBatch?.stage ?? "Ready"} tone={nextBatch?.stage === "Ready" ? "success" : "neutral"} />
          </View>
          <Text style={[styles.panelText, { color: colors.mutedForeground }]}>{nextBatch ? `${nextBatch.lotCode} · ${nextBatch.liters}L · ready ${nextBatch.readyAt}` : "Start a batch to track production."}</Text>
        </Panel>
        <View style={[styles.productStrip, { backgroundColor: colors.walnut }]}> 
          <Image source={productImage} style={styles.productImage} resizeMode="cover" />
          <View style={styles.productCopy}>
            <Feather name="award" size={18} color="#FFF8EC" />
            <Text style={styles.productTitle}>Best margin</Text>
            <Text style={styles.productText}>{products[0]?.name ?? "Signature liqueur"} leads the current line with a strong retail spread.</Text>
          </View>
        </View>
        {!initialized ? <Text style={[styles.syncing, { color: colors.mutedForeground }]}>Loading saved cellar data…</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 110 },
  heroEyebrow: { color: "#FFF8EC", fontWeight: "700", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  heroTitle: { color: "#FFF8EC", fontWeight: "700", fontSize: 31, letterSpacing: -0.9, marginTop: 6 },
  heroText: { color: "rgba(255,248,236,0.86)", fontWeight: "500", fontSize: 14, lineHeight: 20, marginTop: 8 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, marginBottom: 12 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  panelLabel: { fontWeight: "700", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 },
  panelTitle: { fontWeight: "700", fontSize: 20, marginTop: 4 },
  panelText: { fontWeight: "400", fontSize: 14, lineHeight: 20, marginTop: 10 },
  productStrip: { marginHorizontal: 20, borderRadius: 26, overflow: "hidden", marginTop: 2 },
  productImage: { height: 150, width: "100%" },
  productCopy: { padding: 16, gap: 8 },
  productTitle: { color: "#FFF8EC", fontWeight: "700", fontSize: 19 },
  productText: { color: "rgba(255,248,236,0.82)", fontWeight: "400", fontSize: 14, lineHeight: 20 },
  syncing: { textAlign: "center", marginTop: 12, fontWeight: "500" },
});
