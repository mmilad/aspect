import { getDataPath, pathIsNonempty } from "../../json-path";
import type { AssistantSession } from "../types";
import { ASSISTANT_CATALOG } from "./catalog";
import type { AssistantProperty } from "./blocks";

export function visibleNav(session: AssistantSession): AssistantProperty[] {
  return ASSISTANT_CATALOG.filter((property) => {
    if (!property.showWhen) {
      return true;
    }
    const paths = Array.isArray(property.showWhen) ? property.showWhen : [property.showWhen];
    return paths.some((path) => pathIsNonempty(getDataPath(session, path)));
  });
}
