import { useEffect, useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient, setOfficePassphrase } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import OfficePage from "@/pages/office";
import GatePage from "@/pages/gate";

// Auth context — single shared passphrase, in-memory only. The Office
// makes no attempt to persist the passphrase. James types it once per
// session; if he closes the tab, he types it again. That's fine.
function useGate() {
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  useEffect(() => {
    setOfficePassphrase(pass);
  }, [pass]);
  return {
    authed,
    enter: (p: string) => {
      setPass(p);
      setAuthed(true);
    },
    leave: () => {
      setPass("");
      setAuthed(false);
    },
  };
}

function AppShell() {
  const gate = useGate();
  if (!gate.authed) {
    return <GatePage onEnter={gate.enter} />;
  }
  return (
    <Switch>
      <Route path="/" component={() => <OfficePage onLeave={gate.leave} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Force dark mode — the office is a back room, not a daylight surface.
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppShell />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
