import "./styles.css";
import type { RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Page, PageNav, PageNavLink } from "@rome-os/ui/page";
import { Toaster } from "@rome-os/ui/sonner";
import { TimestampProvider } from "@rome-os/ui/timestamp";
import { TooltipProvider } from "@rome-os/ui/tooltip";
import { Disclaimer } from "./components/common";
import { useApi } from "./lib/hooks";
import { MetaContext } from "./lib/meta";
import { Link, paths, useRoute, type Route } from "./lib/router";
import { ThemeColorsProvider } from "./lib/theme";
import type { Meta } from "./lib/types";
import { IndicatorDetailView } from "./views/IndicatorDetail";
import { InterventionsView } from "./views/Interventions";
import { MemberView } from "./views/Member";
import { NotFound } from "./views/NotFound";
import { OverviewView } from "./views/Overview";
import { ReportDetailView } from "./views/ReportDetail";
import { ReportsView } from "./views/Reports";
import { UploadView } from "./views/Upload";


function section(route: Route): "overview" | "reports" | "interventions" | null {
  switch (route.name) {
    case "overview":
    case "member":
    case "indicator":
      return "overview";
    case "reports":
    case "report":
    case "upload":
      return "reports";
    case "interventions":
      return "interventions";
    default:
      return null;
  }
}

function View({ route }: { route: Route }) {
  switch (route.name) {
    case "overview":
      return <OverviewView />;
    case "member":
      return <MemberView key={route.id} memberId={route.id} tab={route.tab} />;
    case "indicator":
      return <IndicatorDetailView key={`${route.memberId}:${route.code}`} memberId={route.memberId} code={route.code} />;
    case "reports":
      return <ReportsView memberId={route.memberId} />;
    case "report":
      return <ReportDetailView key={route.id} reportId={route.id} />;
    case "upload":
      return <UploadView memberId={route.memberId} />;
    case "interventions":
      return <InterventionsView memberId={route.memberId} />;
    default:
      return <NotFound />;
  }
}

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const route = useRoute();
  const meta = useApi<Meta>("meta");
  const active = section(route);
  return (
    <ThemeColorsProvider>
      <TimestampProvider locale="zh-CN">
      <TooltipProvider>
        <MetaContext.Provider value={meta.data}>
          <Page className="min-h-full bg-[var(--app-canvas)]">
            <PageNav aria-label="家庭体检助手导航" className="mb-2 overflow-x-auto">
              <PageNavLink asChild active={active === "overview"}>
                <Link to={paths.overview()}>家庭总览</Link>
              </PageNavLink>
              <PageNavLink asChild active={active === "reports"}>
                <Link to={paths.reports()}>体检报告</Link>
              </PageNavLink>
              <PageNavLink asChild active={active === "interventions"}>
                <Link to={paths.interventions()}>干预记录</Link>
              </PageNavLink>
            </PageNav>
            <main className="flex flex-col gap-6">
              <View route={route} />
            </main>
            <footer className="mt-10 border-t border-border pt-4">
              <Disclaimer />
            </footer>
          </Page>
          <Toaster position="top-center" />
        </MetaContext.Provider>
      </TooltipProvider>
      </TimestampProvider>
    </ThemeColorsProvider>
  );
}
