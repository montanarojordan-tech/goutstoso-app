import { Stack } from "expo-router";
import { useEffect } from "react";

const setIconLink = (rel: string, href: string, sizes?: string) => {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const link = existing ?? document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (sizes) link.sizes.value = sizes;
  if (!existing) document.head.appendChild(link);
};

export default function RootLayout() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    setIconLink("icon", "/favicon.png", "192x192");
    setIconLink("apple-touch-icon", "/apple-touch-icon.png", "180x180");
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
