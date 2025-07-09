import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import GroupChat from "@/pages/GroupChat";
import KnowledgeGraphFullView from "@/pages/KnowledgeGraphFullView";

function Router() {
  return (
    <Switch>
      <Route path="/" component={GroupChat} />
      <Route path="/knowledge-graph" component={KnowledgeGraphFullView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
