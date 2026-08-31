import "./styles.css";
import { useState } from "react";
import type { RomeAppBootstrap } from "@rome-os/app-web-sdk";
import { Button } from "@rome-os/ui/button";

export default function App({ bootstrap: _bootstrap }: { bootstrap: RomeAppBootstrap }) {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <Button size="lg" onClick={() => setCount((c) => c + 1)}>
        Press me
      </Button>
      <p className="text-sm text-muted-foreground">
        {count === 0 ? "Not pressed yet" : `Pressed ${count} ${count === 1 ? "time" : "times"}`}
      </p>
    </main>
  );
}
