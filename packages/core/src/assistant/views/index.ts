export type { AssistantBlock, AssistantProperty, AssistantView } from "./blocks";
export { ASSISTANT_CATALOG, ASSISTANT_ITEM_VIEWS, ASSISTANT_TOPIC_BLOCKS, propertyByKey } from "./catalog";
export { visibleNav } from "./nav";

import { ASSISTANT_CATALOG, ASSISTANT_ITEM_VIEWS, propertyByKey } from "./catalog";
import { visibleNav } from "./nav";

const views = {
  catalog: ASSISTANT_CATALOG,
  itemViews: ASSISTANT_ITEM_VIEWS,
  propertyByKey,
  visibleNav
};

export default views;
