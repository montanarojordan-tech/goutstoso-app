import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export type Product = {
  id: string;
  name: string;
  category: string;
  volumeMl: number;
  stock: number;
  threshold: number;
  unitCost: number;
  retailPrice: number;
  accent: string;
};

export type Batch = {
  id: string;
  recipe: string;
  lotCode: string;
  stage: "Maceration" | "Resting" | "Bottling" | "Ready";
  liters: number;
  bottles: number;
  startedAt: string;
  readyAt: string;
};

export type Order = {
  id: string;
  customerName: string;
  status: "Draft" | "Confirmed" | "Packed" | "Delivered";
  dueDate: string;
  total: number;
  items: string;
};

export type Customer = {
  id: string;
  name: string;
  segment: "Boutique" | "Restaurant" | "Distributor" | "Direct";
  location: string;
  lastOrderValue: number;
};

type BusinessState = {
  products: Product[];
  batches: Batch[];
  orders: Order[];
  customers: Customer[];
  initialized: boolean;
  metrics: {
    revenue: number;
    lowStock: number;
    activeBatches: number;
    pendingOrders: number;
    bottlesInStock: number;
  };
  addProduct: (name: string, category: string, stock: number) => void;
  adjustStock: (id: string, delta: number) => void;
  addBatch: (recipe: string, liters: number) => void;
  advanceBatch: (id: string) => void;
  addOrder: (customerName: string, total: number) => void;
  advanceOrder: (id: string) => void;
  addCustomer: (name: string, location: string) => void;
};

const STORAGE_KEY = "goutstoso-business-state-v1";

const productsSeed: Product[] = [
  { id: "p-abricot", name: "Abricot du Valais", category: "Fruit liqueur", volumeMl: 500, stock: 128, threshold: 42, unitCost: 12.4, retailPrice: 34, accent: "#D89536" },
  { id: "p-herbes", name: "Herbes Alpines", category: "Herbal digestif", volumeMl: 700, stock: 36, threshold: 48, unitCost: 16.2, retailPrice: 46, accent: "#3D5A3D" },
  { id: "p-cerise", name: "Cerise Noire", category: "Cherry liqueur", volumeMl: 500, stock: 78, threshold: 40, unitCost: 14.1, retailPrice: 39, accent: "#8F2638" },
];

const batchesSeed: Batch[] = [
  { id: "b-2411", recipe: "Herbes Alpines", lotCode: "HA-24-11", stage: "Resting", liters: 86, bottles: 122, startedAt: "12 Mar", readyAt: "24 Apr" },
  { id: "b-2412", recipe: "Abricot du Valais", lotCode: "AV-24-12", stage: "Maceration", liters: 112, bottles: 224, startedAt: "27 Mar", readyAt: "18 May" },
  { id: "b-2413", recipe: "Cerise Noire", lotCode: "CN-24-13", stage: "Bottling", liters: 42, bottles: 84, startedAt: "04 Apr", readyAt: "Today" },
];

const ordersSeed: Order[] = [
  { id: "o-1008", customerName: "Hotel Bellevue Palace", status: "Confirmed", dueDate: "Tomorrow", total: 1284, items: "24 bottles mixed case" },
  { id: "o-1009", customerName: "Alpine Fine Foods", status: "Packed", dueDate: "Friday", total: 2360, items: "48 bottles wholesale" },
  { id: "o-1010", customerName: "Cave du Marché", status: "Draft", dueDate: "Next week", total: 690, items: "18 bottles seasonal" },
];

const customersSeed: Customer[] = [
  { id: "c-1", name: "Hotel Bellevue Palace", segment: "Restaurant", location: "Bern", lastOrderValue: 1284 },
  { id: "c-2", name: "Alpine Fine Foods", segment: "Distributor", location: "Lausanne", lastOrderValue: 2360 },
  { id: "c-3", name: "Maison Keller", segment: "Boutique", location: "Zürich", lastOrderValue: 840 },
  { id: "c-4", name: "Goutstoso Atelier", segment: "Direct", location: "Sion", lastOrderValue: 420 },
];

const BusinessContext = createContext<BusinessState | null>(null);

const makeId = () => Date.now().toString() + Math.random().toString(36).slice(2, 9);

const vibrate = () => {
  Haptics.selectionAsync().catch(() => undefined);
};

export function BusinessProvider({ children }: PropsWithChildren) {
  const [products, setProducts] = useState<Product[]>(productsSeed);
  const [batches, setBatches] = useState<Batch[]>(batchesSeed);
  const [orders, setOrders] = useState<Order[]>(ordersSeed);
  const [customers, setCustomers] = useState<Customer[]>(customersSeed);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          products?: Product[];
          batches?: Batch[];
          orders?: Order[];
          customers?: Customer[];
        };
        if (Array.isArray(parsed.products)) setProducts(parsed.products);
        if (Array.isArray(parsed.batches)) setBatches(parsed.batches);
        if (Array.isArray(parsed.orders)) setOrders(parsed.orders);
        if (Array.isArray(parsed.customers)) setCustomers(parsed.customers);
      })
      .finally(() => setInitialized(true));
  }, []);

  useEffect(() => {
    if (!initialized) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ products, batches, orders, customers })).catch(() => undefined);
  }, [products, batches, orders, customers, initialized]);

  const metrics = useMemo(() => {
    const delivered = orders.filter((order) => order.status === "Delivered").reduce((sum, order) => sum + order.total, 0);
    const open = orders.filter((order) => order.status !== "Delivered").reduce((sum, order) => sum + order.total, 0);
    return {
      revenue: delivered + open,
      lowStock: products.filter((product) => product.stock <= product.threshold).length,
      activeBatches: batches.filter((batch) => batch.stage !== "Ready").length,
      pendingOrders: orders.filter((order) => order.status !== "Delivered").length,
      bottlesInStock: products.reduce((sum, product) => sum + product.stock, 0),
    };
  }, [products, batches, orders]);

  const addProduct = (name: string, category: string, stock: number) => {
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();
    if (!trimmedName || !trimmedCategory) return;
    vibrate();
    setProducts((current) => [
      { id: makeId(), name: trimmedName, category: trimmedCategory, volumeMl: 500, stock, threshold: 24, unitCost: 13.5, retailPrice: 38, accent: "#9A3E24" },
      ...current,
    ]);
  };

  const adjustStock = (id: string, delta: number) => {
    vibrate();
    setProducts((current) => current.map((product) => product.id === id ? { ...product, stock: Math.max(0, product.stock + delta) } : product));
  };

  const addBatch = (recipe: string, liters: number) => {
    const trimmed = recipe.trim();
    if (!trimmed) return;
    vibrate();
    setBatches((current) => [
      { id: makeId(), recipe: trimmed, lotCode: `${trimmed.slice(0, 2).toUpperCase()}-${new Date().getFullYear().toString().slice(2)}-${current.length + 14}`, stage: "Maceration", liters, bottles: Math.round(liters * 2), startedAt: "Today", readyAt: "In 42 days" },
      ...current,
    ]);
  };

  const advanceBatch = (id: string) => {
    const order: Batch["stage"][] = ["Maceration", "Resting", "Bottling", "Ready"];
    vibrate();
    setBatches((current) => current.map((batch) => {
      if (batch.id !== id) return batch;
      const next = order[Math.min(order.indexOf(batch.stage) + 1, order.length - 1)] ?? "Ready";
      return { ...batch, stage: next };
    }));
  };

  const addOrder = (customerName: string, total: number) => {
    const trimmed = customerName.trim();
    if (!trimmed) return;
    vibrate();
    setOrders((current) => [
      { id: makeId(), customerName: trimmed, status: "Draft", dueDate: "New", total, items: "Custom order" },
      ...current,
    ]);
  };

  const advanceOrder = (id: string) => {
    const order: Order["status"][] = ["Draft", "Confirmed", "Packed", "Delivered"];
    vibrate();
    setOrders((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = order[Math.min(order.indexOf(item.status) + 1, order.length - 1)] ?? "Delivered";
      return { ...item, status: next };
    }));
  };

  const addCustomer = (name: string, location: string) => {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();
    if (!trimmedName || !trimmedLocation) return;
    vibrate();
    setCustomers((current) => [
      { id: makeId(), name: trimmedName, segment: "Direct", location: trimmedLocation, lastOrderValue: 0 },
      ...current,
    ]);
  };

  return (
    <BusinessContext.Provider value={{ products, batches, orders, customers, initialized, metrics, addProduct, adjustStock, addBatch, advanceBatch, addOrder, advanceOrder, addCustomer }}>
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const context = useContext(BusinessContext);
  if (!context) {
    throw new Error("useBusiness must be used inside BusinessProvider");
  }
  return context;
}
