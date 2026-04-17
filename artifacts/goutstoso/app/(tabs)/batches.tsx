import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { bottomSpace, EmptyState, Field, Header, Panel, Pill, PrimaryButton, Screen } from "@/components/BusinessUI";
import { useBusiness } from "@/contexts/BusinessContext";
import { useColors } from "@/hooks/useColors";

export default function BatchesScreen() {
  const colors = useColors();
  const { batches, addBatch, advanceBatch } = useBusiness();
  const [recipe, setRecipe] = useState("");
  const [liters, setLiters] = useState("60");

  const submit = () => {
    addBatch(recipe, Number(liters) || 0);
    setRecipe("");
    setLiters("60");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomSpace }} showsVerticalScrollIndicator={false}>
        <Header eyebrow="Production" title="Batch ledger" subtitle="Follow every maceration, rest period and bottling run from cellar to shelf." />
        <Panel>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Start batch</Text>
          <View style={styles.formRow}>
            <Field value={recipe} onChangeText={setRecipe} placeholder="Recipe" />
            <Field value={liters} onChangeText={setLiters} placeholder="Liters" keyboardType="numeric" />
          </View>
          <PrimaryButton label="Create batch" icon="droplet" onPress={submit} disabled={!recipe.trim()} />
        </Panel>
        {batches.length === 0 ? <EmptyState title="No batches" text="Start a recipe to build the production calendar." /> : batches.map((batch) => (
          <Panel key={batch.id}>
            <View style={styles.batchTop}>
              <View>
                <Text style={[styles.lot, { color: colors.primary }]}>{batch.lotCode}</Text>
                <Text style={[styles.recipe, { color: colors.foreground }]}>{batch.recipe}</Text>
              </View>
              <Pill label={batch.stage} tone={batch.stage === "Ready" ? "success" : batch.stage === "Bottling" ? "warning" : "neutral"} />
            </View>
            <View style={styles.timeline}>
              <View style={[styles.timelineBar, { backgroundColor: colors.muted }]}>
                <View style={[styles.timelineFill, { backgroundColor: colors.primary, width: batch.stage === "Maceration" ? "25%" : batch.stage === "Resting" ? "52%" : batch.stage === "Bottling" ? "78%" : "100%" }]} />
              </View>
            </View>
            <View style={styles.details}>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{batch.liters}L</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{batch.bottles} bottles</Text>
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>Ready {batch.readyAt}</Text>
            </View>
            <PrimaryButton label={batch.stage === "Ready" ? "Batch ready" : "Advance stage"} icon="arrow-right" onPress={() => advanceBatch(batch.id)} disabled={batch.stage === "Ready"} />
          </Panel>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formTitle: { fontWeight: "700", fontSize: 18, marginBottom: 12 },
  formRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  batchTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  lot: { fontWeight: "700", fontSize: 12, letterSpacing: 1.1 },
  recipe: { fontWeight: "700", fontSize: 21, marginTop: 4 },
  timeline: { marginTop: 18, marginBottom: 14 },
  timelineBar: { height: 10, borderRadius: 999, overflow: "hidden" },
  timelineFill: { height: "100%", borderRadius: 999 },
  details: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  detail: { fontWeight: "600", fontSize: 13 },
});
