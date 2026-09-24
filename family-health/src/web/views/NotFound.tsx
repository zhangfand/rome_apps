import { Button } from "@rome-os/ui/button";
import { Empty } from "../components/common";
import { Link, paths } from "../lib/router";

export function NotFound() {
  return (
    <Empty title="页面不存在" description="链接可能已失效，或者记录已被删除。">
      <Button asChild>
        <Link to={paths.overview()}>返回家庭总览</Link>
      </Button>
    </Empty>
  );
}
