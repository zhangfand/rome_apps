import "./styles.css";
import { useEffect, useState } from "react";
import { getCurrentAppPath, subscribeToAppPath, type RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Home } from "./views/Home";
import { PlayscriptEditor } from "./views/PlayscriptEditor";
import { RunPage } from "./views/RunPage";

/**
 * The view the sub-route names. A run and a playscript each own a URL, so the
 * agent can hand over `/apps/feature-video/runs/<id>` and land the guardian on
 * the recording rather than on the list.
 */
type Route = { view: "home" } | { view: "playscript"; id: string } | { view: "run"; id: string };

function parseRoute(path: string): Route {
  const [head, id] = path.split("/").filter(Boolean);
  if (head === "playscripts" && id) return { view: "playscript", id };
  if (head === "runs" && id) return { view: "run", id };
  return { view: "home" };
}

export default function App({ bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [route, setRoute] = useState<Route>(() => parseRoute(getCurrentAppPath()));

  useEffect(() => subscribeToAppPath((path) => setRoute(parseRoute(path))), []);

  return (
    <main className="flex w-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title">Feature Video</h1>
        <p className="text-ui text-muted-foreground">
          Record a narrated walkthrough of a web app from a playscript.
        </p>
      </div>
      {route.view === "home" ? <Home /> : null}
      {route.view === "playscript" ? <PlayscriptEditor key={route.id} id={route.id} /> : null}
      {route.view === "run" ? (
        <RunPage key={route.id} id={route.id} apiBase={bootstrap.apiBase} />
      ) : null}
    </main>
  );
}
