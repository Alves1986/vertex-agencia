/** Radar de Estúdio: estrutura leve, clara e orientada a decisões para operações criativas. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Production from "./pages/Production";
import Projects from "./pages/Projects";
import Agency from "./pages/Agency";
import ClientPortal from "./pages/ClientPortal";
import WhatsApp from "./pages/WhatsApp";
import Success from "./pages/Success";
import Support from "./pages/Support";
import PublicApproval from "./pages/PublicApproval";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/projetos" component={Projects} />
      <Route path="/producao" component={Production} />
      <Route path="/agencia" component={Agency} />
      <Route path="/atendimento" component={WhatsApp} />
      <Route path="/sucesso" component={Success} />
      <Route path="/suporte" component={Support} />
      <Route path="/meu-atendimento" component={ClientPortal} />
      <Route path="/aprovar/:token" component={PublicApproval} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
