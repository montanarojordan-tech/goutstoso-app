import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SignPage from "@/pages/SignPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function InvalidLink() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-3">🔏</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Goûtstoso — Signature électronique</h1>
        <p className="text-gray-500 text-sm">Ce lien n'est pas valide. Demandez un nouveau lien de signature à Goûtstoso.</p>
        <p className="text-gray-400 text-xs mt-4">admin@goutstoso.ch</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/:token" component={SignPage} />
      <Route path="/" component={InvalidLink} />
      <Route component={InvalidLink} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
