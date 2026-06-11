import { Stack } from "expo-router";
import { useEffect, Component } from "react";
import type { ReactNode } from "react";

const setIconLink = (rel: string, href: string, sizes?: string) => {
  if (typeof document === "undefined") return;
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const link = existing ?? document.createElement("link");
  link.rel = rel;
  link.href = href;
  if (sizes) link.sizes.value = sizes;
  if (!existing) document.head.appendChild(link);
};

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13, color: "#b91c1c", background: "#fff", position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "auto", zIndex: 99999 }}>
          <b>React Error (production):</b>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 8 }}>
            {err.message}{"\n\n"}{err.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    setIconLink("icon", "/favicon.png", "192x192");
    setIconLink("apple-touch-icon", "/apple-touch-icon.png", "180x180");
  }, []);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }} />
    </ErrorBoundary>
  );
}
